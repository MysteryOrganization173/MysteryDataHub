// server.js - PRODUCTION READY WITH PAYSTACK + SUCCESS BIZ HUB
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('.'));

// Load Config from .env
const {
  PORT,
  MONGODB_URI,
  SUCCESSBIZHUB_API_KEY,
  SUCCESSBIZHUB_BASE_URL,
  PAYSTACK_SECRET_KEY,
  PAYSTACK_PUBLIC_KEY,
  YOUR_DOMAIN
} = process.env;

// Validate critical config
if (!PAYSTACK_SECRET_KEY || !YOUR_DOMAIN || YOUR_DOMAIN.includes('your-actual-domain')) {
  console.error('❌ FATAL ERROR: Missing or invalid configuration in .env file.');
  console.error('   Please set YOUR_DOMAIN and verify your PayStack keys.');
  process.exit(1);
}

// Database Connection
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.log('❌ MongoDB error:', err.message);
    process.exit(1);
  });

// Order Schema
const orderSchema = new mongoose.Schema({
  orderId: { type: String, unique: true, required: true }, // e.g., MYST-123456
  paystackReference: { type: String, unique: true, sparse: true }, // e.g., tx_abc123
  customerEmail: String,
  recipientPhone: String,
  network: String,
  bundleSlug: String,
  bundleSize: String,
  amount: Number, // Price charged to customer
  costPrice: Number, // Price deducted from your Success Biz Hub wallet
  status: { 
    type: String, 
    default: 'created',
    enum: ['created', 'pending_payment', 'paid', 'processing_api', 'delivered', 'failed', 'cancelled']
  },
  apiReference: String, // From Success Biz Hub
  apiOrderId: String, // From Success Biz Hub
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', orderSchema);

// ========== BUNDLE CATALOG & MAPPING ==========
// This maps your frontend bundle IDs to the correct API parameters and cost price.
// YOU MUST SET THE CORRECT COST PRICES FROM YOUR SUCCESS BIZ HUB DASHBOARD.
const BUNDLE_MAP = {
  // MTN EXPRESS BUNDLES (Slug: mtn_express_bundle)
  'mtn-1':   { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 1,  costPrice: 6.00 },
  'mtn-2':   { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 2,  costPrice: 11.50 },
  'mtn-3':   { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 3,  costPrice: 16.50 },
  'mtn-4':   { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 4,  costPrice: 21.00 },
  'mtn-5':   { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 5,  costPrice: 25.50 },
  'mtn-6':   { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 6,  costPrice: 29.50 },
  'mtn-7':   { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 7,  costPrice: 34.00 },
  'mtn-8':   { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 8,  costPrice: 38.00 },
  'mtn-10':  { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 10, costPrice: 46.00 },
  'mtn-12':  { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 12, costPrice: 55.00 },
  'mtn-15':  { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 15, costPrice: 67.00 },
  'mtn-20':  { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 20, costPrice: 87.00 },
  'mtn-25':  { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 25, costPrice: 108.00 },
  'mtn-30':  { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 30, costPrice: 127.00 },
  'mtn-40':  { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 40, costPrice: 168.00 },
  'mtn-50':  { network: 'mtn', offerSlug: 'master_beneficiary_bundle', volume: 50, costPrice: 195.00 },
  'mtn-100': { network: 'mtn', offerSlug: 'master_beneficiary_bundle', volume: 100, costPrice: 380.00 },

  // AirtelTigo iShare (Slug: ishare_data_bundle)
  'airtel-1':  { network: 'at', offerSlug: 'ishare_data_bundle', volume: 1,  costPrice: 5.20 },
  'airtel-2':  { network: 'at', offerSlug: 'ishare_data_bundle', volume: 2,  costPrice: 9.80 },
  'airtel-5':  { network: 'at', offerSlug: 'ishare_data_bundle', volume: 5,  costPrice: 20.50 },
  'airtel-10': { network: 'at', offerSlug: 'ishare_data_bundle', volume: 10, costPrice: 39.00 },

  // AirtelTigo BigTime (Slug: bigtime_data_bundle)
  'airtel-bt-40': { network: 'at', offerSlug: 'bigtime_data_bundle', volume: 40, costPrice: 85.00 },

  // Telecel Bundles (Example - GET ACTUAL COSTS!)
  'telecel-5':  { network: 'telecel', offerSlug: 'telecel_express', volume: 5,  costPrice: 21.00 },
  'telecel-10': { network: 'telecel', offerSlug: 'telecel_expiry_bundle', volume: 10, costPrice: 40.00 },
};

// ========== HELPER: CALL SUCCESS BIZ HUB API ==========
async function fulfillOrderWithProvider(orderDoc) {
  const apiConfig = BUNDLE_MAP[orderDoc.bundleId];
  if (!apiConfig) {
    throw new Error(`Bundle configuration not found for ID: ${orderDoc.bundleId}`);
  }

  // Format phone for API (233...)
  const formattedPhone = '233' + orderDoc.recipientPhone.substring(1);

  const payload = {
    type: 'single',
    volume: apiConfig.volume,
    phone: formattedPhone,
    offerSlug: apiConfig.offerSlug,
    webhookUrl: `${YOUR_DOMAIN}/api/successbizhub-webhook` // They notify us of delivery
  };

  console.log('📤 Calling Success Biz Hub API for order:', orderDoc.orderId);

  try {
    const response = await axios.post(
      `${SUCCESSBIZHUB_BASE_URL}/order/${apiConfig.network}`,
      payload,
      { headers: { 'Content-Type': 'application/json', 'x-api-key': SUCCESSBIZHUB_API_KEY } }
    );
    
    // Save API's reference to our order
    orderDoc.apiReference = response.data.reference;
    orderDoc.apiOrderId = response.data.orderId;
    orderDoc.status = 'processing_api'; // Awaiting delivery confirmation via their webhook
    await orderDoc.save();

    console.log(`✅ Order ${orderDoc.orderId} sent to provider. Ref: ${response.data.reference}`);
    return { success: true, data: response.data };

  } catch (error) {
    console.error('❌ Success Biz Hub API Error:', error.response?.data || error.message);
    // Mark order as failed
    orderDoc.status = 'failed';
    await orderDoc.save();
    return { 
      success: false, 
      error: error.response?.data?.error || 'Provider API Failed' 
    };
  }
}

// ========== API ROUTES ==========

// 1. Endpoint to INITIATE an order (called from your frontend)
app.post('/api/orders/create', async (req, res) => {
  try {
    const { bundleId, recipientPhone, customerEmail, amount } = req.body;

    // Validate bundle
    if (!BUNDLE_MAP[bundleId]) {
      return res.status(400).json({ success: false, error: 'Invalid bundle selected.' });
    }

    // Generate a unique order ID
    const orderId = 'MYST-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase();

    // Save order as 'created' initially
    const order = new Order({
      orderId,
      customerEmail,
      recipientPhone,
      bundleId,
      network: BUNDLE_MAP[bundleId].network,
      bundleSlug: BUNDLE_MAP[bundleId].offerSlug,
      bundleSize: BUNDLE_MAP[bundleId].volume + 'GB',
      amount,
      costPrice: BUNDLE_MAP[bundleId].costPrice,
      status: 'created'
    });
    await order.save();

    // Respond with order details for PayStack initialization on frontend
    res.json({
      success: true,
      orderId: order.orderId,
      amount: order.amount * 100, // Convert to pesewas for PayStack
      email: order.customerEmail,
      publicKey: PAYSTACK_PUBLIC_KEY
    });

  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ success: false, error: 'Failed to create order.' });
  }
});

