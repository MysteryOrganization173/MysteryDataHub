// server.js - MYSTERY BUNDLE HUB - PRODUCTION READY (FINAL FIXED VERSION)
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CRITICAL: Load environment variables
const {
    PORT = 3000,
    MONGODB_URI,
    SUCCESSBIZHUB_API_KEY,
    SUCCESSBIZHUB_BASE_URL = 'https://www.successbizhub.com/api/v1',
    PAYSTACK_SECRET_KEY,
    PAYSTACK_PUBLIC_KEY,
    YOUR_DOMAIN = 'https://mysterydatahub-api.onrender.com',
    ADMIN_EMAIL = 'aryeeteyemmanuel852@gmail.com',
    ADMIN_PASSWORD = '0573904148'
} = process.env;

// Validate critical config
if (!PAYSTACK_SECRET_KEY || !MONGODB_URI) {
    console.error('❌ FATAL: Missing PayStack secret or MongoDB URI');
    process.exit(1);
}

// Database connection - IMPROVED
const connectDB = async () => {
    try {
        await mongoose.connect(MONGODB_URI, {
            serverSelectionTimeoutMS: 10000,
            serverApi: { version: '1', strict: true, deprecationErrors: true }
        });
        console.log('✅ MongoDB Connected');
    } catch (err) {
        console.error('❌ MongoDB Connection Error:', err.message);
        process.exit(1);
    }
};
connectDB();

// Order Schema - FINAL FIX: Prevents auto-index creation
const orderSchema = new mongoose.Schema({
    orderId: { type: String, unique: true, required: true },
    paystackReference: String, // Correct: No 'unique' constraint
    customerEmail: String,
    recipientPhone: String,
    bundleId: String,
    bundleSlug: String,
    bundleSize: String,
    bundleType: String,
    network: String,
    amount: Number,
    costPrice: Number,
    profit: Number,
    status: { 
        type: String, 
        default: 'pending_payment',
        enum: ['pending_payment', 'paid', 'processing_api', 'delivered', 'failed', 'cancelled']
    },
    apiReference: String,
    apiOrderId: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// CRITICAL LINE: Prevents Mongoose from auto-creating indexes
orderSchema.set('autoIndex', false);

const Order = mongoose.model('Order', orderSchema);

// BUNDLE MAPPING (Matches frontend bundle IDs)
const BUNDLE_MAP = {
    // MTN EXPRESS
    'mtn-1-express': { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 1, costPrice: 4.75 },
    'mtn-2-express': { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 2, costPrice: 9.25 },
    'mtn-5-express': { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 5, costPrice: 22.00 },
    'mtn-10-express': { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 10, costPrice: 42.00 },
    
    // MTN BENEFICIARY
    'mtn-1-beneficiary': { network: 'mtn', offerSlug: 'master_beneficiary_bundle', volume: 1, costPrice: 4.40 },
    'mtn-2-beneficiary': { network: 'mtn', offerSlug: 'master_beneficiary_bundle', volume: 2, costPrice: 8.70 },
    'mtn-5-beneficiary': { network: 'mtn', offerSlug: 'master_beneficiary_bundle', volume: 5, costPrice: 21.60 },
    'mtn-10-beneficiary': { network: 'mtn', offerSlug: 'master_beneficiary_bundle', volume: 10, costPrice: 41.00 },
    
    // AIRTELTIGO
    'airtel-1': { network: 'at', offerSlug: 'ishare_data_bundle', volume: 1, costPrice: 5.20 },
    'airtel-5': { network: 'at', offerSlug: 'ishare_data_bundle', volume: 5, costPrice: 20.50 },
    
    // TELECEL
    'telecel-5': { network: 'telecel', offerSlug: 'telecel_express', volume: 5, costPrice: 21.00 },
    'telecel-10': { network: 'telecel', offerSlug: 'telecel_expiry_bundle', volume: 10, costPrice: 40.00 }
};

// Fulfill order with Success Biz Hub
async function fulfillOrderWithProvider(orderDoc) {
    const apiConfig = BUNDLE_MAP[orderDoc.bundleId];
    if (!apiConfig) {
        console.error(`❌ Bundle config not found: ${orderDoc.bundleId}`);
        return { success: false, error: 'Bundle configuration error' };
    }

    const formattedPhone = '233' + orderDoc.recipientPhone.substring(1);
    
    const payload = {
        type: 'single',
        volume: apiConfig.volume,
        phone: formattedPhone,
        offerSlug: apiConfig.offerSlug,
        webhookUrl: `${YOUR_DOMAIN}/api/successbizhub-webhook`
    };

    console.log(`📤 Sending to Success Biz Hub:`, payload);

    try {
        const response = await axios.post(
            `${SUCCESSBIZHUB_BASE_URL}/order/${apiConfig.network}`,
            payload,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': SUCCESSBIZHUB_API_KEY
                },
                timeout: 30000
            }
        );

        orderDoc.apiReference = response.data.reference;
        orderDoc.apiOrderId = response.data.orderId;
        orderDoc.status = 'processing_api';
        await orderDoc.save();

        console.log(`✅ Order sent to provider: ${response.data.reference}`);
        return { success: true, data: response.data };

    } catch (error) {
        console.error('❌ Provider API Error:', error.response?.data || error.message);
        orderDoc.status = 'failed';
        await orderDoc.save();
        return { success: false, error: 'Provider API failed' };
    }
}

