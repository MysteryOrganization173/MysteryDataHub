import { AgentPricingRule } from '../models/AgentPricingRule.js';
import { AgentReferral } from '../models/AgentReferral.js';
import { AgentTransaction } from '../models/AgentTransaction.js';
import { Order } from '../models/Order.js';
import { User } from '../models/User.js';
import { Withdrawal } from '../models/Withdrawal.js';
import {
  createWithdrawalLedgerEntry,
  getReferralMilestoneProgress,
  getReservedWithdrawalAmount
} from '../services/agent-accounting.service.js';
import { calculateWithdrawalPreview, getWithdrawalConfig } from '../services/agent-program.service.js';
import {
  buildPublicStoreDataBySlug,
  bulkUpdateAgentPricing,
  getAgentPricingView,
  getAgentStoreSettingsView,
  getVisibleStoreProducts,
  resetAgentPricing,
  updateAgentPricingRule,
  updateAgentStore,
  updateAgentStoreSettings
} from '../services/agent-pricing.service.js';
import { serializeAgent, verifyAgentOnboardingPayment } from '../services/agent-onboarding.service.js';
import {
  AGENT_MIN_WITHDRAWAL_GHS,
  buildStoreLink,
  getFrontendBaseUrl,
  normalizeEmail,
  normalizeMoMoNumber,
  parsePositiveAmount,
  roundMoney,
  sanitizeText,
  toIdString
} from '../utils/agent.utils.js';

function serializeOrder(orderInput) {
  const order = orderInput?.toObject ? orderInput.toObject() : orderInput;
  return {
    id: toIdString(order._id || order.id),
    orderId: order.orderId,
    reference: order.reference,
    customerPhone: order.customerPhone,
    customerEmail: order.customerEmail || '',
    network: order.network,
    tier: order.catalogTier,
    tierLabel: order.tierLabel || order.catalogTier,
    bundleSize: order.catalogVolume,
    bundleCode: order.bundleCode,
    bundleName: order.bundleName,
    sellingPrice: roundMoney(order.sellingPrice || order.amount || 0),
    wholesaleCost: roundMoney(order.wholesaleCost || 0),
    floorPrice: roundMoney(order.floorPrice || 0),
    profit: roundMoney(order.agentProfit || 0),
    profitStatus: order.profitStatus || 'none',
    paymentStatus: order.paymentStatus,
    deliveryStatus: order.deliveryStatus,
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt
  };
}

function serializeWithdrawal(withdrawalInput) {
  const withdrawal = withdrawalInput?.toObject ? withdrawalInput.toObject() : withdrawalInput;
  return {
    id: toIdString(withdrawal._id || withdrawal.id),
    requestedAmount: roundMoney(withdrawal.amount || 0),
    amount: roundMoney(withdrawal.amount || 0),
    withdrawalFee: roundMoney(withdrawal.fee || 0),
    fee: roundMoney(withdrawal.fee || 0),
    netPayout: roundMoney(withdrawal.netAmount || 0),
    netAmount: roundMoney(withdrawal.netAmount || 0),
    payoutMethod: withdrawal.payoutMethod || 'momo',
    momoNumber: withdrawal.momoNumber,
    status: withdrawal.status,
    adminNote: withdrawal.adminNote || '',
    payoutReference: withdrawal.payoutReference || '',
    createdAt: withdrawal.createdAt,
    approvedAt: withdrawal.approvedAt,
    paidAt: withdrawal.paidAt
  };
}

function serializeMilestone(milestoneInput) {
  const milestone = milestoneInput?.toObject ? milestoneInput.toObject() : milestoneInput;
  return {
    milestoneCount: Number(milestone.milestoneCount || 0),
    bonusAmount: roundMoney(milestone.bonusAmount || 0),
    status: milestone.status || 'pending',
    achievedAt: milestone.achievedAt || null,
    paidAt: milestone.paidAt || null,
    reversedAt: milestone.reversedAt || null,
    sourceReferralCount: Number(milestone.sourceReferralCount || 0),
    progressPercent: roundMoney(milestone.progressPercent || 0)
  };
}

function serializeTransaction(transactionInput) {
  const transaction = transactionInput?.toObject ? transactionInput.toObject() : transactionInput;
  return {
    id: toIdString(transaction._id || transaction.id),
    type: transaction.type,
    amount: roundMoney(transaction.amount || 0),
    status: transaction.status,
    referenceType: transaction.referenceType,
    referenceId: transaction.referenceId,
    note: transaction.note || '',
    createdAt: transaction.createdAt
  };
}