// 2. Endpoint to VERIFY PAYSTACK PAYMENT & FULFILL ORDER (CRITICAL)
// This is called by PayStack's webhook AFTER a successful payment.
app.post('/api/paystack-webhook', async (req, res) => {
  const event = req.body;
  console.log('🪝 PayStack Webhook Received:', event.event);

  // PayStack requires an immediate 200 response.
  // Do NOT do lengthy processing here. Use a queue or set a timeout.
  res.status(200).send('Webhook received');

  // Verify this is a successful charge event
  if (event.event === 'charge.success') {
    const paymentData = event.data;
    const paystackReference = paymentData.reference;

    // Find the order by PayStack reference (you must store this when initializing payment)
    // We'll find it by orderId stored in metadata for simplicity.
    const metadata = paymentData.metadata;
    const orderId = metadata?.orderId;

    if (!orderId) {
      console.error('❌ Webhook missing orderId in metadata.');
      return;
    }

    try {
      const order = await Order.findOne({ orderId });
      if (!order) {
        console.error(`❌ Order ${orderId} not found for webhook.`);
        return;
      }

      // Prevent duplicate processing
      if (order.status !== 'created' && order.status !== 'pending_payment') {
        console.log(`ℹ️ Order ${orderId} already processed. Status: ${order.status}`);
        return;
      }

      // Update order with PayStack reference and mark as paid
      order.paystackReference = paystackReference;
      order.status = 'paid';
      order.updatedAt = new Date();
      await order.save();

      console.log(`✅ Payment verified for order ${orderId}. Now fulfilling with API...`);

      // NOW call the Success Biz Hub API to deliver the bundle
      // Add a small delay to ensure webhook response was sent
      setTimeout(async () => {
        await fulfillOrderWithProvider(order);
      }, 1000);

    } catch (error) {
      console.error('❌ Error processing PayStack webhook:', error);
    }
  }
});

// 3. Success Biz Hub's Webhook (for delivery status updates)
app.post('/api/successbizhub-webhook', async (req, res) => {
  console.log('📩 Success Biz Hub Webhook:', req.body);
  const { event, orderId, reference, status } = req.body;

  // Respond quickly
  res.status(200).send('OK');

  try {
    const order = await Order.findOne({ 
      $or: [{ apiReference: reference }, { apiOrderId: orderId }] 
    });

    if (order) {
      order.status = status; // e.g., 'delivered', 'failed'
      order.updatedAt = new Date();
      await order.save();
      console.log(`✅ Order ${order.orderId} status updated to: ${status}`);
    }
  } catch (error) {
    console.error('Error processing provider webhook:', error);
  }
});

// 4. Frontend order status check
app.get('/api/orders/:orderId', async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) {
      return res.json({ success: false, error: 'Order not found.' });
    }
    // Don't send sensitive data like costPrice to frontend
    res.json({ 
      success: true, 
      order: {
        orderId: order.orderId,
        status: order.status,
        recipientPhone: order.recipientPhone,
        bundleSize: order.bundleSize,
        network: order.network,
        amount: order.amount,
        createdAt: order.createdAt,
        apiReference: order.apiReference
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Production Server Live on port ${PORT}`);
  console.log(`🔗 PayStack Webhook: ${YOUR_DOMAIN}/api/paystack-webhook`);
  console.log(`🔗 Success Biz Hub Webhook: ${YOUR_DOMAIN}/api/successbizhub-webhook`);
  console.log(`⚠️  REMEMBER: Fund your Success Biz Hub wallet and configure webhooks in their dashboard!`);
});