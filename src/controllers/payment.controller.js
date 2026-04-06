import crypto from 'crypto';
import axios from 'axios';
import { Order } from '../models/Order.js';
import { Bundle } from '../models/Bundle.js';
import { fulfillOrder } from '../services/fulfillment.service.js';

const paystackBase = () => process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co';

function normalizeGhanaPhone(input) {
  if (input === undefined || input === null) return null;
  let p = String(input).trim().replace(/\s/g, '');
  if (p.startsWith('+233')) p = `0${p.slice(4)}`;
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

export function verifyPaystackWebhookSignature(rawBodyBuffer, signature) {
  if (!signature || !process.env.PAYSTACK_SECRET_KEY || !Buffer.isBuffer(rawBodyBuffer)) {
    return false;
  }
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
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
        paystackResponse: paystackTransaction
      }
    },
    { new: true }
  );
}

export const initializePayment = async (req, res) => {
  try {
    if (!process.env.PAYSTACK_SECRET_KEY) {
      return res.status(503).json({
        success: false,
        status: 'error',
        message: 'PAYSTACK_SECRET_KEY is not configured'
      });
    }

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

    const amountGHS = bundleDoc.defaultAgentPrice;
    const reference = `MBH-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    let email = emailRaw && String(emailRaw).trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      email = `customer+${reference.replace(/[^a-zA-Z0-9]/g, '')}@mysterybundlehub.com`;
    }

    const publicBase = (process.env.FRONTEND_URL || process.env.BASE_URL || '').replace(/\/$/, '');
    if (!publicBase) {
      return res.status(503).json({
        success: false,
        status: 'error',
        message: 'Set BASE_URL or FRONTEND_URL for Paystack callback (e.g. https://yoursite.com)'
      });
    }
    const callback_url = `${publicBase}/success.html`;

    await Order.create({
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
      paystackRes = await axios.post(
        `${paystackBase()}/transaction/initialize`,
        {
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
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (e) {
      await Order.deleteOne({ reference });
      throw e;
    }

    const ps = paystackRes.data;
    if (!ps.status || !ps.data?.authorization_url) {
      console.error('Paystack initialize unexpected:', ps);
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
    console.error('initializePayment:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      status: 'error',
      message: error.response?.data?.message || 'Payment initialization failed'
    });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    if (!process.env.PAYSTACK_SECRET_KEY) {
      return res.status(503).json({
        success: false,
        status: 'error',
        message: 'PAYSTACK_SECRET_KEY is not configured'
      });
    }

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
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
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
            reference: fresh.reference,
            deliveryStatus: fresh.deliveryStatus,
            bundleCode: fresh.bundleCode,
            customerPhone: fresh.customerPhone
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

    if (!process.env.PAYSTACK_SECRET_KEY) {
      return res.sendStatus(503);
    }

    const paystackRes = await axios.get(
      `${paystackBase()}/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
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
    console.error('webhook:', e);
    return res.sendStatus(500);
  }
};
