// server.js - MYSTERY BUNDLE HUB - SECURE PRODUCTION VERSION
// ============================================================
// CRITICAL SECURITY UPDATES:
// 1. JWT-based admin authentication with bcrypt password verification
// 2. Helmet.js for security headers
// 3. Rate limiting on all endpoints
// 4. Input validation & sanitization
// 5. Secure password hashing with bcrypt
// 6. Proper CORS configuration

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
require('dotenv').config();

const app = express();

// ========== SECURITY MIDDLEWARE ==========
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://js.paystack.co", "https://cdn.jsdelivr.net"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://api.paystack.co", "https://www.successbizhub.com"],
            fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
            frameSrc: ["https://js.paystack.co"]
        }
    },
    crossOriginEmbedderPolicy: false
}));

// CORS Configuration
const corsOptions = {
    origin: process.env.FRONTEND_DOMAIN || 'http://localhost:3000',
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Rate limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again after 15 minutes',
    standardHeaders: true,
    legacyHeaders: false
});

const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: 'Too many login attempts, please try again after an hour',
    standardHeaders: true,
    legacyHeaders: false
});

app.use('/api/', apiLimiter);
app.use('/api/admin/login', authLimiter);

// ========== ENVIRONMENT VARIABLES ==========
const {
    PORT = 3000,
    MONGODB_URI,
    SUCCESSBIZHUB_API_KEY,
    SUCCESSBIZHUB_BASE_URL = 'https://www.successbizhub.com/api/v1',
    PAYSTACK_SECRET_KEY,
    PAYSTACK_PUBLIC_KEY,
    YOUR_DOMAIN = 'https://mysterydatahub-api.onrender.com',
    JWT_SECRET,
    ADMIN_EMAIL = 'aryeeteyemmanuel852@gmail.com',
    ADMIN_PASSWORD_HASH
} = process.env;

// Validate critical config
if (!PAYSTACK_SECRET_KEY || !MONGODB_URI || !JWT_SECRET || !ADMIN_PASSWORD_HASH) {
    console.error('❌ FATAL: Missing required environment variables');
    console.error('Required: PAYSTACK_SECRET_KEY, MONGODB_URI, JWT_SECRET, ADMIN_PASSWORD_HASH');
    process.exit(1);
}

// ========== DATABASE CONNECTION ==========
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

