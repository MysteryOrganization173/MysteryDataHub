import { AgentOnboardingPayment } from '../models/AgentOnboardingPayment.js';
import { AgentReferral } from '../models/AgentReferral.js';
import { AgentReferralMilestone } from '../models/AgentReferralMilestone.js';
import { AgentTransaction } from '../models/AgentTransaction.js';
import { Order } from '../models/Order.js';
import { User } from '../models/User.js';
import { Withdrawal } from '../models/Withdrawal.js';
import { REFERRAL_MILESTONE_LADDER } from './agent-program.service.js';
import {
  AGENT_REFERRAL_BONUS_GHS,
  roundMoney,
  toIdString
} from '../utils/agent.utils.js';

async function upsertAgentTransaction({
  agentId,
  type,
  amount,
  status,
  referenceType,
  referenceId,
  note,
  metadata = {}
}) {
  return AgentTransaction.findOneAndUpdate(
    {
      agentId,
      type,
      referenceType,
      referenceId
    },
    {
      $set: {
        amount: roundMoney(amount),
        status,
        note,
        metadata
      }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  );
}

async function getOrderDocument(orderInput) {
  if (!orderInput) return null;
  if (orderInput?._id) return Order.findById(orderInput._id);
  return Order.findById(orderInput);
}

async function getPaymentDocument(paymentInput) {
  if (!paymentInput) return null;
  if (paymentInput?._id) return AgentOnboardingPayment.findById(paymentInput._id);
  return AgentOnboardingPayment.findById(paymentInput);
}

async function getWithdrawalDocument(withdrawalInput) {
  if (!withdrawalInput) return null;
  if (withdrawalInput?._id) return Withdrawal.findById(withdrawalInput._id);
  return Withdrawal.findById(withdrawalInput);
}

async function getCreditedReferralCount(agentId) {
  return AgentReferral.countDocuments({
    referrerAgentId: agentId,
    status: 'credited'
  });
}

async function ensureMilestoneRecord(agentId, milestoneCount, bonusAmount) {
  return AgentReferralMilestone.findOneAndUpdate(
    { agentId, milestoneCount },
    {
      $setOnInsert: {
        agentId,
        milestoneCount,
        bonusAmount,
        status: 'pending'
      }
    },
    {
      upsert: true,
      new: true
    }
  );
}

async function creditMilestone(agentId, milestoneInput, sourceReferralCount) {
  const milestone = await AgentReferralMilestone.findOneAndUpdate(
    {
      _id: milestoneInput._id,
      status: { $ne: 'credited' }
    },
    {
      $set: {
        status: 'credited',
        achievedAt: milestoneInput.achievedAt || new Date(),
        paidAt: new Date(),
        reversedAt: null,
        sourceReferralCount
      }
    },
    { new: true }
  );

  if (!milestone) {
    return AgentReferralMilestone.findById(milestoneInput._id);
  }

  const amount = roundMoney(milestone.bonusAmount || 0);
  await User.updateOne(
    { _id: agentId },
    {
      $inc: {
        balance: amount,
        referralBalance: amount,
        totalEarnings: amount,
        totalEarned: amount
      }
    }
  );

  await upsertAgentTransaction({
    agentId,
    type: 'referral_milestone_bonus',
    amount,
    status: 'completed',
    referenceType: 'referral_milestone',
    referenceId: toIdString(milestone._id),
    note: `Milestone bonus for ${milestone.milestoneCount} paid referrals`,
    metadata: {
      milestoneCount: milestone.milestoneCount,
      sourceReferralCount
    }
  });

  return milestone;
}

async function reverseMilestone(agentId, milestoneInput, sourceReferralCount) {
  const milestone = await AgentReferralMilestone.findOneAndUpdate(
    {
      _id: milestoneInput._id,
      status: 'credited'
    },
    {
      $set: {
        status: 'reversed',
        reversedAt: new Date(),
        sourceReferralCount
      }
    },
    { new: true }
  );

  if (!milestone) {
    return AgentReferralMilestone.findById(milestoneInput._id);
  }

  const amount = roundMoney(milestone.bonusAmount || 0);
  await User.updateOne(
    { _id: agentId },
    {
      $inc: {
        balance: -amount,
        referralBalance: -amount,
        totalEarnings: -amount,
        totalEarned: -amount
      }
    }
  );

  await upsertAgentTransaction({
    agentId,
    type: 'referral_milestone_bonus',
    amount,
    status: 'reversed',
    referenceType: 'referral_milestone',
    referenceId: toIdString(milestone._id),
    note: `Milestone bonus reversed for ${milestone.milestoneCount} paid referrals`,
    metadata: {
      milestoneCount: milestone.milestoneCount,
      sourceReferralCount
    }
  });

  return milestone;
}

export async function syncReferralMilestones(agentId) {
  if (!agentId) {
    return [];
  }

  const paidReferralCount = await getCreditedReferralCount(agentId);
  const existingMilestones = await AgentReferralMilestone.find({ agentId });
  const existingMap = new Map(existingMilestones.map((milestone) => [milestone.milestoneCount, milestone]));

  const updatedRows = [];
  for (const entry of REFERRAL_MILESTONE_LADDER) {
    const milestone = existingMap.get(entry.milestoneCount) || await ensureMilestoneRecord(
      agentId,
      entry.milestoneCount,
      entry.bonusAmount
    );

    if (paidReferralCount >= entry.milestoneCount) {
      updatedRows.push(await creditMilestone(agentId, milestone, paidReferralCount));
    } else if (milestone.status === 'credited') {
      updatedRows.push(await reverseMilestone(agentId, milestone, paidReferralCount));
    } else {
      updatedRows.push(milestone);
    }
  }

  return updatedRows;
}

export async function getReferralMilestoneProgress(agentId) {
  const paidReferralCount = await getCreditedReferralCount(agentId);
  const milestoneRows = await syncReferralMilestones(agentId);
  const milestoneMap = new Map(milestoneRows.map((row) => [row.milestoneCount, row]));
  const nextMilestone = REFERRAL_MILESTONE_LADDER.find((entry) => paidReferralCount < entry.milestoneCount) || null;

  const milestones = REFERRAL_MILESTONE_LADDER.map((entry) => {
    const row = milestoneMap.get(entry.milestoneCount);
    const progress = nextMilestone
      ? Math.min((paidReferralCount / entry.milestoneCount) * 100, 100)
      : 100;

    return {
      milestoneCount: entry.milestoneCount,
      bonusAmount: roundMoney(entry.bonusAmount),
      status: row?.status || 'pending',
      achievedAt: row?.achievedAt || null,
      paidAt: row?.paidAt || null,
      reversedAt: row?.reversedAt || null,
      sourceReferralCount: row?.sourceReferralCount || 0,
      progressPercent: roundMoney(progress)
    };
  });

  return {
    paidReferralCount,
    totalMilestoneEarnings: roundMoney(
      milestones
        .filter((entry) => entry.status === 'credited')
        .reduce((sum, entry) => sum + Number(entry.bonusAmount || 0), 0)
    ),
    nextMilestone: nextMilestone
      ? {
          milestoneCount: nextMilestone.milestoneCount,
          bonusAmount: roundMoney(nextMilestone.bonusAmount),
          remainingReferrals: Math.max(nextMilestone.milestoneCount - paidReferralCount, 0)
        }
      : null,
    milestones
  };
}

export async function getReservedWithdrawalAmount(agentId) {
  const result = await Withdrawal.aggregate([
    {
      $match: {
        agentId: typeof agentId === 'string' ? agentId : agentId,
        status: { $in: ['pending', 'approved'] }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' }
      }
    }
  ]);

  return roundMoney(result[0]?.total || 0);
}

export async function recordAgentOrderPendingEarnings(orderInput) {
  const order = await getOrderDocument(orderInput);
  if (!order || !order.agentId || roundMoney(order.agentProfit) <= 0) {
    return order;
  }
  if (order.paymentStatus !== 'success') {
    return order;
  }

  const updatedOrder = await Order.findOneAndUpdate(
    {
      _id: order._id,
      profitStatus: { $in: ['unrecorded', 'none'] }
    },
    {
      $set: {
        profitStatus: 'pending',
        pendingEarningsRecordedAt: new Date()
      }
    },
    {
      new: true
    }
  );

  if (!updatedOrder) {
    return Order.findById(order._id);
  }

  const profit = roundMoney(updatedOrder.agentProfit);
  await User.updateOne(
    { _id: updatedOrder.agentId },
    {
      $inc: {
        pendingBalance: profit
      }
    }
  );

  await upsertAgentTransaction({
    agentId: updatedOrder.agentId,
    type: 'order_profit',
    amount: profit,
    status: 'pending',
    referenceType: 'order',
    referenceId: toIdString(updatedOrder._id),
    note: `Pending profit for ${updatedOrder.bundleName || updatedOrder.bundleCode}`,
    metadata: {
      orderId: updatedOrder.orderId,
      reference: updatedOrder.reference
    }
  });

  return updatedOrder;
}

export async function settleAgentOrderEarnings(orderInput) {
  const order = await getOrderDocument(orderInput);
  if (!order || !order.agentId || roundMoney(order.agentProfit) <= 0) {
    return order;
  }

  const profit = roundMoney(order.agentProfit);

  if (order.deliveryStatus === 'delivered') {
    const updatedOrder = await Order.findOneAndUpdate(
      {
        _id: order._id,
        profitStatus: 'pending'
      },
      {
        $set: {
          profitStatus: 'available',
          earningsAvailableAt: new Date()
        }
      },
      { new: true }
    );

    if (!updatedOrder) {
      return Order.findById(order._id);
    }

    await User.updateOne(
      { _id: updatedOrder.agentId },
      {
        $inc: {
          pendingBalance: -profit,
          balance: profit,
          totalEarnings: profit,
          totalEarned: profit,
          totalSales: roundMoney(updatedOrder.sellingPrice || updatedOrder.amount || 0),
          totalOrders: 1
        }
      }
    );

    await upsertAgentTransaction({
      agentId: updatedOrder.agentId,
      type: 'order_profit',
      amount: profit,
      status: 'completed',
      referenceType: 'order',
      referenceId: toIdString(updatedOrder._id),
      note: `Profit available for ${updatedOrder.bundleName || updatedOrder.bundleCode}`,
      metadata: {
        orderId: updatedOrder.orderId,
        reference: updatedOrder.reference
      }
    });

    return updatedOrder;
  }

  if (order.deliveryStatus === 'failed') {
    const updatedOrder = await Order.findOneAndUpdate(
      {
        _id: order._id,
        profitStatus: 'pending'
      },
      {
        $set: {
          profitStatus: 'reversed',
          earningsReversedAt: new Date()
        }
      },
      { new: true }
    );

    if (!updatedOrder) {
      return Order.findById(order._id);
    }

    await User.updateOne(
      { _id: updatedOrder.agentId },
      {
        $inc: {
          pendingBalance: -profit
        }
      }
    );

    await upsertAgentTransaction({
      agentId: updatedOrder.agentId,
      type: 'order_profit',
      amount: profit,
      status: 'reversed',
      referenceType: 'order',
      referenceId: toIdString(updatedOrder._id),
      note: `Profit reversed because order ${updatedOrder.orderId} failed`,
      metadata: {
        orderId: updatedOrder.orderId,
        reference: updatedOrder.reference
      }
    });

    return updatedOrder;
  }

  return order;
}

export async function creditReferralBonusForOnboarding(paymentInput) {
  const payment = await getPaymentDocument(paymentInput);
  if (!payment || payment.status !== 'success' || !payment.referrerAgentId || payment.bonusAwarded) {
    return payment;
  }

  const updatedPayment = await AgentOnboardingPayment.findOneAndUpdate(
    {
      _id: payment._id,
      status: 'success',
      referrerAgentId: { $ne: null },
      bonusAwarded: false
    },
    {
      $set: {
        bonusAwarded: true,
        bonusAwardedAt: new Date()
      }
    },
    {
      new: true
    }
  );

  if (!updatedPayment) {
    return AgentOnboardingPayment.findById(payment._id);
  }

  await AgentReferral.findOneAndUpdate(
    { referredAgentId: updatedPayment.agentId },
    {
      $set: {
        referrerAgentId: updatedPayment.referrerAgentId,
        referredAgentId: updatedPayment.agentId,
        onboardingPaymentId: updatedPayment._id,
        bonusAmount: AGENT_REFERRAL_BONUS_GHS,
        status: 'credited',
        paidAt: new Date()
      }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  );

  await User.updateOne(
    { _id: updatedPayment.referrerAgentId },
    {
      $inc: {
        balance: AGENT_REFERRAL_BONUS_GHS,
        referralBalance: AGENT_REFERRAL_BONUS_GHS,
        totalEarnings: AGENT_REFERRAL_BONUS_GHS,
        totalEarned: AGENT_REFERRAL_BONUS_GHS
      }
    }
  );

  await upsertAgentTransaction({
    agentId: updatedPayment.referrerAgentId,
    type: 'referral_bonus',
    amount: AGENT_REFERRAL_BONUS_GHS,
    status: 'completed',
    referenceType: 'onboarding_payment',
    referenceId: toIdString(updatedPayment._id),
    note: 'Referral bonus after successful agent activation',
    metadata: {
      referredAgentId: toIdString(updatedPayment.agentId),
      reference: updatedPayment.reference
    }
  });

  await syncReferralMilestones(updatedPayment.referrerAgentId);

  return updatedPayment;
}

export async function createWithdrawalLedgerEntry(withdrawalInput) {
  const withdrawal = await getWithdrawalDocument(withdrawalInput);
  if (!withdrawal) return null;

  return upsertAgentTransaction({
    agentId: withdrawal.agentId,
    type: 'withdrawal_request',
    amount: -roundMoney(withdrawal.amount),
    status: 'pending',
    referenceType: 'withdrawal',
    referenceId: toIdString(withdrawal._id),
    note: 'Withdrawal request submitted',
    metadata: {
      payoutMethod: withdrawal.payoutMethod,
      momoNumber: withdrawal.momoNumber
    }
  });
}

export async function approveWithdrawalRequest(withdrawalInput, { adminId, note = '' } = {}) {
  const withdrawal = await getWithdrawalDocument(withdrawalInput);
  if (!withdrawal) return null;

  if (withdrawal.status !== 'pending') {
    return withdrawal;
  }

  const updated = await Withdrawal.findOneAndUpdate(
    {
      _id: withdrawal._id,
      status: 'pending'
    },
    {
      $set: {
        status: 'approved',
        adminNote: note,
        processedBy: adminId || null,
        approvedAt: new Date(),
        processedAt: new Date()
      }
    },
    { new: true }
  );

  if (!updated) {
    return Withdrawal.findById(withdrawal._id);
  }

  await AgentTransaction.findOneAndUpdate(
    {
      agentId: updated.agentId,
      type: 'withdrawal_request',
      referenceType: 'withdrawal',
      referenceId: toIdString(updated._id)
    },
    {
      $set: {
        status: 'pending',
        note: note || 'Withdrawal approved and waiting for manual payout'
      }
    }
  );

  return updated;
}

export async function markWithdrawalPaid(withdrawalInput, { adminId, note = '', payoutReference = '' } = {}) {
  const withdrawal = await getWithdrawalDocument(withdrawalInput);
  if (!withdrawal) return null;

  if (!['pending', 'approved'].includes(withdrawal.status)) {
    return withdrawal;
  }

  const agent = await User.findById(withdrawal.agentId);
  if (!agent || roundMoney(agent.balance) < roundMoney(withdrawal.amount)) {
    const error = new Error('Agent balance is no longer sufficient for this payout');
    error.status = 400;
    throw error;
  }

  const updated = await Withdrawal.findOneAndUpdate(
    {
      _id: withdrawal._id,
      status: { $in: ['pending', 'approved'] }
    },
    {
      $set: {
        status: 'paid',
        adminNote: note,
        payoutReference,
        processedBy: adminId || null,
        paidAt: new Date(),
        processedAt: new Date()
      }
    },
    { new: true }
  );

  if (!updated) {
    return Withdrawal.findById(withdrawal._id);
  }

  await User.updateOne(
    { _id: updated.agentId },
    {
      $inc: {
        balance: -roundMoney(updated.amount)
      }
    }
  );

  await AgentTransaction.findOneAndUpdate(
    {
      agentId: updated.agentId,
      type: 'withdrawal_request',
      referenceType: 'withdrawal',
      referenceId: toIdString(updated._id)
    },
    {
      $set: {
        status: 'completed',
        note: note || 'Withdrawal paid manually'
      }
    }
  );

  await upsertAgentTransaction({
    agentId: updated.agentId,
    type: 'withdrawal_paid',
    amount: -roundMoney(updated.amount),
    status: 'completed',
    referenceType: 'withdrawal',
    referenceId: toIdString(updated._id),
    note: note || 'Withdrawal paid manually',
    metadata: {
      payoutReference
    }
  });

  return updated;
}

export async function rejectWithdrawalRequest(withdrawalInput, { adminId, note = '' } = {}) {
  const withdrawal = await getWithdrawalDocument(withdrawalInput);
  if (!withdrawal) return null;

  if (withdrawal.status === 'rejected') {
    return withdrawal;
  }

  const updated = await Withdrawal.findOneAndUpdate(
    {
      _id: withdrawal._id,
      status: { $in: ['pending', 'approved'] }
    },
    {
      $set: {
        status: 'rejected',
        adminNote: note,
        processedBy: adminId || null,
        processedAt: new Date()
      }
    },
    { new: true }
  );

  if (!updated) {
    return Withdrawal.findById(withdrawal._id);
  }

  await AgentTransaction.findOneAndUpdate(
    {
      agentId: updated.agentId,
      type: 'withdrawal_request',
      referenceType: 'withdrawal',
      referenceId: toIdString(updated._id)
    },
    {
      $set: {
        status: 'rejected',
        note: note || 'Withdrawal request rejected'
      }
    }
  );

  await upsertAgentTransaction({
    agentId: updated.agentId,
    type: 'withdrawal_rejected',
    amount: 0,
    status: 'rejected',
    referenceType: 'withdrawal',
    referenceId: toIdString(updated._id),
    note: note || 'Withdrawal request rejected'
  });

  return updated;
}
