import axios from 'axios';
import { Order } from '../models/Order.js';
import { getOfferSlugAndVolume } from '../utils/offerSlugs.js';

export const fulfillOrder = async (order) => {
  const locked = await Order.findOneAndUpdate(
    { _id: order._id, status: 'paid', deliveryStatus: 'pending' },
    { $set: { deliveryStatus: 'processing' } },
    { new: true }
  );

  if (!locked) {
    const cur = await Order.findById(order._id);
    if (cur?.deliveryStatus === 'delivered' || cur?.status === 'fulfilled') {
      console.log(`[SuccessBizHub] skip duplicate fulfillment ${order.reference}`);
    }
    return;
  }

  try {
    const { offerSlug, volume } = getOfferSlugAndVolume(locked.bundleCode);
    if (!offerSlug) {
      console.error(`[SuccessBizHub] No mapping for bundle: ${locked.bundleCode}`);
      locked.deliveryStatus = 'failed';
      locked.status = 'failed';
      await locked.save();
      return;
    }

    let networkParam = '';
    if (locked.network === 'mtn') networkParam = 'mtn';
    else if (locked.network === 'airteltigo') networkParam = 'at';
    else if (locked.network === 'telecel') networkParam = 'telecel';
    else {
      throw new Error(`Unknown network: ${locked.network}`);
    }

    const phoneDigits = String(locked.customerPhone || '').replace(/\D/g, '');
    const phoneE164 = phoneDigits.startsWith('233')
      ? phoneDigits
      : phoneDigits.replace(/^0/, '233');

    const payload = {
      type: 'single',
      volume,
      phone: phoneE164,
      offerSlug
    };
    if (process.env.SUCCESSBIZHUB_CALLBACK_URL) {
      payload.webhookUrl = process.env.SUCCESSBIZHUB_CALLBACK_URL;
    }

    const base = (process.env.SUCCESSBIZHUB_BASE_URL || '').replace(/\/$/, '');
    if (!base || !process.env.SUCCESSBIZHUB_API_KEY) {
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
          'x-api-key': process.env.SUCCESSBIZHUB_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 45000
      }
    );

    if (response.data?.success) {
      locked.deliveryStatus = 'delivered';
      locked.status = 'fulfilled';
      locked.deliveryTime = Date.now() - new Date(locked.createdAt).getTime();
      await locked.save();
      console.log(
        `[SuccessBizHub] OK ${locked.reference} orderId=${response.data.orderId ?? 'n/a'}`
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
  }
};
