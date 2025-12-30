// server.js - MYSTERY BUNDLE HUB - PRODUCTION BACKEND
// COMPLETELY REWRITTEN WITH BENEFICIARY BUNDLES & PAYSTACK FIX
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========== CRITICAL: LOAD ENVIRONMENT VARIABLES ==========
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

// Validate config
if (!PAYSTACK_SECRET_KEY || !YOUR_DOMAIN || !MONGODB_URI) {
    console.error('❌ FATAL: Missing critical .env variables.');
    process.exit(1);
}

// ========== DATABASE CONNECTION ==========
const connectDB = async () => {
    try {
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000
        });
        console.log('✅ MongoDB Connected');
    } catch (err) {
        console.error('❌ MongoDB Error:', err.message);
        process.exit(1);
    }
};
connectDB();

// ========== ORDER SCHEMA ==========
const orderSchema = new mongoose.Schema({
    orderId: { type: String, unique: true, required: true },
    paystackReference: String,
    customerEmail: String,
    recipientPhone: String,
    // FROM FRONTEND: 'mtn-1-express', 'mtn-10-beneficiary', 'airtel-1', etc.
    bundleId: String,
    // FOR PROVIDER: 'mtn_express_bundle', 'master_beneficiary_bundle', 'ishare_data_bundle'
    bundleSlug: String,
    bundleSize: String,
    bundleType: { type: String, enum: ['express', 'beneficiary', 'ishare', 'bigtime', 'telecel'] },
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
const Order = mongoose.model('Order', orderSchema);

// ========== MASTER BUNDLE CATALOG ==========
// Maps frontend bundleId -> Success Biz Hub API parameters
const BUNDLE_MAP = {
    // ===== MTN EXPRESS BUNDLES (3-15min) =====
    'mtn-1-express':   { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 1,  bundleType: 'express', costPrice: 4.75 },
    'mtn-2-express':   { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 2,  bundleType: 'express', costPrice: 9.25 },
    'mtn-3-express':   { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 3,  bundleType: 'express', costPrice: 13.50 },
    'mtn-4-express':   { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 4,  bundleType: 'express', costPrice: 18.50 },
    'mtn-5-express':   { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 5,  bundleType: 'express', costPrice: 22.00 },
    'mtn-6-express':   { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 6,  bundleType: 'express', costPrice: 27.00 },
    'mtn-7-express':   { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 7,  bundleType: 'express', costPrice: 32.00 },
    'mtn-8-express':   { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 8,  bundleType: 'express', costPrice: 36.20 },
    'mtn-10-express':  { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 10, bundleType: 'express', costPrice: 42.00 },
    'mtn-12-express':  { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 12, bundleType: 'express', costPrice: 53.00 },
    'mtn-15-express':  { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 15, bundleType: 'express', costPrice: 62.50 },
    'mtn-20-express':  { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 20, bundleType: 'express', costPrice: 83.00 },
    'mtn-25-express':  { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 25, bundleType: 'express', costPrice: 104.00 },
    'mtn-30-express':  { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 30, bundleType: 'express', costPrice: 125.00 },
    'mtn-40-express':  { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 40, bundleType: 'express', costPrice: 165.00 },

    // ===== MTN BENEFICIARY BUNDLES (30min-2hrs) =====
    'mtn-1-beneficiary':   { network: 'mtn', offerSlug: 'master_beneficiary_bundle', volume: 1,   bundleType: 'beneficiary', costPrice: 4.40 },
    'mtn-2-beneficiary':   { network: 'mtn', offerSlug: 'master_beneficiary_bundle', volume: 2,   bundleType: 'beneficiary', costPrice: 8.70 },
    'mtn-3-beneficiary':   { network: 'mtn', offerSlug: 'master_beneficiary_bundle', volume: 3,   bundleType: 'beneficiary', costPrice: 12.90 },
    'mtn-4-beneficiary':   { network: 'mtn', offerSlug: 'master_beneficiary_bundle', volume: 4,   bundleType: 'beneficiary', costPrice: 17.50 },
    'mtn-5-beneficiary':   { network: 'mtn', offerSlug: 'master_beneficiary_bundle', volume: 5,   bundleType: 'beneficiary', costPrice: 21.60 },
    'mtn-6-beneficiary':   { network: 'mtn', offerSlug: 'master_beneficiary_bundle', volume: 6,   bundleType: 'beneficiary', costPrice: 26.00 },
    'mtn-7-beneficiary':   { network: 'mtn', offerSlug: 'master_beneficiary_bundle', volume: 7,   bundleType: 'beneficiary', costPrice: 30.40 },
    'mtn-8-beneficiary':   { network: 'mtn', offerSlug: 'master_beneficiary_bundle', volume: 8,   bundleType: 'beneficiary', costPrice: 35.00 },
    'mtn-9-beneficiary':   { network: 'mtn', offerSlug: 'master_beneficiary_bundle', volume: 9,   bundleType: 'beneficiary', costPrice: 38.50 },
    'mtn-10-beneficiary':  { network: 'mtn', offerSlug: 'master_beneficiary_bundle', volume: 10,  bundleType: 'beneficiary', costPrice: 41.00 },
    'mtn-12-beneficiary':  { network: 'mtn', offerSlug: 'master_beneficiary_bundle', volume: 12,  bundleType: 'beneficiary', costPrice: 51.60 },
    'mtn-15-beneficiary':  { network: 'mtn', offerSlug: 'master_beneficiary_bundle', volume: 15,  bundleType: 'beneficiary', costPrice: 60.40 },
    'mtn-20-beneficiary':  { network: 'mtn', offerSlug: 'master_beneficiary_bundle', volume: 20,  bundleType: 'beneficiary', costPrice: 79.00 },
    'mtn-25-beneficiary':  { network: 'mtn', offerSlug: 'master_beneficiary_bundle', volume: 25,  bundleType: 'beneficiary', costPrice: 99.80 },
    'mtn-30-beneficiary':  { network: 'mtn', offerSlug: 'master_beneficiary_bundle', volume: 30,  bundleType: 'beneficiary', costPrice: 119.20 },
    'mtn-40-beneficiary':  { network: 'mtn', offerSlug: 'master_beneficiary_bundle', volume: 40,  bundleType: 'beneficiary', costPrice: 158.00 },
    'mtn-50-beneficiary':  { network: 'mtn', offerSlug: 'master_beneficiary_bundle', volume: 50,  bundleType: 'beneficiary', costPrice: 195.00 },
    'mtn-100-beneficiary': { network: 'mtn', offerSlug: 'master_beneficiary_bundle', volume: 100, bundleType: 'beneficiary', costPrice: 380.00 },

    // ===== AIRTELTIGO BUNDLES =====
    'airtel-1':  { network: 'at', offerSlug: 'ishare_data_bundle', volume: 1,  bundleType: 'ishare', costPrice: 5.20 },
    'airtel-2':  { network: 'at', offerSlug: 'ishare_data_bundle', volume: 2,  bundleType: 'ishare', costPrice: 9.80 },
    'airtel-3':  { network: 'at', offerSlug: 'ishare_data_bundle', volume: 3,  bundleType: 'ishare', costPrice: 14.20 },
    'airtel-5':  { network: 'at', offerSlug: 'ishare_data_bundle', volume: 5,  bundleType: 'ishare', costPrice: 20.50 },
    'airtel-10': { network: 'at', offerSlug: 'ishare_data_bundle', volume: 10, bundleType: 'ishare', costPrice: 39.00 },
    'airtel-40-bigtime': { network: 'at', offerSlug: 'bigtime_data_bundle', volume: 40, bundleType: 'bigtime', costPrice: 85.00 },

    // ===== TELECEL BUNDLES =====
    'telecel-5':  { network: 'telecel', offerSlug: 'telecel_express', volume: 5,  bundleType: 'telecel', costPrice: 21.00 },
    'telecel-10': { network: 'telecel', offerSlug: 'telecel_expiry_bundle', volume: 10, bundleType: 'telecel', costPrice: 40.00 },
    'telecel-20': { network: 'telecel', offerSlug: 'telecel_expiry_bundle', volume: 20, bundleType: 'telecel', costPrice: 75.00 }
};

// ========== HELPER: FULFILL ORDER WITH SUCCESS BIZ HUB ==========
async function fulfillOrderWithProvider(orderDoc) {
    const apiConfig = BUNDLE_MAP[orderDoc.bundleId];
    if (!apiConfig) {
        throw new Error(`Bundle config missing for: ${orderDoc.bundleId}`);
    }

    const formattedPhone = '233' + orderDoc.recipientPhone.substring(1);
    const payload = {
        type: 'single',
        volume: apiConfig.volume,
        phone: formattedPhone,
        offerSlug: apiConfig.offerSlug,
        webhookUrl: `${YOUR_DOMAIN}/api/successbizhub-webhook`
    };

    console.log(`📤 Fulfilling order ${orderDoc.orderId} via Success Biz Hub...`);

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

        console.log(`✅ Order sent to provider. Ref: ${response.data.reference}`);
        return { success: true, data: response.data };

    } catch (error) {
        console.error('❌ Provider API Error:', error.response?.data || error.message);
        orderDoc.status = 'failed';
        await orderDoc.save();
        return {
            success: false,
            error: error.response?.data?.error || 'Provider API call failed'
        };
    }
}

// ========== API ROUTES ==========

// 1. HEALTH CHECK (for Render monitoring)
app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        service: 'Mystery Bundle Hub API',
        timestamp: new Date(),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// 2. CREATE ORDER (called from frontend PayStack flow)
app.post('/api/orders/create', async (req, res) => {
    try {
        const { bundleId, recipientPhone, customerEmail, amount } = req.body;

        // Validate bundle exists in our map
        if (!BUNDLE_MAP[bundleId]) {
            return res.status(400).json({
                success: false,
                error: 'Invalid bundle selected. Please refresh the page.'
            });
        }

        const bundleConfig = BUNDLE_MAP[bundleId];
        const orderId = 'MYST-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5).toUpperCase();

        // Create order in database
        const order = new Order({
            orderId,
            customerEmail: customerEmail || 'customer@mysteryhub.com',
            recipientPhone,
            bundleId,
            bundleSlug: bundleConfig.offerSlug,
            bundleSize: `${bundleConfig.volume}GB`,
            bundleType: bundleConfig.bundleType,
            network: bundleConfig.network,
            amount: parseFloat(amount),
            costPrice: bundleConfig.costPrice,
            profit: parseFloat(amount) - bundleConfig.costPrice,
            status: 'pending_payment'
        });

        await order.save();

        console.log(`📝 Order created: ${orderId} for ${recipientPhone}`);

        // Return data for PayStack initialization
        res.json({
            success: true,
            orderId: order.orderId,
            amount: order.amount * 100, // Convert to pesewas for PayStack
            email: order.customerEmail,
            publicKey: PAYSTACK_PUBLIC_KEY,
            message: 'Order created successfully. Proceed to payment.'
        });

    } catch (error) {
        console.error('Order creation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create order. Please try again or contact support.'
        });
    }
});