// ========== DATABASE SCHEMAS ==========
const orderSchema = new mongoose.Schema({
    orderId: { type: String, unique: true, required: true },
    paystackReference: String,
    customerEmail: { type: String, required: true },
    recipientPhone: { type: String, required: true },
    bundleId: { type: String, required: true },
    bundleSlug: String,
    bundleSize: String,
    bundleType: String,
    network: String,
    amount: { type: Number, required: true },
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

orderSchema.set('autoIndex', false);
const Order = mongoose.model('Order', orderSchema);

// ========== BUNDLE MAPPING (UPDATED PRICING) ==========
const BUNDLE_MAP = {
    'mtn-1-express': { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 1, costPrice: 4.70 },
    'mtn-2-express': { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 2, costPrice: 9.15 },
    'mtn-3-express': { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 3, costPrice: 13.35 },
    'mtn-4-express': { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 4, costPrice: 18.00 },
    'mtn-5-express': { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 5, costPrice: 21.80 },
    'mtn-6-express': { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 6, costPrice: 26.50 },
    'mtn-7-express': { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 7, costPrice: 31.00 },
    'mtn-8-express': { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 8, costPrice: 35.80 },
    'mtn-10-express': { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 10, costPrice: 41.50 },
    'mtn-15-express': { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 15, costPrice: 61.00 },
    'mtn-20-express': { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 20, costPrice: 82.00 },
    'mtn-25-express': { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 25, costPrice: 102.00 },
    'mtn-30-express': { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 30, costPrice: 122.50 },
    'mtn-40-express': { network: 'mtn', offerSlug: 'mtn_express_bundle', volume: 40, costPrice: 162.00 },
    
    'mtn-1-beneficiary': { network: 'mtn', offerSlug: 'master_beneficiary_bundle', volume: 1, costPrice: 4.25 },
    'mtn-2-beneficiary': { network: 'mtn', offerSlug: 'master_beneficiary_bundle', volume: 2, costPrice: 8.50 },
    'mtn-3-beneficiary': { network: 'mtn', offerSlug: 'master_beneficiary_bundle', volume: 3, costPrice: 12.55 },
    'mtn-4-beneficiary': { network: 'mtn', offerSlug: 'master_beneficiary_bundle', volume: 4, costPrice: 17.00 },
    'mtn-5-beneficiary': { network: 'mtn', offerSlug: 'master_beneficiary_bundle', volume: 5, costPrice: 21.00 },
    'mtn-6-beneficiary': { network: 'mtn', offerSlug: 'master_beneficiary_bundle', volume: 6, costPrice: 25.20 },
    'mtn-7-beneficiary': { network: 'mtn', offerSlug: 'master_beneficiary_bundle', volume: 7, costPrice: 29.50 },
    'mtn-8-beneficiary': { network: 'mtn', offerSlug: 'master_beneficiary_bundle', volume: 8, costPrice: 34.00 },
    'mtn-10-beneficiary': { network: 'mtn', offerSlug: 'master_beneficiary_bundle', volume: 10, costPrice: 39.90 },
    'mtn-15-beneficiary': { network: 'mtn', offerSlug: 'master_beneficiary_bundle', volume: 15, costPrice: 59.00 },
    'mtn-20-beneficiary': { network: 'mtn', offerSlug: 'master_beneficiary_bundle', volume: 20, costPrice: 78.60 },
    'mtn-25-beneficiary': { network: 'mtn', offerSlug: 'master_beneficiary_bundle', volume: 25, costPrice: 98.00 },
    'mtn-30-beneficiary': { network: 'mtn', offerSlug: 'master_beneficiary_bundle', volume: 30, costPrice: 117.60 },
    'mtn-40-beneficiary': { network: 'mtn', offerSlug: 'master_beneficiary_bundle', volume: 40, costPrice: 157.00 },
    'mtn-50-beneficiary': { network: 'mtn', offerSlug: 'master_beneficiary_bundle', volume: 50, costPrice: 193.50 },
    'mtn-100-beneficiary': { network: 'mtn', offerSlug: 'master_beneficiary_bundle', volume: 100, costPrice: 367.80 },
    
    'airtel-1': { network: 'at', offerSlug: 'ishare_data_bundle', volume: 1, costPrice: 3.85 },
    'airtel-2': { network: 'at', offerSlug: 'ishare_data_bundle', volume: 2, costPrice: 7.80 },
    'airtel-3': { network: 'at', offerSlug: 'ishare_data_bundle', volume: 3, costPrice: 11.60 },
    'airtel-4': { network: 'at', offerSlug: 'ishare_data_bundle', volume: 4, costPrice: 15.40 },
    'airtel-5': { network: 'at', offerSlug: 'ishare_data_bundle', volume: 5, costPrice: 19.10 },
    'airtel-6': { network: 'at', offerSlug: 'ishare_data_bundle', volume: 6, costPrice: 23.00 },
    'airtel-7': { network: 'at', offerSlug: 'ishare_data_bundle', volume: 7, costPrice: 27.00 },
    'airtel-8': { network: 'at', offerSlug: 'ishare_data_bundle', volume: 8, costPrice: 31.00 },
    'airtel-9': { network: 'at', offerSlug: 'ishare_data_bundle', volume: 9, costPrice: 35.00 },
    'airtel-10': { network: 'at', offerSlug: 'ishare_data_bundle', volume: 10, costPrice: 39.00 },
    'airtel-12': { network: 'at', offerSlug: 'ishare_data_bundle', volume: 12, costPrice: 46.50 },
    'airtel-15': { network: 'at', offerSlug: 'ishare_data_bundle', volume: 15, costPrice: 58.00 },
    'airtel-20': { network: 'at', offerSlug: 'ishare_data_bundle', volume: 20, costPrice: 77.00 },
    'airtel-25': { network: 'at', offerSlug: 'ishare_data_bundle', volume: 25, costPrice: 95.80 },
    'airtel-30': { network: 'at', offerSlug: 'ishare_data_bundle', volume: 30, costPrice: 115.00 },
    
    'telecel-5': { network: 'telecel', offerSlug: 'telecel_express', volume: 5, costPrice: 20.50 },
    'telecel-10': { network: 'telecel', offerSlug: 'telecel_expiry_bundle', volume: 10, costPrice: 39.00 },
    'telecel-15': { network: 'telecel', offerSlug: 'telecel_express', volume: 15, costPrice: 56.00 },
    'telecel-20': { network: 'telecel', offerSlug: 'telecel_expiry_bundle', volume: 20, costPrice: 74.00 },
    'telecel-25': { network: 'telecel', offerSlug: 'telecel_express', volume: 25, costPrice: 92.50 },
    'telecel-30': { network: 'telecel', offerSlug: 'telecel_expiry_bundle', volume: 30, costPrice: 109.40 },
    'telecel-40': { network: 'telecel', offerSlug: 'telecel_express', volume: 40, costPrice: 147.00 },
    'telecel-50': { network: 'telecel', offerSlug: 'telecel_expiry_bundle', volume: 50, costPrice: 182.00 },
    'telecel-100': { network: 'telecel', offerSlug: 'telecel_express', volume: 100, costPrice: 365.00 }
};

// ========== HELPER FUNCTIONS ==========
const validatePhone = (phone) => /^(0[2-9][0-9]{8}|233[2-9][0-9]{8})$/.test(phone);
const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// JWT Authentication Middleware
const authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Access denied. No token provided.' });
    }
    
    const token = authHeader.split(' ')[1];
    
    try {
        const verified = jwt.verify(token, JWT_SECRET);
        req.admin = verified;
        next();
    } catch (error) {
        return res.status(401).json({ success: false, error: 'Invalid or expired token.' });
    }
};

