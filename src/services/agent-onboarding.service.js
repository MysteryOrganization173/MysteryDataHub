import crypto from 'crypto';
import axios from 'axios';
import { AgentOnboardingPayment } from '../models/AgentOnboardingPayment.js';
import { AgentReferral } from '../models/AgentReferral.js';
import { User } from '../models/User.js';
import { creditReferralBonusForOnboarding } from './agent-accounting.service.js';
import {
  AGENT_ONBOARDING_FEE_GHS,
  buildStoreLink,
  getFrontendBaseUrl,
  normalizeEmail,
  normalizeMoMoNumber,
  normalizePhone,
  roundMoney,
  sanitizeText,
  slugify,
  toIdString
} from '../utils/agent.utils.js';

function getPaystackBaseUrl() {
  return String(process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co').trim().replace(/\/$/, '');
}

function getPaystackSecretKey() {
  return String(process.env.PAYSTACK_SECRET_KEY || '').trim();
}

function requirePaystackSecretKey() {
  const key = getPaystackSecretKey();
  if (!key) {
    const error = new Error('Paystack secret key is missing in environment variables');
    error.status = 503;
    throw error;
  }
  return key;
}

function generateOnboardingReference() {
  return `MBA-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

function isValidVerifiedPayment(reference, payment, expectedAmount) {
  if (!payment || payment.status !== 'success') return false;
  if (payment.reference !== reference) return false;
  if (String(payment.currency || '').toUpperCase() !== 'GHS') return false;
  return Number(payment.amount || 0) === Math.round(expectedAmount * 100);
}

export function serializeAgent(agentInput) {
  const agent = agentInput?.toObject ? agentInput.toObject() : agentInput;
  if (!agent) return null;

  return {
    id: toIdString(agent._id || agent.id),
    fullName: agent.fullName,
    name: agent.fullName,
    email: agent.email,
    phone: agent.phone,
    location: agent.location,
    momoNumber: agent.momoNumber,
    role: agent.role,
    storeName: agent.storeName,
    storeSlug: agent.storeSlug,
    storeEnabled: Boolean(agent.storeEnabled),
    referralCode: agent.referralCode,
    referredBy: agent.referredBy ? toIdString(agent.referredBy) : null,
    agentStatus: agent.agentStatus,
    isActive: Boolean(agent.isActive),
    balance: roundMoney(agent.balance || 0),
    pendingBalance: roundMoney(agent.pendingBalance || 0),
    referralBalance: roundMoney(agent.referralBalance || 0),
    totalEarnings: roundMoney(agent.totalEarnings || 0),
    totalEarned: roundMoney(agent.totalEarned || 0),
    totalSales: roundMoney(agent.totalSales || 0),
    totalOrders: Number(agent.totalOrders || 0),
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt
  };
}

async function generateUniqueReferralCode() {
  let referralCode = crypto.randomBytes(4).toString('hex').toUpperCase();
  while (await User.exists({ referralCode })) {
    referralCode = crypto.randomBytes(4).toString('hex').toUpperCase();
  }
  return referralCode;
}

async function generateUniqueStoreSlug(seed) {
  const baseSlug = slugify(seed, 'agent-store');
  let storeSlug = baseSlug;
  let counter = 2;

  while (await User.exists({ storeSlug })) {
    storeSlug = `${baseSlug}-${counter}`;
    counter += 1;
  }

  return storeSlug;
}

function buildOnboardingCallbackUrl() {
  return `${getFrontendBaseUrl()}/payment-agent.html?flow=agent-onboarding`;
}

export async function createAgentRegistrationAndPayment(input) {
  const fullName = sanitizeText(input.fullName, 80);
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  const password = String(input.password || '');
  const location = sanitizeText(input.location, 80);
  const momoNumber = normalizeMoMoNumber(input.momoNumber || input.phone);
  const storeName = sanitizeText(input.storeName || `${fullName.split(' ')[0] || 'Agent'} Store`, 80);
  const currentBusiness = sanitizeText(input.currentBusiness || input.business, 120);
  const experience = sanitizeText(input.experience, 400);
  const reason = sanitizeText(input.reason || input.whyAgent, 400);
  const expectedVolume = sanitizeText(input.expectedVolume, 80);
  const referralCodeInput = sanitizeText(input.referralCode, 24).toUpperCase();

  if (!fullName || !email || !phone || !password || password.length < 6 || !location || !momoNumber) {
    const error = new Error('Full name, email, phone, location, MoMo number, and a 6+ character password are required');
    error.status = 400;
    throw error;
  }

  const existing = await User.findOne({ $or: [{ email }, { phone }] });
  if (existing) {
    const error = new Error('An account already exists with this email or phone number');
    error.status = 409;
    throw error;
  }

  const referrer = referralCodeInput
    ? await User.findOne({ referralCode: referralCodeInput, role: 'agent' }).select('_id referralCode agentStatus')
    : null;

  if (referralCodeInput && !referrer) {
    const error = new Error('Referral code was not found');
    error.status = 404;
    throw error;
  }

  const referralCode = await generateUniqueReferralCode();
  const storeSlug = await generateUniqueStoreSlug(storeName);

  const agent = await User.create({
    fullName,
    email,
    phone,
    password,
    role: 'agent',
    storeName,
    storeSlug,
    storeEnabled: true,
    location,
    momoNumber,
    currentBusiness,
    experience,
    reason,
    expectedVolume,
    referralCode,
    referredBy: referrer?._id || null,
    agentStatus: 'pending_payment',
    isActive: false
  });

  const payment = await AgentOnboardingPayment.create({
    agentId: agent._id,
    reference: generateOnboardingReference(),
    amount: AGENT_ONBOARDING_FEE_GHS,
    status: 'pending',
    referralCode: referralCodeInput || '',
    referrerAgentId: referrer?._id || null
  });

  if (referrer?._id) {
    await AgentReferral.findOneAndUpdate(
      { referredAgentId: agent._id },
      {
        $set: {
          referrerAgentId: referrer._id,
          referredAgentId: agent._id,
          bonusAmount: 25,
          status: 'pending'
        }
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );
  }

  try {
    const paystackResponse = await axios.post(
      `${getPaystackBaseUrl()}/transaction/initialize`,
      {
        email,
        amount: Math.round(AGENT_ONBOARDING_FEE_GHS * 100),
        currency: 'GHS',
        reference: payment.reference,
        callback_url: buildOnboardingCallbackUrl(),
        metadata: {
          flow: 'agent_onboarding',
          agentId: toIdString(agent._id),
          onboardingPaymentId: toIdString(payment._id),
          storeSlug,
          referralCode: referralCodeInput || '',
          custom_fields: [
            { display_name: 'Agent Name', variable_name: 'agent_name', value: fullName },
            { display_name: 'Phone', variable_name: 'phone', value: phone },
            { display_name: 'Store', variable_name: 'store_name', value: storeName }
          ]
        }
      },
      {
        headers: {
          Authorization: `Bearer ${requirePaystackSecretKey()}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const authorizationUrl = paystackResponse.data?.data?.authorization_url;
    if (!authorizationUrl) {
      throw new Error(paystackResponse.data?.message || 'Paystack did not return an authorization link');
    }

    return {
      agent,
      payment,
      authorizationUrl,
      callbackUrl: buildOnboardingCallbackUrl(),
      storeLink: buildStoreLink(getFrontendBaseUrl(), storeSlug)
    };
  } catch (error) {
    await AgentOnboardingPayment.deleteOne({ _id: payment._id }).catch(() => null);
    await User.deleteOne({ _id: agent._id }).catch(() => null);
    throw error;
  }
}

