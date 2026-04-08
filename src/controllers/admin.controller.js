import { User } from '../models/User.js';
import { Order } from '../models/Order.js';
import { Withdrawal } from '../models/Withdrawal.js';

const serializeAgent = (agent) => {
  const plain = agent.toObject ? agent.toObject() : agent;
  return {
    ...plain,
    id: plain._id?.toString?.() || plain.id,
    availableBalance: plain.balance ?? 0
  };
};

const serializeWithdrawal = (withdrawal) => {
  const plain = withdrawal.toObject ? withdrawal.toObject() : withdrawal;
  const agent = plain.agentId || {};
  return {
    ...plain,
    id: plain._id?.toString?.() || plain.id,
    agentId: agent,
    agentName: agent.storeName || agent.fullName || 'Agent',
    agentMomo: agent.momoNumber || plain.momoNumber || 'N/A'
  };
};

const serializeOrder = (order) => {
  const plain = order.toObject ? order.toObject() : order;
  return {
    ...plain,
    id: plain._id?.toString?.() || plain.id
  };
};

export const getAgents = async (req, res) => {
  try {
    const agents = await User.find({ role: 'agent' }).select('-password');
    res.json({ success: true, data: agents.map(serializeAgent) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAgentDetails = async (req, res) => {
  try {
    const agent = await User.findById(req.params.id).select('-password');
    if (!agent) return res.status(404).json({ success: false, message: 'Agent not found' });
    const recentOrders = await Order.find({ agentId: agent._id }).sort('-createdAt').limit(5);
    res.json({ success: true, data: { ...serializeAgent(agent), recentOrders: recentOrders.map(serializeOrder) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const toggleAgentStatus = async (req, res) => {
  try {
    const agent = await User.findById(req.params.id);
    if (!agent) return res.status(404).json({ success: false, message: 'Agent not found' });
    agent.isActive = req.body.isActive;
    await agent.save();
    res.json({ success: true, message: 'Status updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find().populate('agentId', 'fullName storeName momoNumber');
    res.json({ success: true, data: withdrawals.map(serializeWithdrawal) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const approveWithdrawal = async (req, res) => {
  try {
    const withdrawal = await Withdrawal.findById(req.params.id);
    if (!withdrawal) return res.status(404).json({ success: false, message: 'Withdrawal not found' });
    if (withdrawal.status !== 'pending') return res.status(400).json({ success: false, message: 'Already processed' });

    const agent = await User.findById(withdrawal.agentId);
    if (agent.balance < withdrawal.amount) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    agent.balance -= withdrawal.amount;
    await agent.save();

    withdrawal.status = 'approved';
    withdrawal.processedBy = req.user._id;
    withdrawal.processedAt = new Date();
    await withdrawal.save();

    // In real system, you'd trigger a Momo payout here

    res.json({ success: true, message: 'Withdrawal approved' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const rejectWithdrawal = async (req, res) => {
  try {
    const withdrawal = await Withdrawal.findById(req.params.id);
    if (!withdrawal) return res.status(404).json({ success: false, message: 'Withdrawal not found' });
    withdrawal.status = 'rejected';
    await withdrawal.save();
    res.json({ success: true, message: 'Withdrawal rejected' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getOrders = async (req, res) => {
  try {
    const orders = await Order.find().populate('agentId', 'fullName storeName').sort('-createdAt');
    res.json({ success: true, data: orders.map(serializeOrder) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Network status (store in DB or simple in-memory)
let networkStatus = { status: 'green', message: '' };
export const getNetworkStatus = (req, res) => {
  res.json({ success: true, ...networkStatus });
};
export const setNetworkStatus = (req, res) => {
  const { status, message } = req.body;
  if (status && ['green', 'yellow', 'red'].includes(status)) {
    networkStatus = { status, message: message || '' };
    res.json({ success: true, message: 'Status updated' });
  } else {
    res.status(400).json({ success: false, message: 'Invalid status' });
  }
};