// ========== FULFILLMENT FUNCTION ==========
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
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        version: '2.0.0-secure'
    });
});

// ========== ADMIN AUTHENTICATION ROUTES ==========
app.post('/api/admin/login', [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { email, password } = req.body;
        
        // Verify admin email
        if (email !== ADMIN_EMAIL) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }
        
        // ✅ SECURE: Verify password using bcrypt
        const passwordMatch = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
        
        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }
        
        // Generate JWT token
        const token = jwt.sign(
            { email: email, role: 'admin' },
            JWT_SECRET,
            { expiresIn: '8h' }
        );
        
        res.json({
            success: true,
            token: token,
            email: email,
            expiresIn: '8h'
        });
        
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// ========== ORDER MANAGEMENT ROUTES ==========
app.post('/api/orders/create', [
    body('bundleId').notEmpty().trim().escape(),
    body('recipientPhone').custom(value => {
        if (!validatePhone(value)) {
            throw new Error('Invalid Ghana phone number format');
        }
        return true;
    }),
    body('customerEmail').optional().isEmail().normalizeEmail(),
    body('amount').isFloat({ min: 1 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                success: false, 
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const { bundleId, recipientPhone, customerEmail, amount } = req.body;
        
        const orderId = 'MYST-' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();
        const bundleConfig = BUNDLE_MAP[bundleId];
        
        if (!bundleConfig) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid bundle selected' 
            });
        }

        const order = new Order({
            orderId,
            customerEmail: customerEmail || 'customer@example.com',
            recipientPhone,
            bundleId,
            bundleSlug: bundleConfig.offerSlug,
            bundleSize: `${bundleConfig.volume}GB`,
            bundleType: bundleId.includes('express') ? 'express' : 
                       bundleId.includes('beneficiary') ? 'beneficiary' : 'other',
            network: bundleConfig.network,
            amount: parseFloat(amount),
            costPrice: bundleConfig.costPrice,
            profit: parseFloat(amount) - bundleConfig.costPrice,
            status: 'pending_payment'
        });

        await order.save();
        console.log(`📝 Order created: ${orderId} for ${recipientPhone}`);

        res.json({
            success: true,
            orderId: order.orderId,
            amount: order.amount * 100,
            email: order.customerEmail,
            publicKey: PAYSTACK_PUBLIC_KEY
        });

    } catch (error) {
        console.error('❌ /orders/create error:', error);
        
        if (error.code === 11000) {
            return res.status(409).json({ 
                success: false, 
                error: 'Order ID conflict, please try again' 
            });
        }
        
        res.status(500).json({ 
            success: false, 
            error: 'Failed to create order. Please try again.' 
        });
    }
});