function serializeReferral(referralInput) {
  const referral = referralInput?.toObject ? referralInput.toObject() : referralInput;
  const referredAgent = referral.referredAgentId || {};
  return {
    id: toIdString(referral._id || referral.id),
    bonusAmount: roundMoney(referral.bonusAmount || 0),
    status: referral.status,
    paidAt: referral.paidAt,
    createdAt: referral.createdAt,
    referredAgent: {
      id: toIdString(referredAgent._id || referredAgent.id),
      fullName: referredAgent.fullName || '',
      storeName: referredAgent.storeName || '',
      phone: referredAgent.phone || '',
      email: referredAgent.email || '',
      agentStatus: referredAgent.agentStatus || ''
    }
  };
}

async function getSpendableBalance(agentId, currentBalance) {
  const reservedWithdrawals = await getReservedWithdrawalAmount(agentId);
  return {
    reservedWithdrawals,
    spendableBalance: roundMoney(Math.max(roundMoney(currentBalance || 0) - reservedWithdrawals, 0))
  };
}

export const logoutAgent = async (req, res) => {
  return res.json({
    success: true,
    message: 'Logged out successfully'
  });
};

export const getAgentProfile = async (req, res) => {
  const { reservedWithdrawals, spendableBalance } = await getSpendableBalance(req.user._id, req.user.balance);
  return res.json({
    success: true,
    data: {
      agent: serializeAgent(req.user),
      financials: {
        spendableBalance,
        pendingBalance: roundMoney(req.user.pendingBalance || 0),
        referralBalance: roundMoney(req.user.referralBalance || 0),
        totalEarned: roundMoney(req.user.totalEarned || req.user.totalEarnings || 0),
        reservedWithdrawals
      }
    }
  });
};

export const updateAgentProfile = async (req, res, next) => {
  try {
    const nextEmail = req.body?.email !== undefined ? normalizeEmail(req.body.email) : '';
    const nextStoreName = req.body?.storeName !== undefined ? sanitizeText(req.body.storeName, 80) : '';
    const nextFullName = req.body?.fullName !== undefined ? sanitizeText(req.body.fullName, 80) : '';
    const nextLocation = req.body?.location !== undefined ? sanitizeText(req.body.location, 80) : '';
    const nextMoMoNumber = req.body?.momoNumber !== undefined ? normalizeMoMoNumber(req.body.momoNumber) : '';

    if (req.body?.email !== undefined && !nextEmail) {
      return res.status(400).json({ success: false, message: 'A valid email address is required' });
    }
    if (req.body?.momoNumber !== undefined && !nextMoMoNumber) {
      return res.status(400).json({ success: false, message: 'A valid Ghana MoMo number is required' });
    }

    if (nextEmail && nextEmail !== req.user.email) {
      const existing = await User.findOne({ email: nextEmail, _id: { $ne: req.user._id } });
      if (existing) {
        return res.status(409).json({ success: false, message: 'Email address is already in use' });
      }
      req.user.email = nextEmail;
    }

    if (nextStoreName) req.user.storeName = nextStoreName;
    if (nextFullName) req.user.fullName = nextFullName;
    if (nextLocation || req.body?.location === '') req.user.location = nextLocation;
    if (nextMoMoNumber) req.user.momoNumber = nextMoMoNumber;

    await req.user.save();

    return res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        agent: serializeAgent(req.user)
      }
    });
  } catch (error) {
    return next(error);
  }
};

export const verifyOnboardingPayment = async (req, res, next) => {
  try {
    const reference = String(req.params.reference || req.query.reference || '').trim();
    const result = await verifyAgentOnboardingPayment(reference);
    return res.json({
      success: true,
      message: 'Agent payment verified successfully',
      data: {
        agent: serializeAgent(result.agent),
        payment: {
          reference: result.payment.reference,
          amount: result.payment.amount,
          status: result.payment.status
        }
      }
    });
  } catch (error) {
    return next(error);
  }
};