export async function finalizeAgentOnboardingPayment(reference, paystackTransaction) {
  const payment = await AgentOnboardingPayment.findOne({ reference });
  if (!payment) {
    return null;
  }

  if (payment.status === 'success') {
    const agent = await User.findById(payment.agentId).select('-password');
    return { payment, agent };
  }

  if (!isValidVerifiedPayment(reference, paystackTransaction, payment.amount)) {
    return null;
  }

  const updatedPayment = await AgentOnboardingPayment.findOneAndUpdate(
    {
      _id: payment._id,
      status: 'pending'
    },
    {
      $set: {
        status: 'success',
        paystackResponse: paystackTransaction,
        paidAt: new Date()
      }
    },
    { new: true }
  );

  const paymentDoc = updatedPayment || await AgentOnboardingPayment.findById(payment._id);
  if (!paymentDoc) {
    return null;
  }

  const agent = await User.findOneAndUpdate(
    {
      _id: paymentDoc.agentId,
      role: 'agent'
    },
    {
      $set: {
        agentStatus: 'active',
        isActive: true,
        onboardingPaidAt: paymentDoc.paidAt || new Date()
      }
    },
    {
      new: true
    }
  ).select('-password');

  if (paymentDoc.referrerAgentId) {
    await creditReferralBonusForOnboarding(paymentDoc);
  }

  return {
    payment: paymentDoc,
    agent
  };
}

export async function verifyAgentOnboardingPayment(reference) {
  const payment = await AgentOnboardingPayment.findOne({ reference });
  if (!payment) {
    const error = new Error('Agent payment reference was not found');
    error.status = 404;
    throw error;
  }

  const verificationResponse = await axios.get(
    `${getPaystackBaseUrl()}/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: {
        Authorization: `Bearer ${requirePaystackSecretKey()}`
      }
    }
  );

  const paystackTransaction = verificationResponse.data?.data;
  const result = await finalizeAgentOnboardingPayment(reference, paystackTransaction);
  if (!result) {
    const error = new Error('Agent onboarding payment is not confirmed yet');
    error.status = 402;
    throw error;
  }

  return result;
}