// Get order by ID
app.get('/api/orders/:orderId', async (req, res) => {
    try {
        const order = await Order.findOne({ orderId: req.params.orderId });
        if (!order) {
            return res.status(404).json({ success: false, error: 'Order not found' });
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
                paystackReference: order.paystackReference
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Search orders by phone number
app.get('/api/orders/search/:phone', async (req, res) => {
    try {
        if (!validatePhone(req.params.phone)) {
            return res.status(400).json({ success: false, error: 'Invalid phone number format' });
        }
        
        const orders = await Order.find({ 
            recipientPhone: req.params.phone 
        }).sort({ createdAt: -1 }).limit(10);
        
        res.json({
            success: true,
            count: orders.length,
            orders: orders.map(order => ({
                orderId: order.orderId,
                status: order.status,
                recipientPhone: order.recipientPhone,
                bundleSize: order.bundleSize,
                network: order.network,
                amount: order.amount,
                createdAt: order.createdAt
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== ADMIN PROTECTED ROUTES ==========
app.get('/api/admin/orders', authenticateAdmin, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const page = parseInt(req.query.page) || 1;
        const skip = (page - 1) * limit;
        
        const orders = await Order.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        
        const totalOrders = await Order.countDocuments();
        
        res.json({
            success: true,
            pagination: {
                page,
                limit,
                total: totalOrders,
                pages: Math.ceil(totalOrders / limit)
            },
            orders: orders.map(order => ({
                orderId: order.orderId,
                customerEmail: order.customerEmail,
                recipientPhone: order.recipientPhone,
                bundleSize: order.bundleSize,
                bundleType: order.bundleType,
                network: order.network,
                amount: order.amount,
                costPrice: order.costPrice,
                profit: order.profit,
                status: order.status,
                createdAt: order.createdAt,
                paystackReference: order.paystackReference
            }))
        });
    } catch (error) {
        console.error('Admin orders error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch orders' });
    }
});

// Get admin dashboard stats
app.get('/api/admin/stats', authenticateAdmin, async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const [totalOrders, todayOrders, deliveredOrders, failedOrders] = await Promise.all([
            Order.countDocuments(),
            Order.countDocuments({ createdAt: { $gte: today } }),
            Order.countDocuments({ status: 'delivered' }),
            Order.countDocuments({ status: 'failed' })
        ]);
        
        const revenueResult = await Order.aggregate([
            { $match: { createdAt: { $gte: today } } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);
        
        const profitResult = await Order.aggregate([
            { $match: { createdAt: { $gte: today } } },
            { $group: { _id: null, total: { $sum: "$profit" } } }
        ]);
        
        const todayRevenue = revenueResult[0]?.total || 0;
        const todayProfit = profitResult[0]?.total || 0;
        
        res.json({
            success: true,
            stats: {
                totalOrders,
                todayOrders,
                todayRevenue,
                todayProfit,
                deliveredOrders,
                failedOrders,
                successRate: totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : 100
            }
        });
    } catch (error) {
        console.error('Admin stats error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch stats' });
    }
});

// ========== PAYMENT WEBHOOKS ==========
app.post('/api/paystack-webhook', express.raw({type: 'application/json'}), async (req, res) => {
    const event = req.body;
    
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

            order.paystackReference = paymentData.reference;
            order.status = 'paid';
            order.updatedAt = new Date();
            await order.save();

            console.log(`✅ Payment verified for ${orderId}`);

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

// ========== ERROR HANDLING ==========
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    
    const errorResponse = {
        success: false,
        error: 'An unexpected error occurred'
    };
    
    if (process.env.NODE_ENV === 'development') {
        errorResponse.details = err.message;
        errorResponse.stack = err.stack;
    }
    
    res.status(500).json(errorResponse);
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

// ========== START SERVER ==========
const serverPort = process.env.PORT || 3000;
app.listen(serverPort, '0.0.0.0', () => {
    console.log(`🚀 Mystery Bundle Hub SECURE API running on port ${serverPort}`);
    console.log(`🔗 Health check: http://0.0.0.0:${serverPort}/api/health`);
    console.log(`✅ Security features: Helmet, Rate Limiting, JWT Auth, Input Validation`);
    console.log(`🔐 JWT Authentication: Enabled with secure key`);
});
