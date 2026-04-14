import axios from 'axios';
import { Order } from '../models/Order.js';
import { settleAgentOrderEarnings } from './agent-accounting.service.js';
import { getOfferSlugAndVolume } from '../utils/offerSlugs.js';

const DELIVERY_STATUS_SCORE = {
  pending: 0,
  processing: 1,
  failed: 2,
  delivered: 3
};

const STATUS_SYNC_MIN_INTERVAL_MS = Number(process.env.SUCCESSBIZHUB_SYNC_INTERVAL_MS) || 15000;

function getSuccessBizHubConfig() {
  return {
    base: String(
      process.env.SUCCESSBIZHUB_STATUS_BASE_URL ||
      process.env.SUCCESSBIZHUB_BASE_URL ||
      ''
    ).replace(/\/$/, ''),
    apiKey: String(process.env.SUCCESSBIZHUB_API_KEY || '').trim()
  };
}

function getNetworkParam(network) {
  if (network === 'mtn') return 'mtn';
  if (network === 'airteltigo') return 'at';
  if (network === 'telecel') return 'telecel';
  throw new Error(`Unknown network: ${network}`);
}

function normalizePhoneE164(phone) {
  const phoneDigits = String(phone || '').replace(/\D/g, '');
  return phoneDigits.startsWith('233')
    ? phoneDigits
    : phoneDigits.replace(/^0/, '233');
}

function getProviderOrderId(payload) {
  const candidates = [
    payload?.orderId,
    payload?.reference,
    payload?.externalOrderId,
    payload?.data?.orderId,
    payload?.data?.reference,
    payload?.data?.externalOrderId,
    payload?.data?.order?.orderId,
    payload?.data?.order?.reference
  ];

  const match = candidates.find(value => value !== undefined && value !== null && String(value).trim() !== '');
  return match ? String(match).trim() : '';
}

function getProviderRawStatus(payload) {
  const candidates = [
    payload?.deliveryStatus,
    payload?.status,
    payload?.orderStatus,
    payload?.state,
    payload?.data?.deliveryStatus,
    payload?.data?.status,
    payload?.data?.orderStatus,
    payload?.data?.state,
    payload?.data?.order?.deliveryStatus,
    payload?.data?.order?.status,
    payload?.data?.order?.state
  ];

  const match = candidates.find(value => value !== undefined && value !== null && String(value).trim() !== '');
  return match ? String(match).trim() : '';
}

function normalizeProviderDeliveryStatus(rawStatus, payload) {
  const status = String(rawStatus || '').trim().toLowerCase();
  if (!status && payload?.success === true) return 'processing';
  if (!status) return null;

  if (/(delivered|fulfilled|completed|complete|success|successful|done)/.test(status)) {
    return 'delivered';
  }
  if (/(failed|error|rejected|cancelled|canceled|declined)/.test(status)) {
    return 'failed';
  }
  if (/(processing|queued|queue|accepted|submitted|sending|dispatch|progress|active)/.test(status)) {
    return 'processing';
  }
  if (/(pending|waiting|received|initiated|created)/.test(status)) {
    return 'pending';
  }
  return null;
}

function shouldAdvanceDeliveryStatus(currentStatus, nextStatus) {
  const currentScore = DELIVERY_STATUS_SCORE[currentStatus] ?? -1;
  const nextScore = DELIVERY_STATUS_SCORE[nextStatus] ?? -1;
  return nextScore > currentScore;
}

function isTerminalDeliveryStatus(status) {
  return status === 'delivered' || status === 'failed';
}

function getStatusSyncReference(order) {
  return order.providerOrderId || order.reference;
}

export async function applyProviderStatusUpdate(orderInput, providerPayload, source = 'sync') {
  const order = orderInput?._id ? await Order.findById(orderInput._id) : await Order.findById(orderInput);
  if (!order) return null;

  const rawStatus = getProviderRawStatus(providerPayload);
  const normalizedStatus = normalizeProviderDeliveryStatus(rawStatus, providerPayload);
  const providerOrderId = getProviderOrderId(providerPayload);

  if (providerOrderId) {
    order.providerOrderId = providerOrderId;
  }
  if (rawStatus) {
    order.providerStatus = rawStatus;
  }

  order.lastProviderPayload = providerPayload;
  order.lastProviderSyncAt = new Date();
  order.updatedAt = new Date();

  if (source === 'submission' && !order.fulfillmentAcceptedAt && providerPayload?.success) {
    order.fulfillmentAcceptedAt = new Date();
  }

  if (normalizedStatus) {
    if (shouldAdvanceDeliveryStatus(order.deliveryStatus, normalizedStatus)) {
      order.deliveryStatus = normalizedStatus;
    } else if (!isTerminalDeliveryStatus(order.deliveryStatus) && normalizedStatus === 'failed') {
      order.deliveryStatus = 'failed';
    }
  } else if (source === 'submission' && providerPayload?.success && order.deliveryStatus === 'pending') {
    order.deliveryStatus = 'processing';
  }

  if (order.deliveryStatus === 'delivered') {
    order.status = 'fulfilled';
    order.deliveryTime = Date.now() - new Date(order.createdAt).getTime();
  } else if (order.deliveryStatus === 'failed') {
    order.status = 'failed';
  } else if (order.paymentStatus === 'success') {
    order.status = 'paid';
  }

  await order.save();
  await settleAgentOrderEarnings(order._id);
  return order;
}

