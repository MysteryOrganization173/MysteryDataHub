import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { createAgentRegistrationAndPayment, serializeAgent } from '../services/agent-onboarding.service.js';
import { normalizePhone } from '../utils/agent.utils.js';

function generateToken(id, role = 'agent') {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });
}

export const registerAgent = async (req, res, next) => {
  try {
    const { agent, payment, authorizationUrl, storeLink } = await createAgentRegistrationAndPayment(req.body || {});

    return res.status(201).json({
      success: true,
      message: 'Registration started. Complete the one-time ₵75 payment to activate your agent account.',
      data: {
        agent: serializeAgent(agent),
        payment: {
          reference: payment.reference,
          amount: payment.amount,
          status: payment.status
        },
        authorizationUrl,
        authorization_url: authorizationUrl,
        storeLink,
        requiresPayment: true
      }
    });
  } catch (error) {
    return next(error);
  }
};

export const loginAgent = async (req, res, next) => {
  try {
    const phone = normalizePhone(req.body?.phone);
    const password = String(req.body?.password || '');
    if (!phone || !password) {
      return res.status(400).json({ success: false, message: 'Phone number and password are required' });
    }

    const user = await User.findOne({ phone, role: 'agent' });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid phone number or password' });
    }

    if (user.agentStatus !== 'active' || !user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your agent account is not active yet. Complete the onboarding payment to continue.',
        data: {
          agentStatus: user.agentStatus
        }
      });
    }

    user.lastLogin = new Date();
    await user.save();

    return res.json({
      success: true,
      message: 'Login successful',
      data: {
        token: generateToken(user._id, user.role),
        agent: serializeAgent(user)
      }
    });
  } catch (error) {
    return next(error);
  }
};

export const loginAdmin = async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const adminUser = await User.findOne({ email, role: 'admin' });
    if (!adminUser || !(await adminUser.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    if (!adminUser.isActive) {
      return res.status(403).json({ success: false, message: 'Your admin account is not active right now.' });
    }

    return res.json({
      success: true,
      data: {
        token: generateToken(adminUser._id, adminUser.role)
      }
    });
  } catch (error) {
    return next(error);
  }
};
