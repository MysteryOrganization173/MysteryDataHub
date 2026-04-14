import { AgentReferral } from '../models/AgentReferral.js';
import { AgentReferralMilestone } from '../models/AgentReferralMilestone.js';
import { AgentTransaction } from '../models/AgentTransaction.js';
import { AdminAuditLog } from '../models/AdminAuditLog.js';
import { Order } from '../models/Order.js';
import { User } from '../models/User.js';
import { Withdrawal } from '../models/Withdrawal.js';
import {
  approveWithdrawalRequest,
  getReferralMilestoneProgress,
  markWithdrawalPaid,
  rejectWithdrawalRequest,
  syncReferralMilestones
} from '../services/agent-accounting.service.js';
import { serializeAdminAuditLog, recordAdminAudit } from '../services/admin-audit.service.js';
import { getNetworkStatusSetting, setNetworkStatusSetting } from '../services/agent-program.service.js';
import { getAgentPricingView, getAgentStoreSettingsView } from '../services/agent-pricing.service.js';
import { settleAgentOrderEarnings } from '../services/agent-accounting.service.js';
import { roundMoney, sanitizeText, toIdString } from '../utils/agent.utils.js';

const serializeAgent = (agentInput) => {
  const agent = agentInput?.toObject ? agentInput.toObject() : agentInput;
  return {
    id: toIdString(agent._id || agent.id),
    fullName: agent.fullName,
    email: agent.email,
    phone: agent.phone,
    storeName: agent.storeName,
    storeSlug: agent.storeSlug,
    referralCode: agent.referralCode,
    agentStatus: agent.agentStatus,
    isActive: Boolean(agent.isActive),
    balance: roundMoney(agent.balance || 0),
    pendingBalance: roundMoney(agent.pendingBalance || 0),
    referralBalance: roundMoney(agent.referralBalance || 0),
    totalEarnings: roundMoney(agent.totalEarnings || 0),
    totalEarned: roundMoney(agent.totalEarned || 0),
    totalSales: roundMoney(agent.totalSales || 0),
    totalOrders: Number(agent.totalOrders || 0),
    momoNumber: agent.momoNumber || '',
    createdAt: agent.createdAt
  };
};

const serializeWithdrawal = (withdrawalInput) => {
  const withdrawal = withdrawalInput?.toObject ? withdrawalInput.toObject() : withdrawalInput;
  const agent = withdrawal.agentId || {};
  return {
    id: toIdString(withdrawal._id || withdrawal.id),
    agentId: toIdString(agent._id || agent.id || withdrawal.agentId),
    agentName: agent.storeName || agent.fullName || 'Agent',
    agentStoreSlug: agent.storeSlug || '',
    requestedAmount: roundMoney(withdrawal.amount || 0),
    amount: roundMoney(withdrawal.amount || 0),
    withdrawalFee: roundMoney(withdrawal.fee || 0),
    fee: roundMoney(withdrawal.fee || 0),
    netPayout: roundMoney(withdrawal.netAmount || 0),
    netAmount: roundMoney(withdrawal.netAmount || 0),
    momoNumber: withdrawal.momoNumber || agent.momoNumber || '',
    payoutMethod: withdrawal.payoutMethod || 'momo',
    status: withdrawal.status,
    adminNote: withdrawal.adminNote || '',
    payoutReference: withdrawal.payoutReference || '',
    createdAt: withdrawal.createdAt,
    approvedAt: withdrawal.approvedAt,
    paidAt: withdrawal.paidAt
  };
};