export async function syncOrderProviderStatus(orderInput, { force = false, source = 'poll' } = {}) {
  const order = orderInput?._id ? await Order.findById(orderInput._id) : await Order.findById(orderInput);
  if (!order) return null;

  if (order.paymentStatus !== 'success' || isTerminalDeliveryStatus(order.deliveryStatus)) {
    return order;
  }

  const syncReference = getStatusSyncReference(order);
  const { base, apiKey } = getSuccessBizHubConfig();
  if (!syncReference || !base || !apiKey) {
    return order;
  }

  const lastSyncTime = order.lastProviderSyncAt ? new Date(order.lastProviderSyncAt).getTime() : 0;
  if (!force && lastSyncTime && (Date.now() - lastSyncTime) < STATUS_SYNC_MIN_INTERVAL_MS) {
    return order;
  }

  try {
    const response = await axios.get(
      `${base}/api/v1/order/status/${encodeURIComponent(syncReference)}`,
      {
        headers: {
          'x-api-key': apiKey,
          Accept: 'application/json'
        },
        timeout: 20000
      }
    );

    const updatedOrder = await applyProviderStatusUpdate(order, response.data, source);
    return updatedOrder || order;
  } catch (error) {
    console.error(
      `[SuccessBizHub] STATUS ${source} ${order.reference}:`,
      error.response?.data || error.message
    );
    return await Order.findById(order._id) || order;
  }
}

export const fulfillOrder = async (order) => {
  const locked = await Order.findOneAndUpdate(
    { _id: order._id, status: 'paid', deliveryStatus: 'pending' },
    {
      $set: {
        deliveryStatus: 'processing',
        fulfillmentRequestedAt: new Date(),
        updatedAt: new Date()
      }
    },
    { new: true }
  );

  if (!locked) {
    const cur = await Order.findById(order._id);
    if (cur?.deliveryStatus === 'delivered' || cur?.status === 'fulfilled' || cur?.deliveryStatus === 'processing') {
      console.log(`[SuccessBizHub] skip duplicate fulfillment ${order.reference}`);
    }
    return;
  }

  try {
    const fallbackMapping = getOfferSlugAndVolume(locked.bundleCode);
    const offerSlug = String(locked.offerSlug || fallbackMapping.offerSlug || '').trim();
    const volume = Number(locked.catalogVolume || fallbackMapping.volume);
    if (!offerSlug) {
      console.error(`[SuccessBizHub] No mapping for bundle: ${locked.bundleCode}`);
      locked.deliveryStatus = 'failed';
      locked.status = 'failed';
      await locked.save();
      await settleAgentOrderEarnings(locked._id);
      return;
    }
    if (!Number.isFinite(volume) || volume <= 0) {
      console.error(`[SuccessBizHub] Invalid volume for bundle: ${locked.bundleCode}`);
      locked.deliveryStatus = 'failed';
      locked.status = 'failed';
      await locked.save();
      await settleAgentOrderEarnings(locked._id);
      return;
    }

    const networkParam = getNetworkParam(locked.network);
    const phoneE164 = normalizePhoneE164(locked.customerPhone);

    const payload = {
      type: 'single',
      volume,
      phone: phoneE164,
      offerSlug
    };
    if (process.env.SUCCESSBIZHUB_CALLBACK_URL) {
      payload.webhookUrl = process.env.SUCCESSBIZHUB_CALLBACK_URL;
    }

    const { base, apiKey } = getSuccessBizHubConfig();
    if (!base || !apiKey) {
      throw new Error('SuccessBizHub not configured');
    }

    console.log('Sending order to SuccessBizHub:', {
      reference: locked.reference,
      endpoint: `${base}/order/${networkParam}`,
      payload
    });

    const response = await axios.post(
      `${base}/order/${networkParam}`,
      payload,
      {
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 45000
      }
    );

    if (response.data?.success) {
      const updatedOrder = await applyProviderStatusUpdate(locked, response.data, 'submission');
      console.log(
        `[SuccessBizHub] OK ${locked.reference} orderId=${updatedOrder?.providerOrderId || response.data.orderId || 'n/a'}`
      );
    } else {
      throw new Error(response.data?.error || 'Fulfillment rejected');
    }
  } catch (error) {
    console.error(
      `[SuccessBizHub] FAIL ${locked.reference}:`,
      error.response?.data || error.message
    );
    locked.deliveryStatus = 'failed';
    locked.status = 'failed';
    await locked.save();
    await settleAgentOrderEarnings(locked._id);
  }
};
