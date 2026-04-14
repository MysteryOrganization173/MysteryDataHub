import crypto from 'crypto';
import axios from 'axios';
import { AgentOnboardingPayment } from '../models/AgentOnboardingPayment.js';
import { Order } from '../models/Order.js';
import { fulfillOrder } from '../services/fulfillment.service.js';
import {
  resolveCatalogSelection,
  resolveLegacyBundleSelection,
  resolveProductKeySelection
} from '../services/catalog.service.js';
import { recordAgentOrderPendingEarnings } from '../services/agent-accounting.service.js';
import { resolveStorefrontSelection } from '../services/agent-pricing.service.js';
import { finalizeAgentOnboardingPayment } from '../services/agent-onboarding.service.js';
import {
  normalizeTierKey,
  roundMoney,
  sanitizeText
} from '../utils/agent.utils.js';

const paystackBase = () => String(process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co').trim();

function paymentLog(level, stage, message, meta = {}) {
  const payload = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  const text = `[payment.${stage}] ${message}${payload}`;
  if (level === 'error') return console.error(text);
  if (level === 'warn') return console.warn(text);
  return console.info(text);
}

function getPaystackSecretKey() {
  return process.env.PAYSTACK_SECRET_KEY?.trim() || '';
}

function requirePaystackSecretKey(stage) {
  const key = getPaystackSecretKey();
  if (!key) {
    paymentLog('error', stage, 'missing paystack secret key', {
      keyPresent: false,
      nodeEnv: process.env.NODE_ENV || 'development'
    });
    throw new Error('Paystack secret key is missing in environment variables');
  }
  return key;
}

function normalizeGhanaPhone(input) {
  if (input === undefined || input === null) return null;
  const digits = String(input).trim().replace(/\D/g, '');
  if (/^233[235]\d{8}$/.test(digits)) return digits;
  if (/^0[235]\d{8}$/.test(digits)) return `233${digits.slice(1)}`;
  return null;
}

function isValidBundleCode(code) {
  if (!code || typeof code !== 'string') return false;
  const c = code.trim();
  return c.length >= 4 && c.length <= 64 && /^[A-Za-z0-9_]+$/.test(c);
}

function normalizeCatalogNetwork(value) {
  const network = String(value || '').trim().toLowerCase();
  return ['mtn', 'airteltigo', 'telecel'].includes(network) ? network : null;
}

function normalizeCatalogTier(value) {
  const tier = normalizeTierKey(value);
  return tier || null;
}

function normalizeCatalogVolume(value) {
  const volume = Number(value);
  return Number.isFinite(volume) && volume > 0 ? volume : null;
}

function isValidReferenceParam(ref) {
  return ref && typeof ref === 'string' && /^[A-Za-z0-9._-]{6,128}$/.test(ref);
}

function isValidHttpUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function getFrontendBaseUrl() {
  return String(process.env.FRONTEND_URL || 'https://mysterybundlehub.com')
    .trim()
    .replace(/\/$/, '');
}

function generateOrderId() {
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `ORD-${Date.now()}-${rand}`;
}

async function createPendingOrderWithRetry(payload, maxAttempts = 3) {
  let attempt = 0;
  while (attempt < maxAttempts) {
    attempt += 1;
    const orderId = generateOrderId();
    try {
      return await Order.create({ ...payload, orderId });
    } catch (err) {
      const isDuplicateOrderId =
        err?.code === 11000 &&
        (err?.keyPattern?.orderId || err?.keyValue?.orderId !== undefined || /orderId/i.test(err?.message || ''));
      if (!isDuplicateOrderId || attempt >= maxAttempts) {
        throw err;
      }
      paymentLog('warn', 'initialize', 'orderId collision, retrying', { attempt, orderId });
    }
  }
  throw new Error('Unable to allocate unique orderId');
}

function validateVerifiedPaymentForOrder({ reference, payment, order, stage }) {
  if (!payment || typeof payment !== 'object') {
    return { ok: false, status: 502, message: 'Invalid verification payload from Paystack' };
  }

  if (payment.reference !== reference) {
    paymentLog('warn', stage, 'reference mismatch', {
      reference,
      paystackReference: payment.reference
    });
    return { ok: false, status: 409, message: 'Payment reference mismatch' };
  }

  const expectedAmount = Math.round(Number(order.amount || 0) * 100);
  const paidAmount = Number(payment.amount || 0);
  if (!Number.isFinite(expectedAmount) || expectedAmount <= 0 || paidAmount !== expectedAmount) {
    paymentLog('warn', stage, 'amount mismatch', {
      reference,
      expectedAmount,
      paidAmount
    });
    return { ok: false, status: 409, message: 'Payment amount mismatch' };
  }

  const currency = String(payment.currency || '').toUpperCase();
  if (currency && currency !== 'GHS') {
    paymentLog('warn', stage, 'currency mismatch', { reference, currency });
    return { ok: false, status: 409, message: 'Payment currency mismatch' };
  }

  return { ok: true };
}

export function verifyPaystackWebhookSignature(rawBodyBuffer, signature) {
  const secretKey = getPaystackSecretKey();
  if (!signature || !secretKey || !Buffer.isBuffer(rawBodyBuffer)) {
    return false;
  }
  const hash = crypto
    .createHmac('sha512', secretKey)
    .update(rawBodyBuffer)
    .digest('hex');
  return hash === signature;
}

async function markOrderPaidFromPaystack(reference, paystackTransaction) {
  return Order.findOneAndUpdate(
    { reference, status: 'pending' },
    {
      $set: {
        status: 'paid',
        paymentStatus: 'success',
        paystackResponse: paystackTransaction,
        updatedAt: new Date()
      }
    },
    { new: true }
  );
}

export const initializePayment = async (req, res) => {
  try {
    console.log('[payment.controller] initializePayment invoked');
    const paystackSecretKey = requirePaystackSecretKey('initialize');

    const {
      phone,
      bundle,
      productKey: productKeyRaw,
      storeSlug: storeSlugRaw,
      agentStoreSlug,
      email: emailRaw,
      network: networkRaw,
      tier: tierRaw,
      volume: volumeRaw
    } = req.body || {};
    const phoneNorm = normalizeGhanaPhone(phone);
    if (!phoneNorm) {
      return res.status(400).json({
        success: false,
        status: 'error',
        message: 'Invalid or missing phone (use Ghana format e.g. 0550123456)'
      });
    }

    const normalizedNetwork = normalizeCatalogNetwork(networkRaw);
    const normalizedTier = normalizeCatalogTier(tierRaw);
    const normalizedVolume = normalizeCatalogVolume(volumeRaw);
    const storeSlug = sanitizeText(storeSlugRaw || agentStoreSlug, 120).toLowerCase();
    const productKey = String(productKeyRaw || '').trim().toLowerCase() || (String(bundle || '').includes(':') ? String(bundle || '').trim().toLowerCase() : '');

    let catalogSelection = null;
    if (storeSlug) {
      catalogSelection = await resolveStorefrontSelection({
        storeSlug,
        productKey,
        network: normalizedNetwork,
        tier: normalizedTier,
        volume: normalizedVolume
      });

      if (!catalogSelection) {
        return res.status(404).json({
          success: false,
          status: 'error',
          message: 'This agent store does not have the selected bundle enabled'
        });
      }
    } else if (normalizedNetwork || normalizedTier || normalizedVolume) {
      if (!normalizedNetwork || !normalizedTier || !normalizedVolume) {
        return res.status(400).json({
          success: false,
          status: 'error',
          message: 'network, tier, and volume are required together'
        });
      }

      catalogSelection = await resolveCatalogSelection({
        network: normalizedNetwork,
        tier: normalizedTier,
        volume: normalizedVolume
      });

      if (!catalogSelection) {
        return res.status(404).json({
          success: false,
          status: 'error',
          message: 'Selected network, tier, and volume are not available'
        });
      }
    } else if (productKey) {
      catalogSelection = await resolveProductKeySelection(productKey);
      if (!catalogSelection) {
        return res.status(404).json({
          success: false,
          status: 'error',
          message: 'Selected bundle is not available'
        });
      }
    } else {
      if (!isValidBundleCode(bundle)) {
        return res.status(400).json({
          success: false,
          status: 'error',
          message: 'Invalid or missing bundle selection'
        });
      }

      catalogSelection = await resolveLegacyBundleSelection(String(bundle).trim());
      if (!catalogSelection) {
        return res.status(404).json({
          success: false,
          status: 'error',
          message: 'Bundle not available'
        });
      }
    }

    const amountGHS = roundMoney(catalogSelection.price);
    const reference = `MBH-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const wholesaleCost = roundMoney(catalogSelection.wholesaleCost || 0);
    const sellingPrice = roundMoney(catalogSelection.price || 0);
    const agentProfit = catalogSelection.agentId ? roundMoney(Math.max(sellingPrice - wholesaleCost, 0)) : 0;

    const email = emailRaw && String(emailRaw).trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        status: 'error',
        message: 'A valid email address is required for payment'
      });
    }

    const frontendBase = getFrontendBaseUrl();
    if (!frontendBase) {
      return res.status(503).json({
        success: false,
        status: 'error',
        message: 'FRONTEND_URL is required for Paystack callback (e.g. https://mysterybundlehub.com)'
      });
    }
    if (!isValidHttpUrl(frontendBase)) {
      return res.status(500).json({
        success: false,
        status: 'error',
        message: 'FRONTEND_URL must be a valid absolute URL'
      });
    }
    const callback_url = `${frontendBase}/success.html`;
    paymentLog('info', 'initialize', 'using frontend callback', { callback_url });

    await createPendingOrderWithRetry({
      reference,
      customerPhone: phoneNorm,
      customerEmail: email,
      network: catalogSelection.network,
      catalogTier: catalogSelection.tier,
      tierLabel: catalogSelection.tierLabel,
      catalogVolume: catalogSelection.volume,
      productKey: catalogSelection.productKey,
      offerSlug: catalogSelection.offerSlug,
      deliveryLabel: catalogSelection.deliveryLabel,
      bundleCode: catalogSelection.bundleCode,
      bundleName: `${catalogSelection.networkLabel} ${catalogSelection.tierLabel} ${catalogSelection.sizeLabel}`,
      amount: amountGHS,
      sellingPrice,
      wholesaleCost,
      floorPrice: roundMoney(catalogSelection.floorPrice || 0),
      agentProfit,
      agentId: catalogSelection.agentId || undefined,
      agentStoreSlug: catalogSelection.agentStoreSlug || storeSlug || undefined,
      profitStatus: catalogSelection.agentId ? 'unrecorded' : 'none',
      status: 'pending',
      paymentStatus: 'pending',
      deliveryStatus: 'pending'
    });

    let paystackRes;
    try {
      paystackRes = await axios.post(
        `${paystackBase()}/transaction/initialize`,
        {
          email,
          amount: Math.round(amountGHS * 100),
          currency: 'GHS',
          reference,
          callback_url,
          customer: {
            phone: phoneNorm
          },
          metadata: {
            flow: catalogSelection.agentId ? 'agent_store_order' : 'customer_order',
            phone: phoneNorm,
            bundle: catalogSelection.bundleCode,
            network: catalogSelection.network,
            tier: catalogSelection.tier,
            volume: catalogSelection.volume,
            storeSlug: catalogSelection.agentStoreSlug || storeSlug || '',
            custom_fields: [
              { display_name: 'Phone', variable_name: 'phone', value: phoneNorm },
              {
                display_name: 'Bundle',
                variable_name: 'bundle',
                value: `${catalogSelection.networkLabel} ${catalogSelection.tierLabel} ${catalogSelection.sizeLabel}`
              },
              {
                display_name: 'Tier',
                variable_name: 'tier',
                value: catalogSelection.tierLabel
              }
            ]
          }
        },
        {
          headers: {
            Authorization: `Bearer ${paystackSecretKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (e) {
      paymentLog('error', 'initialize', 'paystack initialize request failed', {
        keyPresent: Boolean(paystackSecretKey),
        keyLength: paystackSecretKey.length,
        nodeEnv: process.env.NODE_ENV || 'development',
        paystackStatus: e.response?.status,
        paystackMessage: e.response?.data?.message,
        error: e.message
      });
      await Order.deleteOne({ reference });
      throw e;
    }

    const ps = paystackRes.data;
    if (!ps.status || !ps.data?.authorization_url) {
      paymentLog('error', 'initialize', 'unexpected initialize response', {
        reference,
        paystackStatus: ps?.status,
        paystackMessage: ps?.message
      });
      await Order.deleteOne({ reference });
      return res.status(502).json({
        success: false,
        status: 'error',
        message: ps.message || 'Paystack rejected initialization'
      });
    }

    return res.json({
      status: 'success',
      success: true,
      message: 'Authorization URL created',
      data: {
        authorization_url: ps.data.authorization_url,
        access_code: ps.data.access_code,
        reference: ps.data.reference
      }
    });
  } catch (error) {
    if (error.message === 'Paystack secret key is missing in environment variables') {
      return res.status(503).json({
        success: false,
        status: 'error',
        message: error.message
      });
    }
    paymentLog('error', 'initialize', 'initialize failed', {
      keyPresent: Boolean(getPaystackSecretKey()),
      keyLength: getPaystackSecretKey().length,
      nodeEnv: process.env.NODE_ENV || 'development',
      paystackStatus: error.response?.status,
      paystackMessage: error.response?.data?.message,
      error: error.message
    });
    const statusCode = error.response ? 502 : 500;
    return res.status(statusCode).json({
      success: false,
      status: 'error',
      message: error.response?.data?.message || 'Payment initialization failed'
    });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const paystackSecretKey = requirePaystackSecretKey('verify');

    const { reference } = req.params;
    if (!isValidReferenceParam(reference)) {
      return res.status(400).json({
        success: false,
        status: 'error',
        message: 'Invalid payment reference'
      });
    }

    const existingOrder = await Order.findOne({ reference });
    if (!existingOrder) {
      const onboardingPayment = await AgentOnboardingPayment.findOne({ reference });
      if (onboardingPayment) {
        const onboardingVerification = await axios.get(
          `${paystackBase()}/transaction/verify/${encodeURIComponent(reference)}`,
          { headers: { Authorization: `Bearer ${paystackSecretKey}` } }
        );
        const onboardingPayload = onboardingVerification.data;
        const payment = onboardingPayload?.data;
        if (!onboardingPayload?.status || payment?.status !== 'success') {
          return res.status(402).json({
            success: false,
            status: 'error',
            message: payment?.gateway_response || onboardingPayload?.message || 'Payment not successful'
          });
        }

        const onboardingResult = await finalizeAgentOnboardingPayment(reference, payment);
        if (!onboardingResult) {
          return res.status(402).json({
            success: false,
            status: 'error',
            message: 'Agent onboarding payment is not confirmed yet'
          });
        }

        return res.json({
          status: 'success',
          success: true,
          message: 'Agent onboarding payment verified',
          data: payment,
          onboarding: {
            reference: onboardingResult.payment.reference,
            status: onboardingResult.payment.status,
            agentId: onboardingResult.agent?._id
          }
        });
      }

      return res.status(404).json({
        success: false,
        status: 'error',
        message: 'Order not found for this payment'
      });
    }

    const paystackRes = await axios.get(
      `${paystackBase()}/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${paystackSecretKey}` } }
    );

    const payload = paystackRes.data;
    const payment = payload?.data;
    if (!payload?.status || payment?.status !== 'success') {
      paymentLog('warn', 'verify', 'verification not successful', {
        reference,
        paystackStatus: payment?.status,
        gatewayResponse: payment?.gateway_response
      });
      return res.status(402).json({
        success: false,
        status: 'error',
        message: payment?.gateway_response || payload?.message || 'Payment not successful'
      });
    }

    const guard = validateVerifiedPaymentForOrder({
      reference,
      payment,
      order: existingOrder,
      stage: 'verify'
    });
    if (!guard.ok) {
      return res.status(guard.status).json({
        success: false,
        status: 'error',
        message: guard.message
      });
    }

    let order = await markOrderPaidFromPaystack(reference, payment);
    let fulfillmentNote = 'skipped';

    if (order) {
      try {
        await recordAgentOrderPendingEarnings(order);
        await fulfillOrder(order);
        fulfillmentNote = 'attempted';
      } catch (e) {
        console.error('verifyPayment fulfill:', e);
        fulfillmentNote = 'error';
      }
    } else {
      order = await Order.findOne({ reference });
      if (!order) {
        return res.status(404).json({
          success: false,
          status: 'error',
          message: 'Order not found for this payment'
        });
      }
      if (order.status === 'paid' && order.deliveryStatus === 'pending') {
        try {
          await recordAgentOrderPendingEarnings(order);
          await fulfillOrder(order);
          fulfillmentNote = 'attempted';
        } catch (e) {
          console.error('verifyPayment fulfill (late):', e);
          fulfillmentNote = 'error';
        }
      } else if (order.status === 'paid') {
        fulfillmentNote =
          order.deliveryStatus === 'delivered' ? 'already_delivered' : order.deliveryStatus;
      } else {
        return res.status(409).json({
          success: false,
          status: 'error',
          message: 'Order is not in a payable state'
        });
      }
    }

    const fresh = await Order.findOne({ reference });
    return res.json({
      status: 'success',
      success: true,
      message: 'Payment verified',
      data: payment,
      order: fresh
        ? {
            orderId: fresh.orderId,
            reference: fresh.reference,
            status: fresh.status,
            deliveryStatus: fresh.deliveryStatus,
            bundleCode: fresh.bundleCode,
            customerPhone: fresh.customerPhone,
            network: fresh.network,
            amount: fresh.amount,
            tier: fresh.catalogTier,
            tierLabel: fresh.tierLabel,
            profit: fresh.agentProfit,
            createdAt: fresh.createdAt
          }
        : undefined,
      fulfillment: fulfillmentNote
    });
  } catch (error) {
    paymentLog('error', 'verify', 'verification endpoint failed', {
      reference: req?.params?.reference,
      paystackStatus: error.response?.status,
      paystackMessage: error.response?.data?.message,
      error: error.message
    });
    if (error.response?.status === 404) {
      return res.status(404).json({
        success: false,
        status: 'error',
        message: 'Transaction not found'
      });
    }
    return res.status(error.response ? 502 : 500).json({
      success: false,
      status: 'error',
      message: error.response?.data?.message || error.message
    });
  }
};