export const getDashboard = async (req, res, next) => {
  try {
    const [pricingView, recentOrders, recentWithdrawals, recentTransactions, referrals, totalOrders, milestoneProgress, withdrawalConfig] = await Promise.all([
      getAgentPricingView(req.user._id),
      Order.find({ agentId: req.user._id }).sort({ createdAt: -1 }).limit(12).lean(),
      Withdrawal.find({ agentId: req.user._id }).sort({ createdAt: -1 }).limit(12).lean(),
      AgentTransaction.find({ agentId: req.user._id }).sort({ createdAt: -1 }).limit(20).lean(),
      AgentReferral.find({ referrerAgentId: req.user._id }).populate('referredAgentId', 'fullName storeName phone email agentStatus').sort({ createdAt: -1 }).lean(),
      Order.countDocuments({ agentId: req.user._id }),
      getReferralMilestoneProgress(req.user._id),
      getWithdrawalConfig()
    ]);

    const visibleProducts = await getVisibleStoreProducts(req.user);
    const { reservedWithdrawals, spendableBalance } = await getSpendableBalance(req.user._id, req.user.balance);
    const referralBonusEarnings = referrals
      .filter((referral) => referral.status === 'credited')
      .reduce((sum, referral) => sum + roundMoney(referral.bonusAmount || 0), 0);
    const referralEarnings = roundMoney(referralBonusEarnings + milestoneProgress.totalMilestoneEarnings);
    const withdrawalPreview = calculateWithdrawalPreview(0, withdrawalConfig);

    return res.json({
      success: true,
      data: {
        agent: serializeAgent(req.user),
        balances: {
          available: spendableBalance,
          pending: roundMoney(req.user.pendingBalance || 0),
          reservedWithdrawals,
          totalEarned: roundMoney(req.user.totalEarned || req.user.totalEarnings || 0),
          referralEarnings
        },
        store: {
          storeEnabled: Boolean(req.user.storeEnabled),
          storeSlug: req.user.storeSlug,
          storeLink: buildStoreLink(getFrontendBaseUrl(), req.user.storeSlug)
        },
        counts: {
          totalOrders,
          liveProducts: visibleProducts.length,
          referrals: referrals.length,
          paidReferrals: milestoneProgress.paidReferralCount
        },
        withdrawalRules: {
          ...withdrawalPreview,
          minimumAmount: roundMoney(withdrawalConfig.minimumAmount),
          note: withdrawalConfig.note
        },
        recentOrders: recentOrders.map(serializeOrder),
        recentWithdrawals: recentWithdrawals.map(serializeWithdrawal),
        recentTransactions: recentTransactions.map(serializeTransaction),
        pricing: {
          filters: pricingView.filters,
          groups: pricingView.groups,
          products: pricingView.products
        },
        visibleStoreProducts: visibleProducts,
        referrals: referrals.map(serializeReferral),
        referralMilestones: {
          ...milestoneProgress,
          milestones: milestoneProgress.milestones.map(serializeMilestone)
        }
      }
    });
  } catch (error) {
    return next(error);
  }
};

export const getStore = async (req, res, next) => {
  try {
    const publicStore = await buildPublicStoreDataBySlug(req.user.storeSlug);
    const settings = await getAgentStoreSettingsView(req.user);

    return res.json({
      success: true,
      data: {
        agent: serializeAgent(req.user),
        store: publicStore?.store || {
          enabled: Boolean(req.user.storeEnabled),
          link: buildStoreLink(getFrontendBaseUrl(), req.user.storeSlug)
        },
        networks: publicStore?.networks || [],
        products: publicStore?.products || [],
        settings
      }
    });
  } catch (error) {
    return next(error);
  }
};

export const updateStore = async (req, res, next) => {
  try {
    const settings = await updateAgentStore(req.user, req.body || {});
    return res.json({
      success: true,
      message: 'Store settings updated successfully',
      data: settings
    });
  } catch (error) {
    return next(error);
  }
};

export const getStoreLink = async (req, res) => {
  return res.json({
    success: true,
    data: {
      storeSlug: req.user.storeSlug,
      storeLink: buildStoreLink(getFrontendBaseUrl(), req.user.storeSlug),
      referralCode: req.user.referralCode
    }
  });
};

export const getStoreSettings = async (req, res, next) => {
  try {
    const settings = await getAgentStoreSettingsView(req.user);
    return res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    return next(error);
  }
};

export const putStoreSettings = async (req, res, next) => {
  try {
    const settings = await updateAgentStoreSettings(req.user._id, req.body?.settings || req.body);
    return res.json({
      success: true,
      message: 'Store visibility updated successfully',
      data: settings
    });
  } catch (error) {
    return next(error);
  }
};

