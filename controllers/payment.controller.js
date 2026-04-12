import crypto from 'crypto';
import axios from 'axios';
import { Order } from '../models/Order.js';
import { Bundle } from '../models/Bundle.js';
import { fulfillOrder } from '../services/fulfillment.service.js';

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

  let p = String(input).trim().replace(/\s/g, '');

  if (p.startsWith('+233')) {
    p = `0${p.slice(4)}`;
  } else if (p.startsWith('233')) {
    p = `0${p.slice(3)}`;
  }

  // Ghana mobile numbers typically look like:
  // 020xxxxxxx, 024xxxxxxx, 050xxxxxxx, 055xxxxxxx, etc.
  if (!/^0[235]\d{8}$/.test(p)) return null;

  return p;
}

function isValidBundleCode(code) {
  if (!code || typeof code !== 'string') return false;
  const c = code.trim();
  return c.length >= 4 && c.length <= 64 && /^[A-Za-z0-9_]+$/.test(c);
}

function isValidReferenceParam(ref) {
  return ref && typeof ref === 'string' && /^[A-Za-z0-9._-]{6,128}$/.test(ref);
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
      console.warn('orderId collision, retrying', { attempt, orderId });
    }
  }
  throw new Error('Unable to allocate unique orderId');
}

function isValidHttpsUrl(urlString) {
  try {
    const url = new URL(urlString);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function getPublicBaseUrl() {
  return String(process.env.FRONTEND_URL || 'https://mysterybundlehub.com')
    .trim()
    .replace(/\/$/, '');
}

function getPaystackErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    'Unknown Paystack error'
  );
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
        paidAt: new Date()
      }
    },
    { new: true }
  );
}