const serializeOrder = (orderInput) => {
  const order = orderInput?.toObject ? orderInput.toObject() : orderInput;
  const agent = order.agentId || {};
  return {
    id: toIdString(order._id || order.id),
    orderId: order.orderId,
    reference: order.reference,
    agentId: toIdString(agent._id || agent.id || order.agentId),
    agentName: agent.storeName || agent.fullName || '',
    customerPhone: order.customerPhone,
    customerEmail: order.customerEmail || '',
    network: order.network,
    tier: order.catalogTier,
    tierLabel: order.tierLabel || order.catalogTier,
    bundleName: order.bundleName,
    amount: roundMoney(order.amount || 0),
    sellingPrice: roundMoney(order.sellingPrice || order.amount || 0),
    wholesaleCost: roundMoney(order.wholesaleCost || 0),
    agentProfit: roundMoney(order.agentProfit || 0),
    profitStatus: order.profitStatus || 'none',
    paymentStatus: order.paymentStatus,
    deliveryStatus: order.deliveryStatus,
    status: order.status,
    createdAt: order.createdAt
  };
};

const serializeReferral = (referralInput) => {
  const referral = referralInput?.toObject ? referralInput.toObject() : referralInput;
  const referrer = referral.referrerAgentId || {};
  const referred = referral.referredAgentId || {};
  return {
    id: toIdString(referral._id || referral.id),
    status: referral.status,
    bonusAmount: roundMoney(referral.bonusAmount || 0),
    createdAt: referral.createdAt,
    paidAt: referral.paidAt,
    referrer: {
      id: toIdString(referrer._id || referrer.id),
      fullName: referrer.fullName || '',
      storeName: referrer.storeName || ''
    },
    referredAgent: {
      id: toIdString(referred._id || referred.id),
      fullName: referred.fullName || '',
      storeName: referred.storeName || '',
      phone: referred.phone || '',
      email: referred.email || '',
      agentStatus: referred.agentStatus || ''
    }
  };
};

const serializeMilestone = (milestoneInput) => {
  const milestone = milestoneInput?.toObject ? milestoneInput.toObject() : milestoneInput;
  const agent = milestone.agentId || {};
  return {
    id: toIdString(milestone._id || milestone.id),
    agentId: toIdString(agent._id || agent.id || milestone.agentId),
    agentName: agent.storeName || agent.fullName || '',
    agentStoreSlug: agent.storeSlug || '',
    milestoneCount: Number(milestone.milestoneCount || 0),
    bonusAmount: roundMoney(milestone.bonusAmount || 0),
    status: milestone.status || 'pending',
    achievedAt: milestone.achievedAt || null,
    paidAt: milestone.paidAt || null,
    reversedAt: milestone.reversedAt || null,
    sourceReferralCount: Number(milestone.sourceReferralCount || 0)
  };
};

const serializePricingOverride = (product) => ({
  id: product.id,
  productKey: product.productKey,
  network: product.network,
  networkLabel: product.networkLabel,
  tier: product.tier,
  tierLabel: product.tierLabel,
  sizeLabel: product.sizeLabel,
  floorPrice: roundMoney(product.floorPrice || 0),
  suggestedRetailPrice: roundMoney(product.suggestedRetailPrice || 0),
  customRetailPrice: product.customRetailPrice !== null ? roundMoney(product.customRetailPrice || 0) : null,
  retailPrice: roundMoney(product.retailPrice || 0),
  wholesaleCost: roundMoney(product.wholesaleCost || 0),
  minProfit: roundMoney(product.minProfit || 0),
  projectedProfit: roundMoney(product.projectedProfit || 0),
  isActive: Boolean(product.isActive)
});

async function getAgentAuditTrail(agentId, limit = 12) {
  const rows = await AdminAuditLog.find({
    $or: [
      { targetType: 'agent', targetId: toIdString(agentId) },
      { 'metadata.agentId': toIdString(agentId) }
    ]
  })
    .populate('adminId', 'fullName email')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return rows.map(serializeAdminAuditLog);
}