export const getPricing = async (req, res, next) => {
  try {
    const pricingView = await getAgentPricingView(req.user._id);
    return res.json({
      success: true,
      data: pricingView
    });
  } catch (error) {
    return next(error);
  }
};

export const createPricing = async (req, res, next) => {
  try {
    const pricingView = await bulkUpdateAgentPricing(req.user._id, req.body?.prices || []);
    return res.json({
      success: true,
      message: 'Pricing rules saved successfully',
      data: pricingView
    });
  } catch (error) {
    return next(error);
  }
};

export const updatePricing = async (req, res, next) => {
  try {
    const rule = await updateAgentPricingRule(req.user._id, req.params.id, req.body || {});
    if (!rule) {
      return res.status(404).json({ success: false, message: 'Pricing rule not found' });
    }
    return res.json({
      success: true,
      message: 'Pricing rule updated successfully',
      data: rule
    });
  } catch (error) {
    return next(error);
  }
};

export const deletePricing = async (req, res, next) => {
  try {
    const rule = await updateAgentPricingRule(req.user._id, req.params.id, { customRetailPrice: null, isActive: true });
    if (!rule) {
      return res.status(404).json({ success: false, message: 'Pricing rule not found' });
    }
    return res.json({
      success: true,
      message: 'Custom pricing removed. Suggested pricing is active again.',
      data: rule
    });
  } catch (error) {
    return next(error);
  }
};

export const resetPricing = async (req, res, next) => {
  try {
    const productKeys = Array.isArray(req.body?.productKeys) ? req.body.productKeys : [];
    const pricingView = await resetAgentPricing(req.user._id, productKeys);
    return res.json({
      success: true,
      message: 'Pricing reset to system pricing',
      data: pricingView
    });
  } catch (error) {
    return next(error);
  }
};

export const getOrders = async (req, res, next) => {
  try {
    const status = sanitizeText(req.query.status, 40).toLowerCase();
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const query = { agentId: req.user._id };

    if (status) {
      query.$or = [
        { status },
        { paymentStatus: status },
        { deliveryStatus: status },
        { profitStatus: status }
      ];
    }

    const orders = await Order.find(query).sort({ createdAt: -1 }).limit(limit).lean();
    return res.json({
      success: true,
      data: orders.map(serializeOrder)
    });
  } catch (error) {
    return next(error);
  }
};

export const getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, agentId: req.user._id }).lean();
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    return res.json({
      success: true,
      data: serializeOrder(order)
    });
  } catch (error) {
    return next(error);
  }
};

export const getReferrals = async (req, res, next) => {
  try {
    const [referrals, milestoneProgress] = await Promise.all([
      AgentReferral.find({ referrerAgentId: req.user._id })
        .populate('referredAgentId', 'fullName storeName phone email agentStatus')
        .sort({ createdAt: -1 })
        .lean(),
      getReferralMilestoneProgress(req.user._id)
    ]);

    return res.json({
      success: true,
      data: {
        summary: {
          totalReferrals: referrals.length,
          creditedReferrals: referrals.filter((referral) => referral.status === 'credited').length,
          referralEarnings: roundMoney(
            referrals
              .filter((referral) => referral.status === 'credited')
              .reduce((sum, referral) => sum + Number(referral.bonusAmount || 0), 0)
          ),
          milestoneEarnings: roundMoney(milestoneProgress.totalMilestoneEarnings || 0),
          paidReferrals: milestoneProgress.paidReferralCount,
          referralLink: `${getFrontendBaseUrl()}/agent-register.html?ref=${encodeURIComponent(req.user.referralCode)}`
        },
        referrals: referrals.map(serializeReferral),
        milestones: milestoneProgress.milestones.map(serializeMilestone),
        nextMilestone: milestoneProgress.nextMilestone
          ? {
              milestoneCount: milestoneProgress.nextMilestone.milestoneCount,
              bonusAmount: roundMoney(milestoneProgress.nextMilestone.bonusAmount),
              remainingReferrals: milestoneProgress.nextMilestone.remainingReferrals
            }
          : null
      }
    });
  } catch (error) {
    return next(error);
  }
};