export const initializePayment = async (req, res) => {
  const requestId = crypto.randomBytes(4).toString('hex');

  try {
    const paystackSecretKey = requirePaystackSecretKey('initialize');

    const { phone, bundle, email: emailRaw } = req.body || {};

    const phoneNorm = normalizeGhanaPhone(phone);
    if (!phoneNorm) {
      return res.status(400).json({
        success: false,
        status: 'error',
        message: 'Invalid or missing phone (use Ghana format e.g. 0550123456)'
      });
    }

    if (!isValidBundleCode(bundle)) {
      return res.status(400).json({
        success: false,
        status: 'error',
        message: 'Invalid or missing bundle code'
      });
    }

    const bundleCode = String(bundle).trim();
    const bundleDoc = await Bundle.findOne({ code: bundleCode, active: true });

    if (!bundleDoc) {
      return res.status(404).json({
        success: false,
        status: 'error',
        message: 'Bundle not available'
      });
    }

    const amountGHS = Number(bundleDoc.defaultAgentPrice);
    if (!Number.isFinite(amountGHS) || amountGHS <= 0) {
      return res.status(400).json({
        success: false,
        status: 'error',
        message: 'Invalid bundle price'
      });
    }

    const reference = `MBH-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    let email = emailRaw && String(emailRaw).trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      email = `customer+${reference.replace(/[^a-zA-Z0-9]/g, '')}@mysterybundlehub.com`;
    }

    const publicBase = getPublicBaseUrl();
    if (!publicBase) {
      return res.status(503).json({
        success: false,
        status: 'error',
        message: 'FRONTEND_URL is required for Paystack callback (e.g. https://mysterybundlehub.com)'
      });
    }

    if (!isValidHttpsUrl(publicBase)) {
      return res.status(500).json({
        success: false,
        status: 'error',
        message: 'FRONTEND_URL must be a valid absolute URL'
      });
    }

    const callback_url = `${publicBase}/success.html`;

    console.log(`[${requestId}] initializePayment`, {
      phone: phoneNorm,
      bundle: bundleCode,
      amountGHS,
      callback_url
    });

    await createPendingOrderWithRetry({
      reference,
      customerPhone: phoneNorm,
      customerEmail: email,
      network: bundleDoc.operator,
      bundleCode,
      bundleName: `${bundleDoc.size} ${bundleDoc.validity}`,
      amount: amountGHS,
      status: 'pending',
      paymentStatus: 'pending',
      deliveryStatus: 'pending'
    });

    let paystackRes;

    try {
      const payload = {
        email,
        amount: Math.round(amountGHS * 100),
        currency: 'GHS',
        reference,
        callback_url,
        metadata: {
          phone: phoneNorm,
          bundle: bundleCode,
          network: bundleDoc.operator,
          custom_fields: [
            { display_name: 'Phone', variable_name: 'phone', value: phoneNorm },
            { display_name: 'Bundle', variable_name: 'bundle', value: bundleCode }
          ]
        }
      };

      console.log(`[${requestId}] sending payload to Paystack`, JSON.stringify(payload, null, 2));

      paystackRes = await axios.post(
        `${paystackBase()}/transaction/initialize`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${paystackSecretKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      console.log(`[${requestId}] Paystack response`, JSON.stringify(paystackRes.data, null, 2));
    } catch (e) {
      paymentLog('error', 'initialize', 'paystack initialize request failed', {
        keyPresent: Boolean(paystackSecretKey),
        keyLength: paystackSecretKey.length,
        nodeEnv: process.env.NODE_ENV || 'development',
        paystackStatus: e.response?.status,
        paystackMessage: e.response?.data?.message,
        error: e.message
      });
      console.error(`[${requestId}] Paystack initialize error`, {
        message: e.message,
        status: e.response?.status,
        data: e.response?.data
      });

      await Order.deleteOne({ reference });

      return res.status(502).json({
        success: false,
        status: 'error',
        message: `Paystack initialization failed: ${getPaystackErrorMessage(e)}`
      });
    }

    const ps = paystackRes?.data;

    if (!ps?.status || !ps?.data?.authorization_url) {
      console.error(`[${requestId}] Paystack returned unexpected response`, ps);

      await Order.deleteOne({ reference });

      return res.status(502).json({
        success: false,
        status: 'error',
        message: ps?.message || 'Paystack rejected initialization'
      });
    }

    return res.json({
      status: 'success',
      success: true,
      message: 'Authorization URL created',
      data: {
        authorization_url: ps.data.authorization_url,
        access_code: ps.data.access_code,
        reference: ps.data.reference || reference
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
    console.error(`[${requestId}] initializePayment unhandled error`, {
      keyPresent: Boolean(getPaystackSecretKey()),
      keyLength: getPaystackSecretKey().length,
      nodeEnv: process.env.NODE_ENV || 'development',
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });

    return res.status(500).json({
      success: false,
      status: 'error',
      message: error.response?.data?.message || error.message || 'Payment initialization failed'
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

    const paystackRes = await axios.get(
      `${paystackBase()}/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`
        },
        timeout: 30000
      }
    );

    const payload = paystackRes.data;
    const payment = payload?.data;

    if (!payload?.status || payment?.status !== 'success') {
      return res.status(402).json({
        success: false,
        status: 'error',
        message: payment?.gateway_response || payload?.message || 'Payment not successful'
      });
    }

    let order = await markOrderPaidFromPaystack(reference, payment);
    let fulfillmentNote = 'skipped';

    if (order) {
      try {
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
          await fulfillOrder(order);
          fulfillmentNote = 'attempted';
        } catch (e) {
          console.error('verifyPayment fulfill (late):', e);
          fulfillmentNote = 'error';
        }
      } else if (order.status === 'paid') {
        fulfillmentNote =
          order.deliveryStatus === 'delivered'
            ? 'already_delivered'
            : order.deliveryStatus;
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
            createdAt: fresh.createdAt
          }
        : undefined,
      fulfillment: fulfillmentNote
    });
  } catch (error) {
    console.error('verifyPayment:', error.response?.data || error.message);

    if (error.response?.status === 404) {
      return res.status(404).json({
        success: false,
        status: 'error',
        message: 'Transaction not found'
      });
    }

    return res.status(500).json({
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
      console.warn('Paystack webhook: invalid signature');
      return res.sendStatus(401);
    }

    const event = req.body;

    if (event?.event !== 'charge.success') {
      return res.sendStatus(200);
    }

    const reference = event?.data?.reference;

    if (!reference || typeof reference !== 'string') {
      return res.sendStatus(200);
    }

    const paystackRes = await axios.get(
      `${paystackBase()}/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`
        },
        timeout: 30000
      }
    );

    const payment = paystackRes.data?.data;

    if (payment?.status !== 'success') {
      console.warn('webhook: Paystack verify not success for', reference);
      return res.sendStatus(200);
    }

    const order = await markOrderPaidFromPaystack(reference, payment);

    if (order) {
      fulfillOrder(order).catch((err) => console.error('webhook fulfill:', err));
    } else {
      const existing = await Order.findOne({ reference });

      if (existing?.status === 'paid' && existing.deliveryStatus === 'pending') {
        fulfillOrder(existing).catch((err) => console.error('webhook fulfill (late):', err));
      }
    }

    return res.sendStatus(200);
  } catch (e) {
    if (e.message === 'Paystack secret key is missing in environment variables') {
      return res.sendStatus(503);
    }
    console.error('webhook:', e);
    return res.sendStatus(500);
  }
};