export const webhook = async (req, res) => {
  try {
    const paystackSecretKey = requirePaystackSecretKey('webhook');
    const signature = req.headers['x-paystack-signature'];
    if (!verifyPaystackWebhookSignature(req.rawBody, signature)) {
      paymentLog('warn', 'webhook', 'invalid signature');
      return res.sendStatus(401);
    }

    const event = req.body;
    if (event?.event !== 'charge.success') {
      return res.sendStatus(200);
    }

    const reference = event?.data?.reference;
    if (!reference || typeof reference !== 'string') {
      paymentLog('warn', 'webhook', 'missing reference in event');
      return res.sendStatus(200);
    }

    const paystackRes = await axios.get(
      `${paystackBase()}/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${paystackSecretKey}` } }
    );
    const payment = paystackRes.data?.data;
    if (payment?.status !== 'success') {
      paymentLog('warn', 'webhook', 'verify not successful', {
        reference,
        paystackStatus: payment?.status
      });
      return res.sendStatus(200);
    }

    const existingOrder = await Order.findOne({ reference });
    if (!existingOrder) {
      const onboardingPayment = await AgentOnboardingPayment.findOne({ reference });
      if (onboardingPayment) {
        await finalizeAgentOnboardingPayment(reference, payment);
        return res.sendStatus(200);
      }
      paymentLog('warn', 'webhook', 'order not found', { reference });
      return res.sendStatus(200);
    }

    const guard = validateVerifiedPaymentForOrder({
      reference,
      payment,
      order: existingOrder,
      stage: 'webhook'
    });
    if (!guard.ok) {
      return res.sendStatus(200);
    }

    const order = await markOrderPaidFromPaystack(reference, payment);
    if (order) {
      await recordAgentOrderPendingEarnings(order);
      fulfillOrder(order).catch((err) => console.error('webhook fulfill:', err));
    } else {
      const existing = await Order.findOne({ reference });
      if (existing?.status === 'paid' && existing.deliveryStatus === 'pending') {
        await recordAgentOrderPendingEarnings(existing);
        fulfillOrder(existing).catch((err) => console.error('webhook fulfill (late):', err));
      }
    }

    return res.sendStatus(200);
  } catch (e) {
    if (e.message === 'Paystack secret key is missing in environment variables') {
      return res.sendStatus(503);
    }
    paymentLog('error', 'webhook', 'webhook handler failed', {
      keyPresent: Boolean(getPaystackSecretKey()),
      keyLength: getPaystackSecretKey().length,
      nodeEnv: process.env.NODE_ENV || 'development',
      error: e.message,
      paystackStatus: e.response?.status,
      paystackMessage: e.response?.data?.message
    });
    return res.sendStatus(500);
  }
};
