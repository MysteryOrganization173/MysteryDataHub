import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

function getInactiveUserMessage(user) {
  if (!user) return 'User not found';
  if (user.role === 'agent') {
    return user.agentStatus === 'pending_payment'
      ? 'Your agent account is not active yet. Complete the onboarding payment to continue.'
      : 'Your agent account is not active right now.';
  }
  if (user.role === 'admin') {
    return 'Your admin account is not active right now.';
  }
  return 'Your account is not active right now.';
}

function isUserActive(user) {
  if (!user) return false;
  if (user.role === 'agent') {
    return Boolean(user.isActive) && user.agentStatus === 'active';
  }
  if (user.role === 'admin') {
    return Boolean(user.isActive);
  }
  return user.isActive !== false;
}

export const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return res.status(401).json({ success: false, message: 'Not authorized' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) return res.status(401).json({ success: false, message: 'User not found' });
    if (!isUserActive(req.user)) {
      return res.status(403).json({
        success: false,
        message: getInactiveUserMessage(req.user)
      });
    }
    next();
  } catch (err) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    next();
  };
};