export const getAgents = async (req, res) => {
  try {
    const [agents, recentAuditLogs] = await Promise.all([
      User.find({ role: 'agent' }).select('-password').sort({ createdAt: -1 }),
      AdminAuditLog.find()
        .populate('adminId', 'fullName email')
        .sort({ createdAt: -1 })
        .limit(12)
        .lean()
    ]);
    res.json({
      success: true,
      data: agents.map(serializeAgent),
      meta: {
        recentAuditLogs: recentAuditLogs.map(serializeAdminAuditLog)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAgentDetails = async (req, res) => {
  try {
    const agent = await User.findById(req.params.id).select('-password');
    if (!agent || agent.role !== 'agent') {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }

    const [recentOrders, transactions, referrals, storeSettings, pricingView, milestoneProgress, auditTrail] = await Promise.all([
      Order.find({ agentId: agent._id }).sort({ createdAt: -1 }).limit(8).lean(),
      AgentTransaction.find({ agentId: agent._id }).sort({ createdAt: -1 }).limit(12).lean(),
      AgentReferral.find({
        $or: [{ referrerAgentId: agent._id }, { referredAgentId: agent._id }]
      }).populate('referrerAgentId', 'fullName storeName').populate('referredAgentId', 'fullName storeName phone email agentStatus').lean(),
      getAgentStoreSettingsView(agent),
      getAgentPricingView(agent._id),
      getReferralMilestoneProgress(agent._id),
      getAgentAuditTrail(agent._id)
    ]);
    const pricingOverrides = pricingView.products.filter(
      (product) => product.customRetailPrice !== null || product.isActive === false
    );

    res.json({
      success: true,
      data: {
        ...serializeAgent(agent),
        recentOrders: recentOrders.map(serializeOrder),
        transactions: transactions.map((transaction) => ({
          id: toIdString(transaction._id),
          type: transaction.type,
          amount: roundMoney(transaction.amount || 0),
          status: transaction.status,
          note: transaction.note || '',
          createdAt: transaction.createdAt
        })),
        referrals: referrals.map(serializeReferral),
        storeSettings,
        pricingOverrides: pricingOverrides.map(serializePricingOverride),
        pricingSummary: {
          totalProducts: pricingView.products.length,
          overrideCount: pricingOverrides.filter((product) => product.customRetailPrice !== null).length,
          hiddenCount: pricingView.products.filter((product) => product.isActive === false).length
        },
        referralMilestones: {
          paidReferralCount: milestoneProgress.paidReferralCount,
          totalMilestoneEarnings: roundMoney(milestoneProgress.totalMilestoneEarnings),
          milestones: milestoneProgress.milestones.map(serializeMilestone)
        },
        auditTrail
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const toggleAgentStatus = async (req, res) => {
  try {
    const agent = await User.findById(req.params.id);
    if (!agent || agent.role !== 'agent') {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }

    const isActive = Boolean(req.body.isActive);
    agent.isActive = isActive;
    agent.agentStatus = isActive ? 'active' : 'suspended';
    await agent.save();
    await recordAdminAudit({
      adminId: req.user._id,
      action: 'agent_status_updated',
      targetType: 'agent',
      targetId: toIdString(agent._id),
      note: `Agent marked ${agent.agentStatus}`,
      metadata: {
        agentId: toIdString(agent._id),
        isActive,
        agentStatus: agent.agentStatus
      }
    });

    res.json({ success: true, message: 'Status updated', data: serializeAgent(agent) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find()
      .populate('agentId', 'fullName storeName storeSlug momoNumber')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: withdrawals.map(serializeWithdrawal) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const approveWithdrawal = async (req, res) => {
  try {
    const adminNote = sanitizeText(req.body?.adminNote, 200);
    const withdrawal = await approveWithdrawalRequest(req.params.id, {
      adminId: req.user._id,
      note: adminNote
    });
    if (!withdrawal) return res.status(404).json({ success: false, message: 'Withdrawal not found' });
    await recordAdminAudit({
      adminId: req.user._id,
      action: 'withdrawal_approved',
      targetType: 'withdrawal',
      targetId: toIdString(withdrawal._id),
      note: adminNote || 'Withdrawal approved',
      metadata: {
        agentId: toIdString(withdrawal.agentId),
        status: withdrawal.status
      }
    });
    res.json({ success: true, message: 'Withdrawal approved', data: serializeWithdrawal(withdrawal) });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

export const rejectWithdrawal = async (req, res) => {
  try {
    const adminNote = sanitizeText(req.body?.adminNote, 200);
    const withdrawal = await rejectWithdrawalRequest(req.params.id, {
      adminId: req.user._id,
      note: adminNote
    });
    if (!withdrawal) return res.status(404).json({ success: false, message: 'Withdrawal not found' });
    await recordAdminAudit({
      adminId: req.user._id,
      action: 'withdrawal_rejected',
      targetType: 'withdrawal',
      targetId: toIdString(withdrawal._id),
      note: adminNote || 'Withdrawal rejected',
      metadata: {
        agentId: toIdString(withdrawal.agentId),
        status: withdrawal.status
      }
    });
    res.json({ success: true, message: 'Withdrawal rejected', data: serializeWithdrawal(withdrawal) });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

export const patchAgentWithdrawal = async (req, res) => {
  try {
    const status = sanitizeText(req.body?.status, 40).toLowerCase();
    const adminNote = sanitizeText(req.body?.adminNote, 200);
    const payoutReference = sanitizeText(req.body?.payoutReference, 120);

    let withdrawal;
    if (status === 'approved') {
      withdrawal = await approveWithdrawalRequest(req.params.id, { adminId: req.user._id, note: adminNote });
    } else if (status === 'paid') {
      withdrawal = await markWithdrawalPaid(req.params.id, {
        adminId: req.user._id,
        note: adminNote,
        payoutReference
      });
    } else if (status === 'rejected') {
      withdrawal = await rejectWithdrawalRequest(req.params.id, { adminId: req.user._id, note: adminNote });
    } else {
      return res.status(400).json({ success: false, message: 'Unsupported withdrawal status update' });
    }

    if (!withdrawal) {
      return res.status(404).json({ success: false, message: 'Withdrawal not found' });
    }

    await recordAdminAudit({
      adminId: req.user._id,
      action: `withdrawal_${status}`,
      targetType: 'withdrawal',
      targetId: toIdString(withdrawal._id),
      note: adminNote || `Withdrawal marked as ${status}`,
      metadata: {
        agentId: toIdString(withdrawal.agentId),
        status,
        payoutReference
      }
    });

    return res.json({
      success: true,
      message: `Withdrawal marked as ${status}`,
      data: serializeWithdrawal(withdrawal)
    });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

export const getOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('agentId', 'fullName storeName storeSlug')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: orders.map(serializeOrder) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const patchAgentOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const nextDeliveryStatus = sanitizeText(req.body?.deliveryStatus, 40).toLowerCase();
    const nextStatus = sanitizeText(req.body?.status, 40).toLowerCase();

    if (nextDeliveryStatus) {
      order.deliveryStatus = nextDeliveryStatus;
    }
    if (nextStatus) {
      order.status = nextStatus;
    } else if (nextDeliveryStatus === 'delivered') {
      order.status = 'fulfilled';
    } else if (nextDeliveryStatus === 'failed') {
      order.status = 'failed';
    }

    await order.save();
    await settleAgentOrderEarnings(order._id);

    const freshOrder = await Order.findById(order._id).populate('agentId', 'fullName storeName storeSlug');
    await recordAdminAudit({
      adminId: req.user._id,
      action: 'order_status_updated',
      targetType: 'order',
      targetId: toIdString(order._id),
      note: 'Order status updated by admin',
      metadata: {
        agentId: toIdString(order.agentId),
        deliveryStatus: freshOrder?.deliveryStatus || nextDeliveryStatus,
        status: freshOrder?.status || nextStatus
      }
    });
    return res.json({
      success: true,
      message: 'Order updated successfully',
      data: serializeOrder(freshOrder)
    });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

export const getAgentReferrals = async (req, res) => {
  try {
    const [referrals, milestones] = await Promise.all([
      AgentReferral.find()
        .populate('referrerAgentId', 'fullName storeName')
        .populate('referredAgentId', 'fullName storeName phone email agentStatus')
        .sort({ createdAt: -1 }),
      AgentReferralMilestone.find()
        .populate('agentId', 'fullName storeName storeSlug')
        .sort({ milestoneCount: 1, createdAt: -1 })
    ]);

    res.json({
      success: true,
      data: referrals.map(serializeReferral),
      meta: {
        milestones: milestones.map(serializeMilestone)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const patchAgentReferral = async (req, res) => {
  try {
    const referral = await AgentReferral.findById(req.params.id);
    if (!referral) {
      return res.status(404).json({ success: false, message: 'Referral not found' });
    }

    const nextStatus = sanitizeText(req.body?.status, 40).toLowerCase();
    if (!['credited', 'reversed'].includes(nextStatus)) {
      return res.status(400).json({ success: false, message: 'Unsupported referral status update' });
    }

    if (nextStatus === referral.status) {
      return res.json({ success: true, message: 'Referral already has this status', data: serializeReferral(referral) });
    }

    const amount = roundMoney(referral.bonusAmount || 0);
    const referenceType = referral.onboardingPaymentId ? 'onboarding_payment' : 'referral';
    const referenceId = toIdString(referral.onboardingPaymentId || referral._id);
    if (nextStatus === 'credited') {
      await User.updateOne(
        { _id: referral.referrerAgentId },
        {
          $inc: {
            balance: amount,
            referralBalance: amount,
            totalEarnings: amount,
            totalEarned: amount
          }
        }
      );
      await AgentTransaction.findOneAndUpdate(
        {
          agentId: referral.referrerAgentId,
          type: 'referral_bonus',
          referenceType,
          referenceId
        },
        {
          $set: {
            amount,
            status: 'completed',
            note: 'Referral bonus credited by admin'
          }
        },
        { upsert: true, new: true }
      );
      referral.status = 'credited';
      referral.paidAt = new Date();
      referral.reversedAt = null;
    } else {
      if (referral.status === 'credited') {
        await User.updateOne(
          { _id: referral.referrerAgentId },
          {
            $inc: {
              balance: -amount,
              referralBalance: -amount,
              totalEarnings: -amount,
              totalEarned: -amount
            }
          }
        );
      }
      await AgentTransaction.findOneAndUpdate(
        {
          agentId: referral.referrerAgentId,
          type: 'referral_bonus',
          referenceType,
          referenceId
        },
        {
          $set: {
            amount,
            status: 'reversed',
            note: 'Referral bonus reversed by admin'
          }
        },
        { upsert: true, new: true }
      );
      referral.status = 'reversed';
      referral.reversedAt = new Date();
    }

    await referral.save();
    await syncReferralMilestones(referral.referrerAgentId);
    const freshReferral = await AgentReferral.findById(referral._id)
      .populate('referrerAgentId', 'fullName storeName')
      .populate('referredAgentId', 'fullName storeName phone email agentStatus');
    await recordAdminAudit({
      adminId: req.user._id,
      action: `referral_${nextStatus}`,
      targetType: 'referral',
      targetId: toIdString(referral._id),
      note: `Referral marked as ${nextStatus}`,
      metadata: {
        agentId: toIdString(referral.referrerAgentId),
        referredAgentId: toIdString(referral.referredAgentId),
        status: nextStatus
      }
    });

    return res.json({
      success: true,
      message: `Referral marked as ${nextStatus}`,
      data: serializeReferral(freshReferral)
    });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

export const getAgentReferralMilestones = async (req, res) => {
  try {
    const milestones = await AgentReferralMilestone.find()
      .populate('agentId', 'fullName storeName storeSlug')
      .sort({ milestoneCount: 1, createdAt: -1 });

    return res.json({
      success: true,
      data: milestones.map(serializeMilestone)
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const patchAgentReferralMilestone = async (req, res) => {
  try {
    const milestone = await AgentReferralMilestone.findById(req.params.id);
    if (!milestone) {
      return res.status(404).json({ success: false, message: 'Referral milestone not found' });
    }

    const nextStatus = sanitizeText(req.body?.status, 40).toLowerCase();
    if (!['credited', 'reversed'].includes(nextStatus)) {
      return res.status(400).json({ success: false, message: 'Unsupported milestone status update' });
    }

    const paidReferralCount = (await getReferralMilestoneProgress(milestone.agentId)).paidReferralCount;
    if (nextStatus === 'credited' && paidReferralCount < milestone.milestoneCount) {
      return res.status(400).json({
        success: false,
        message: 'This milestone cannot be credited before the paid referral target is reached'
      });
    }

    const amount = roundMoney(milestone.bonusAmount || 0);
    if (nextStatus === 'credited' && milestone.status !== 'credited') {
      await User.updateOne(
        { _id: milestone.agentId },
        {
          $inc: {
            balance: amount,
            referralBalance: amount,
            totalEarnings: amount,
            totalEarned: amount
          }
        }
      );
      await AgentTransaction.findOneAndUpdate(
        {
          agentId: milestone.agentId,
          type: 'referral_milestone_bonus',
          referenceType: 'referral_milestone',
          referenceId: toIdString(milestone._id)
        },
        {
          $set: {
            amount,
            status: 'completed',
            note: 'Referral milestone bonus credited by admin',
            metadata: {
              milestoneCount: milestone.milestoneCount,
              sourceReferralCount: paidReferralCount
            }
          }
        },
        { upsert: true, new: true }
      );
      milestone.status = 'credited';
      milestone.achievedAt = milestone.achievedAt || new Date();
      milestone.paidAt = new Date();
      milestone.reversedAt = null;
      milestone.sourceReferralCount = paidReferralCount;
    }

    if (nextStatus === 'reversed' && milestone.status === 'credited') {
      await User.updateOne(
        { _id: milestone.agentId },
        {
          $inc: {
            balance: -amount,
            referralBalance: -amount,
            totalEarnings: -amount,
            totalEarned: -amount
          }
        }
      );
      await AgentTransaction.findOneAndUpdate(
        {
          agentId: milestone.agentId,
          type: 'referral_milestone_bonus',
          referenceType: 'referral_milestone',
          referenceId: toIdString(milestone._id)
        },
        {
          $set: {
            amount,
            status: 'reversed',
            note: 'Referral milestone bonus reversed by admin',
            metadata: {
              milestoneCount: milestone.milestoneCount,
              sourceReferralCount: paidReferralCount
            }
          }
        },
        { upsert: true, new: true }
      );
      milestone.status = 'reversed';
      milestone.reversedAt = new Date();
      milestone.sourceReferralCount = paidReferralCount;
    }

    await milestone.save();
    await recordAdminAudit({
      adminId: req.user._id,
      action: `referral_milestone_${nextStatus}`,
      targetType: 'referral_milestone',
      targetId: toIdString(milestone._id),
      note: `Milestone ${milestone.milestoneCount} marked as ${nextStatus}`,
      metadata: {
        agentId: toIdString(milestone.agentId),
        milestoneCount: milestone.milestoneCount,
        status: nextStatus
      }
    });

    const freshMilestone = await AgentReferralMilestone.findById(milestone._id)
      .populate('agentId', 'fullName storeName storeSlug');
    return res.json({
      success: true,
      message: `Milestone marked as ${nextStatus}`,
      data: serializeMilestone(freshMilestone)
    });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

export const getNetworkStatus = async (req, res) => {
  const networkStatus = await getNetworkStatusSetting();
  res.json({ success: true, ...networkStatus });
};

export const setNetworkStatus = async (req, res) => {
  try {
    const { status, message } = req.body;
    if (!status || !['green', 'yellow', 'red'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const networkStatus = await setNetworkStatusSetting({ status, message }, req.user._id);
    await recordAdminAudit({
      adminId: req.user._id,
      action: 'network_status_updated',
      targetType: 'network_status',
      targetId: 'network_status',
      note: `Network status changed to ${networkStatus.status}`,
      metadata: networkStatus
    });

    res.json({ success: true, message: 'Status updated', data: networkStatus, ...networkStatus });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};
