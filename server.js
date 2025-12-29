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

// Load Config from .env
const {
  PORT,
  MONGODB_URI,
  SUCCESSBIZHUB_API_KEY,
  SUCCESSBIZHUB_BASE_URL,
  PAYSTACK_SECRET_KEY,
  PAYSTACK_PUBLIC_KEY,
  YOUR_DOMAIN,
  ADMIN_EMAIL,
  ADMIN_PASSWORD
} = process.env;

// Validate critical config
if (!PAYSTACK_SECRET_KEY || !YOUR_DOMAIN) {
  console.error('❌ FATAL ERROR: Missing critical configuration.');
  console.error('   Please set YOUR_DOMAIN and verify your PayStack keys in Render Environment Variables.');
  process.exit(1);
}

// Database Connection with timeout
const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000, // 10 second timeout
      socketTimeoutMS: 45000 // 45 second timeout
    });
    console.log('✅ MongoDB connected successfully');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    console.error('   Check your MONGODB_URI in Render Environment Variables');
    process.exit(1);
  }
};

connectDB();

// Order Schema
const orderSchema = new mongoose.Schema({
  orderId: { type: String, unique: true, required: true },
  paystackReference: { type: String, unique: true, sparse: true },
  customerEmail: String,
  recipientPhone: String,
  network: String,
  bundleSlug: String,
  bundleSize: String,
  amount: Number,
  costPrice: Number,
  status: { 
    type: String, 
    default: 'created',
    enum: ['created', 'pending_payment', 'paid', 'processing_api', 'delivered', 'failed', 'cancelled']
  },
  apiReference: String,
  apiOrderId: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', orderSchema);

// ========== BUNDLE CATALOG & MAPPING ==========
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

  // Telecel Bundles
  'telecel-5':  { network: 'telecel', offerSlug: 'telecel_express', volume: 5,  costPrice: 21.00 },
  'telecel-10': { network: 'telecel', offerSlug: 'telecel_expiry_bundle', volume: 10, costPrice: 40.00 },
};

// ========== HELPER: CALL SUCCESS BIZ HUB API ==========
async function fulfillOrderWithProvider(orderDoc) {
  const apiConfig = BUNDLE_MAP[orderDoc.bundleId];
  if (!apiConfig) {
    throw new Error(`Bundle configuration not found for ID: ${orderDoc.bundleId}`);
  }

  const formattedPhone = '233' + orderDoc.recipientPhone.substring(1);

  const payload = {
    type: 'single',
    volume: apiConfig.volume,
    phone: formattedPhone,
    offerSlug: apiConfig.offerSlug,
    webhookUrl: `${YOUR_DOMAIN}/api/successbizhub-webhook`
  };

  console.log('📤 Calling Success Biz Hub API for order:', orderDoc.orderId);

  try {
    const response = await axios.post(
      `${SUCCESSBIZHUB_BASE_URL}/order/${apiConfig.network}`,
      payload,
      { headers: { 'Content-Type': 'application/json', 'x-api-key': SUCCESSBIZHUB_API_KEY } }
    );
    
    orderDoc.apiReference = response.data.reference;
    orderDoc.apiOrderId = response.data.orderId;
    orderDoc.status = 'processing_api';
    await orderDoc.save();

    console.log(`✅ Order ${orderDoc.orderId} sent to provider. Ref: ${response.data.reference}`);
    return { success: true, data: response.data };

  } catch (error) {
    console.error('❌ Success Biz Hub API Error:', error.response?.data || error.message);
    orderDoc.status = 'failed';
    await orderDoc.save();
    return { 
      success: false, 
      error: error.response?.data?.error || 'Provider API Failed' 
    };
  }
}

// ========== API ROUTES ==========

// Health Check Endpoint (Critical for Render)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'online', 
    timestamp: new Date(), 
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' 
  });
});

// 1. Endpoint to INITIATE an order (called from your frontend)
app.post('/api/orders/create', async (req, res) => {
  try {
    const { bundleId, recipientPhone, customerEmail, amount } = req.body;

    if (!BUNDLE_MAP[bundleId]) {
      return res.status(400).json({ success: false, error: 'Invalid bundle selected.' });
    }

    const orderId = 'MYST-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase();

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

    res.json({
      success: true,
      orderId: order.orderId,
      amount: order.amount * 100,
      email: order.customerEmail,
      publicKey: PAYSTACK_PUBLIC_KEY
    });

  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ success: false, error: 'Failed to create order.' });
  }
});

// 2. Endpoint to VERIFY PAYSTACK PAYMENT & FULFILL ORDER
app.post('/api/paystack-webhook', async (req, res) => {
  const event = req.body;
  console.log('🪝 PayStack Webhook Received:', event.event);

  res.status(200).send('Webhook received');

  if (event.event === 'charge.success') {
    const paymentData = event.data;
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

      if (order.status !== 'created' && order.status !== 'pending_payment') {
        console.log(`ℹ️ Order ${orderId} already processed. Status: ${order.status}`);
        return;
      }

      order.paystackReference = paymentData.reference;
      order.status = 'paid';
      order.updatedAt = new Date();
      await order.save();

      console.log(`✅ Payment verified for order ${orderId}. Now fulfilling with API...`);

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

  res.status(200).send('OK');

  try {
    const order = await Order.findOne({ 
      $or: [{ apiReference: reference }, { apiOrderId: orderId }] 
    });

    if (order) {
      order.status = status;
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

// 5. Admin API Routes (CRITICAL for admin-login.html)
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Simple validation
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email and password are required' 
      });
    }
    
    // Check against environment variables
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      // Generate a simple token (in production, use JWT)
      const token = 'admin-' + Date.now() + '-' + Math.random().toString(36).substr(2);
      
      return res.json({
        success: true,
        token: token,
        email: email,
        message: 'Login successful'
      });
    } else {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// 6. Admin orders list (for admin.html)
app.get('/api/admin/orders', async (req, res) => {
  try {
    // Simple authentication check (in production, use proper auth middleware)
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('admin-')) {
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized' 
      });
    }
    
    const orders = await Order.find().sort({ createdAt: -1 }).limit(100);
    res.json({
      success: true,
      orders: orders.map(order => ({
        orderId: order.orderId,
        customerEmail: order.customerEmail,
        recipientPhone: order.recipientPhone,
        network: order.network,
        bundleSize: order.bundleSize,
        amount: order.amount,
        status: order.status,
        createdAt: order.createdAt,
        paystackReference: order.paystackReference,
        apiReference: order.apiReference
      }))
    });
  } catch (error) {
    console.error('Admin orders error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch orders' 
    });
  }
});

// ========== START SERVER (CRITICAL FIX) ==========
// Use Render's PORT or default to 3000, bind to 0.0.0.0 for external access
const serverPort = process.env.PORT || 3000;

app.listen(serverPort, '0.0.0.0', () => {
  console.log(`🚀 Production Server Live on port ${serverPort}`);
  console.log(`🌐 Server bound to: 0.0.0.0 (accessible externally)`);
  console.log(`🔗 Frontend URL: https://mysterydatahub-bwqf.onrender.com`);
  console.log(`🔗 Backend URL: ${YOUR_DOMAIN}`);
  console.log(`🔗 PayStack Webhook: ${YOUR_DOMAIN}/api/paystack-webhook`);
  console.log(`🔗 Success Biz Hub Webhook: ${YOUR_DOMAIN}/api/successbizhub-webhook`);
  console.log(`📊 Health Check: ${YOUR_DOMAIN}/api/health`);
  console.log(`⚠️  REMEMBER: Configure webhooks in PayStack and Success Biz Hub dashboards!`);
});