// 3. PAYSTACK WEBHOOK (receives payment confirmation)
app.post('/api/paystack-webhook', async (req, res) => {
    const event = req.body;
    
    // Immediately respond to PayStack to prevent retries
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

            // Update order with payment reference and mark as paid
            order.paystackReference = paymentData.reference;
            order.status = 'paid';
            order.updatedAt = new Date();
            await order.save();

            console.log(`✅ Payment verified for ${orderId}. Reference: ${paymentData.reference}`);

            // Fulfill order with provider (with 2 second delay)
            setTimeout(async () => {
                try {
                    await fulfillOrderWithProvider(order);
                } catch (fulfillError) {
                    console.error(`Fulfillment error for ${orderId}:`, fulfillError);
                }
            }, 2000);

        } catch (error) {
            console.error('❌ Webhook processing error:', error);
        }
    }
});

// 4. SUCCESS BIZ HUB WEBHOOK (receives delivery status)
app.post('/api/successbizhub-webhook', async (req, res) => {
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
            console.log(`🔄 Order ${order.orderId} status updated to: ${status}`);
        }
    } catch (error) {
        console.error('Provider webhook error:', error);
    }
});

// 5. GET ORDER STATUS (for frontend tracking)
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
                bundleType: order.bundleType,
                network: order.network,
                amount: order.amount,
                createdAt: order.createdAt,
                paystackReference: order.paystackReference,
                apiReference: order.apiReference
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 6. ADMIN LOGIN
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
            const token = 'admin-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            
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