export const getReferralMilestones = async (req, res, next) => {
  try {
    const milestoneProgress = await getReferralMilestoneProgress(req.user._id);
    return res.json({
      success: true,
      data: {
        paidReferralCount: milestoneProgress.paidReferralCount,
        totalMilestoneEarnings: roundMoney(milestoneProgress.totalMilestoneEarnings),
        nextMilestone: milestoneProgress.nextMilestone,
        milestones: milestoneProgress.milestones.map(serializeMilestone)
      }
    });
  } catch (error) {
    return next(error);
  }
};

export const getTransactions = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 300);
    const transactions = await AgentTransaction.find({ agentId: req.user._id }).sort({ createdAt: -1 }).limit(limit).lean();
    return res.json({
      success: true,
      data: transactions.map(serializeTransaction)
    });
  } catch (error) {
    return next(error);
  }
};

export const requestWithdrawal = async (req, res, next) => {
  try {
    const amount = parsePositiveAmount(req.body?.amount);
    const momoNumber = normalizeMoMoNumber(req.body?.momoNumber || req.user.momoNumber);
    const payoutMethod = sanitizeText(req.body?.payoutMethod || 'momo', 20).toLowerCase() || 'momo';
    const withdrawalConfig = await getWithdrawalConfig();
    const preview = calculateWithdrawalPreview(amount, withdrawalConfig);

    if (!amount) {
      return res.status(400).json({ success: false, message: 'A valid withdrawal amount is required' });
    }
    if (amount < roundMoney(withdrawalConfig.minimumAmount || AGENT_MIN_WITHDRAWAL_GHS)) {
      return res.status(400).json({
        success: false,
        message: `Minimum withdrawal is ₵${roundMoney(withdrawalConfig.minimumAmount || AGENT_MIN_WITHDRAWAL_GHS).toFixed(2)}`
      });
    }
    if (payoutMethod === 'momo' && !momoNumber) {
      return res.status(400).json({ success: false, message: 'A valid MoMo number is required' });
    }
    if (payoutMethod === 'bank') {
      const accountName = sanitizeText(req.body?.accountName, 80);
      const accountNumber = sanitizeText(req.body?.accountNumber, 40);
      const bankName = sanitizeText(req.body?.bankName, 80);
      if (!accountName || !accountNumber || !bankName) {
        return res.status(400).json({
          success: false,
          message: 'Account name, account number, and bank name are required for bank payouts'
        });
      }
    }
    if (preview.netPayout <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Withdrawal fee is higher than the amount requested'
      });
    }

    const { spendableBalance, reservedWithdrawals } = await getSpendableBalance(req.user._id, req.user.balance);
    if (amount > spendableBalance) {
      return res.status(400).json({
        success: false,
        message: 'Withdrawal amount is higher than your available balance'
      });
    }

    const withdrawal = await Withdrawal.create({
      agentId: req.user._id,
      amount: preview.requestedAmount,
      fee: preview.withdrawalFee,
      netAmount: preview.netPayout,
      payoutMethod,
      momoNumber,
      accountName: sanitizeText(req.body?.accountName, 80),
      accountNumber: sanitizeText(req.body?.accountNumber, 40),
      bankName: sanitizeText(req.body?.bankName, 80),
      status: 'pending'
    });

    await createWithdrawalLedgerEntry(withdrawal);

    return res.status(201).json({
      success: true,
      message: 'Withdrawal request submitted successfully',
      data: {
        withdrawal: serializeWithdrawal(withdrawal),
        preview,
        financials: {
          spendableBalance: roundMoney(spendableBalance - amount),
          reservedWithdrawals: roundMoney(reservedWithdrawals + amount)
        }
      }
    });
  } catch (error) {
    return next(error);
  }
};

export const getWithdrawals = async (req, res, next) => {
  try {
    const withdrawals = await Withdrawal.find({ agentId: req.user._id }).sort({ createdAt: -1 }).lean();
    return res.json({
      success: true,
      data: withdrawals.map(serializeWithdrawal)
    });
  } catch (error) {
    return next(error);
  }
};

export const getPublicStore = async (req, res, next) => {
  try {
    const storeSlug = String(req.params.storeSlug || req.query.store || '').trim().toLowerCase();
    const store = await buildPublicStoreDataBySlug(storeSlug);
    if (!store || !store.store?.enabled) {
      return res.status(404).json({ success: false, message: 'Agent store not found' });
    }
    return res.json({
      success: true,
      data: store
    });
  } catch (error) {
    return next(error);
  }
};