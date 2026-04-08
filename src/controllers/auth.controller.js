import { User } from '../models/User.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });
};

const DEFAULT_ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@mysterybundlehub.com').toLowerCase();
const AGENT_REGISTRATION_FEE_GHS = 75;

// Agent registration stays pending until the onboarding fee is confirmed.
export const registerAgent = async (req, res) => {
  try {
    const { fullName, email, phone, password, storeName, location, momoNumber, referralCode } = req.body;

    const existing = await User.findOne({ $or: [{ email }, { phone }] });
    if (existing) return res.status(400).json({ success: false, message: 'User already exists' });

    // Generate unique referral code
    let refCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    while (await User.findOne({ referralCode: refCode })) {
      refCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    }

    const agent = await User.create({
      fullName, email, phone, password, storeName, location, momoNumber,
      referralCode: refCode,
      role: 'agent',
      referredBy: referralCode ? (await User.findOne({ referralCode }))?._id : null,
      isActive: false
    });

    // In real implementation, you'd create a Paystack payment link and send to user.
    // For now, we'll return a token and a flag that payment is required.
    const token = generateToken(agent._id);
    res.status(201).json({
      success: true,
      message: `Registration successful. Please pay ₵${AGENT_REGISTRATION_FEE_GHS} to activate your account.`,
      data: { agent, token, requiresPayment: true }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Agent Login
export const loginAgent = async (req, res) => {
  try {
    const { phone, password } = req.body;
    const user = await User.findOne({ phone, role: 'agent' });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account not activated. Please pay the registration fee.' });
    }
    user.lastLogin = new Date();
    await user.save();
    const token = generateToken(user._id);
    res.json({ success: true, data: { agent: user, token } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin Login
export const loginAdmin = async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const { password } = req.body;
    if (email !== DEFAULT_ADMIN_EMAIL) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    const adminUser = await User.findOne({ email, role: 'admin' });
    if (!adminUser || !(await adminUser.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    const token = generateToken(adminUser._id);
    res.json({ success: true, token });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