// ========== API ROUTES ==========

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'online', 
        service: 'Mystery Bundle Hub API',
        timestamp: new Date(),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// ========== CREATE TRANSACTION ENDPOINT ==========
app.post('/api/create-transaction', async (req, res) => {
    try {
        const { email, phone, amount, bundle } = req.body;
        
        if (!email || !phone || !amount || !bundle) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields: email, phone, amount, bundle' 
            });
        }

        // 1. FIRST create order (without paystackReference)
        const orderId = 'MYST-' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();
        const bundleConfig = BUNDLE_MAP[bundle];
        
        if (!bundleConfig) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid bundle selected' 
            });
        }

        const order = new Order({
            orderId,
            customerEmail: email,
            recipientPhone: phone,
            bundleId: bundle,
            bundleSlug: bundleConfig.offerSlug,
            bundleSize: `${bundleConfig.volume}GB`,
            bundleType: bundle.includes('express') ? 'express' : 
                       bundle.includes('beneficiary') ? 'beneficiary' : 'other',
            network: bundleConfig.network,
            amount: parseFloat(amount),
            costPrice: bundleConfig.costPrice,
            profit: parseFloat(amount) - bundleConfig.costPrice,
            status: 'pending_payment'
        });

        await order.save();
        console.log(`📝 Order created: ${orderId} for ${phone}`);

        // 2. THEN call PayStack API
        const paystackResponse = await axios.post(
            'https://api.paystack.co/transaction/initialize',
            {
                email: email,
                amount: amount * 100, // Convert to pesewas
                currency: 'GHS',
                callback_url: `${YOUR_DOMAIN}/api/payment-callback`,
                metadata: {
                    orderId: orderId,
                    phone: phone,
                    bundle: bundle
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log(`✅ PayStack initialized for order ${orderId}`);
        
        // 3. Return PayStack authorization URL to frontend
        res.json({
            success: true,
            authorization_url: paystackResponse.data.data.authorization_url,
            reference: paystackResponse.data.data.reference,
            orderId: orderId
        });

    } catch (error) {
        console.error('❌ Transaction creation error:', error.response?.data || error.message);
        
        if (error.code === 11000) {
            console.error('⚠️  Duplicate key error. The database index needs to be removed.');
            console.error('Go to MongoDB Atlas > Data Explorer > Indexes tab for the "orders" collection.');
            console.error('Find and delete the "paymentReference_1" index.');
        }
        
        res.status(500).json({ 
            success: false, 
            error: 'Failed to create transaction. Please try again.' 
        });
    }
});

