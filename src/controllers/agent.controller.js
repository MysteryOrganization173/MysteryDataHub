import { User } from '../models/User.js';
import { Order } from '../models/Order.js';
import { Withdrawal } from '../models/Withdrawal.js';
import { Bundle } from '../models/Bundle.js';
import { calculateCommission } from '../services/commission.service.js';

export const getDashboard = async (req, res) => {
  try {
    const agent = req.user;
    const orders = await Order.find({ agentId: agent._id }).sort('-createdAt').limit(50);
    const withdrawals = await Withdrawal.find({ agentId: agent._id }).sort('-createdAt');
    const bundles = await Bundle.find({ active: true });

    const stats = {
      totalEarnings: agent.totalEarnings,
      totalSales: agent.totalSales,
      availableBalance: agent.balance,
      monthlyEarnings: orders.filter(o => o.createdAt > new Date(Date.now() - 30*24*60*60*1000))
                            .reduce((sum, o) => sum + (o.agentProfit || 0), 0)
    };

    res.json({
      success: true,
      data: {
        agent,
        stats,
        recentOrders: orders.slice(0, 10),
        recentWithdrawals: withdrawals.slice(0, 5),
        products: bundles.map(b => ({
          id: b._id,
          code: b.code,
          operator: b.operator,
          name: `${b.size} - ${b.validity}`,
          data_amount: b.size,
          validity: b.validity,
          basePrice: b.basePrice,
          defaultAgentPrice: b.defaultAgentPrice,
          agentPrice: agent.customPrices?.get(b.code) || b.defaultAgentPrice,
          markup: (agent.customPrices?.get(b.code) || b.defaultAgentPrice) - b.basePrice,
          margin: ((agent.customPrices?.get(b.code) || b.defaultAgentPrice) - b.basePrice) / b.basePrice * 100
        }))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Updated updatePrices with array validation
export const updatePrices = async (req, res) => {
  try {
    const { prices } = req.body; // array of { code, agentPrice }
    if (!Array.isArray(prices)) {
      return res.status(400).json({ success: false, message: 'Invalid prices format' });
    }
    for (let p of prices) {
      req.user.customPrices.set(p.code, p.agentPrice);
    }
    await req.user.save();
    res.json({ success: true, message: 'Prices updated', updatedCount: prices.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const requestWithdrawal = async (req, res) => {
  try {
    const { amount, momoNumber } = req.body;
    if (amount < 15) return res.status(400).json({ success: false, message: 'Minimum withdrawal is ₵15' });
    if (amount > req.user.balance) return res.status(400).json({ success: false, message: 'Insufficient balance' });

    const fee = 0.5;
    const netAmount = amount - fee;

    const withdrawal = await Withdrawal.create({
      agentId: req.user._id,
      amount,
      fee,
      netAmount,
      momoNumber: momoNumber || req.user.momoNumber,
      status: 'pending'
    });

    // Do not deduct balance yet – deduct only when approved
    res.json({ success: true, message: 'Withdrawal request submitted', transactionId: withdrawal._id });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({ agentId: req.user._id }).sort('-createdAt');
    res.json({ success: true, data: withdrawals });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Other endpoints (profile update, password, etc.) follow similar pattern