// 7. ADMIN GET ORDERS
app.get('/api/admin/orders', async (req, res) => {
    try {
        // Simple token check (in production use proper JWT)
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('admin-')) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        
        const orders = await Order.find().sort({ createdAt: -1 }).limit(100);
        
        res.json({
            success: true,
            orders: orders.map(order => ({
                orderId: order.orderId,
                customerEmail: order.customerEmail,
                recipientPhone: order.recipientPhone,
                bundleId: order.bundleId,
                bundleSize: order.bundleSize,
                bundleType: order.bundleType,
                network: order.network,
                amount: order.amount,
                costPrice: order.costPrice,
                profit: order.profit,
                status: order.status,
                paystackReference: order.paystackReference,
                apiReference: order.apiReference,
                createdAt: order.createdAt
            }))
        });
    } catch (error) {
        console.error('Admin orders error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch orders' });
    }
});

// 8. GET ALL BUNDLES (for potential future features)
app.get('/api/bundles', (req, res) => {
    res.json({
        success: true,
        bundles: BUNDLE_MAP,
        count: Object.keys(BUNDLE_MAP).length
    });
});

// ========== START SERVER ==========
const serverPort = process.env.PORT || 3000;
app.listen(serverPort, '0.0.0.0', () => {
    console.log(`🚀 Mystery Bundle Hub API running on port ${serverPort}`);
    console.log(`🔗 Backend URL: ${YOUR_DOMAIN}`);
    console.log(`🔗 PayStack Webhook: ${YOUR_DOMAIN}/api/paystack-webhook`);
    console.log(`✅ Bundle types loaded: Express, Beneficiary, iShare, BigTime, Telecel`);
});