// Payment callback (optional, for frontend redirect)
app.get('/api/payment-callback', async (req, res) => {
    const { reference, trxref } = req.query;
    const paymentRef = reference || trxref;
    
    if (!paymentRef) {
        return res.redirect('https://your-frontend-url.com/payment-error');
    }
    
    try {
        // Verify payment with PayStack
        const verifyResponse = await axios.get(
            `https://api.paystack.co/transaction/verify/${paymentRef}`,
            {
                headers: {
                    'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`
                }
            }
        );
        
        if (verifyResponse.data.data.status === 'success') {
            const orderId = verifyResponse.data.data.metadata.orderId;
            return res.redirect(`https://your-frontend-url.com/success?order=${orderId}`);
        } else {
            return res.redirect('https://your-frontend-url.com/payment-failed');
        }
    } catch (error) {
        console.error('Callback verification error:', error);
        return res.redirect('https://your-frontend-url.com/payment-error');
    }
});

// PayStack webhook
app.post('/api/paystack-webhook', express.raw({type: 'application/json'}), async (req, res) => {
    const event = req.body;
    
    // Immediate response to prevent retries
    res.status(200).send('Webhook received');

    if (event.event === 'charge.success') {
        const paymentData = event.data;
        const metadata = paymentData.metadata;
        const orderId = metadata?.orderId;

        if (!orderId) {
            console.error('❌ Webhook missing orderId');
            return;
        }

        try {
            const order = await Order.findOne({ orderId });
            if (!order) {
                console.error(`Order ${orderId} not found`);
                return;
            }

            // Update order with payment reference
            order.paystackReference = paymentData.reference;
            order.status = 'paid';
            order.updatedAt = new Date();
            await order.save();

            console.log(`✅ Payment verified for ${orderId}`);

            // Fulfill order after 2 seconds
            setTimeout(async () => {
                await fulfillOrderWithProvider(order);
            }, 2000);

        } catch (error) {
            console.error('Webhook processing error:', error);
        }
    }
});

// Success Biz Hub webhook
app.post('/api/successbizhub-webhook', express.json(), async (req, res) => {
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
            console.log(`🔄 Order ${order.orderId} status: ${status}`);
        }
    } catch (error) {
        console.error('Provider webhook error:', error);
    }
});

// Get order status
app.get('/api/orders/:orderId', async (req, res) => {
    try {
        const order = await Order.findOne({ orderId: req.params.orderId });
        if (!order) {
            return res.json({ success: false, error: 'Order not found' });
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
                createdAt: order.createdAt
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Admin login
app.post('/api/admin/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ 
                success: false, 
                error: 'Email and password required' 
            });
        }
        
        if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
            const token = 'admin-' + Date.now();
            
            return res.json({
                success: true,
                token: token,
                email: email
            });
        } else {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: 'Internal error' });
    }
});

// Get admin orders
app.get('/api/admin/orders', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('admin-')) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        
        const orders = await Order.find().sort({ createdAt: -1 }).limit(50);
        
        res.json({
            success: true,
            orders: orders.map(order => ({
                orderId: order.orderId,
                customerEmail: order.customerEmail,
                recipientPhone: order.recipientPhone,
                bundleSize: order.bundleSize,
                bundleType: order.bundleType,
                network: order.network,
                amount: order.amount,
                status: order.status,
                createdAt: order.createdAt
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch orders' });
    }
});

// Start server
const serverPort = process.env.PORT || 3000;
app.listen(serverPort, '0.0.0.0', () => {
    console.log(`🚀 Mystery Bundle Hub API running on port ${serverPort}`);
    console.log(`🔗 Health check: http://0.0.0.0:${serverPort}/api/health`);
    console.log(`🔗 PayStack Webhook: ${YOUR_DOMAIN}/api/paystack-webhook`);
    console.log(`✅ Ready for production!`);
});
