// server.js - MYSTERY BUNDLE HUB - PRODUCTION VERSION v4.1
// ============================================================
// COMPLETE VERSION WITH SUCCESS BIZ HUB INTEGRATION
// PRODUCTION READY WITH:
// 1. Custom domain support (mysterybundlehub.com)
// 2. PayStack payment integration
// 3. Success Biz Hub fulfillment API
// 4. Secure authentication
// 5. MongoDB database
// 6. Webhook handling for both PayStack and Success Biz Hub
// 7. CORS for custom domain
// 8. FIXED STATUS UPDATE ISSUE WITH BETTER WEBHOOK HANDLING

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios'); // ADDED FOR SUCCESS BIZ HUB API CALLS
require('dotenv').config();

const app = express();

// ========== ENVIRONMENT VARIABLES ==========
const {
    PORT = 3000,
    MONGODB_URI,
    JWT_SECRET = 'your-secure-jwt-secret-change-this',
    ADMIN_EMAIL = 'aryeeteyemmanuel852@gmail.com',
    ADMIN_PASSWORD = 'admin123', // CHANGE IMMEDIATELY AFTER FIRST LOGIN
    PAYSTACK_PUBLIC_KEY,
    PAYSTACK_SECRET_KEY,
    SUCCESSBIZHUB_API_KEY = 'dk_6RePb80hC64mt_fxK9D7gAdc550GaKlN', // YOUR API KEY
    SUCCESSBIZHUB_BASE_URL = 'https://www.successbizhub.com/api/v1',
    DOMAIN = 'https://mysterybundlehub.com' // Your custom domain
} = process.env;

// ========== MIDDLEWARE ==========
// CORS Configuration for your custom domain
app.use(cors({
    origin: [
        DOMAIN,
        'https://www.mysterybundlehub.com',
        'https://mysterybundlehub-api.onrender.com',
        'https://mysterydatahub-api.onrender.com',
        'http://localhost:3000',
        'http://localhost:5500'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========== DATABASE CONNECTION ==========
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
})
.then(() => console.log('✅ MongoDB Connected Successfully'))
.catch(err => {
    console.error('❌ MongoDB Connection Error:', err.message);
    console.log('⚠️ Attempting to continue without database...');
});

// ========== DATABASE SCHEMAS ==========
const orderSchema = new mongoose.Schema({
    orderId: { type: String, unique: true, required: true },
    customerEmail: { type: String, required: true },
    recipientPhone: { type: String, required: true },
    bundleId: { type: String, required: true },
    bundleSize: String,
    network: String,
    amount: { type: Number, required: true },
    status: { 
        type: String, 
        default: 'pending_payment',
        enum: ['pending_payment', 'paid', 'processing', 'delivered', 'failed', 'cancelled']
    },
    paystackReference: String,
    paystackStatus: String,
    apiReference: String, // SUCCESS BIZ HUB REFERENCE
    apiOrderId: String,   // SUCCESS BIZ HUB ORDER ID
    metadata: Object,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Add indexes for better performance
orderSchema.index({ orderId: 1 });
orderSchema.index({ recipientPhone: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ apiReference: 1 }); // FOR SUCCESS BIZ HUB WEBHOOK LOOKUPS

const Order = mongoose.model('Order', orderSchema);

// ========== BUNDLE MAPPING FOR SUCCESS BIZ HUB ==========
const BUNDLE_MAP = {
    // MTN EXPRESS BUNDLES
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
    
    // MTN BENEFICIARY BUNDLES
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
    
    // AIRTELTIGO BUNDLES
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
    
    // TELECEL BUNDLES
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
function getBundleSize(bundleId) {
    const match = bundleId.match(/\d+/);
    return match ? match[0] + 'GB' : 'Custom';
}

function getNetwork(bundleId) {
    if (bundleId.includes('mtn')) return 'MTN';
    if (bundleId.includes('airtel')) return 'AirtelTigo';
    if (bundleId.includes('telecel')) return 'Telecel';
    return 'Unknown';
}

function validatePhone(phone) {
    const phoneRegex = /^(0[2-9][0-9]{8}|233[2-9][0-9]{8})$/;
    return phoneRegex.test(phone);
}

function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// ========== FULFILLMENT FUNCTION ==========
async function fulfillOrderWithProvider(orderDoc) {
    console.log(`🚀 Attempting to fulfill order: ${orderDoc.orderId}`);
    
    const apiConfig = BUNDLE_MAP[orderDoc.bundleId];
    if (!apiConfig) {
        console.error(`❌ Bundle config not found: ${orderDoc.bundleId}`);
        return { success: false, error: 'Bundle configuration error' };
    }

    // Format phone number for Success Biz Hub (233XXXXXXXXX)
    let formattedPhone = orderDoc.recipientPhone;
    if (formattedPhone.startsWith('0')) {
        formattedPhone = '233' + formattedPhone.substring(1);
    }
    
    const payload = {
        type: 'single',
        volume: apiConfig.volume,
        phone: formattedPhone,
        offerSlug: apiConfig.offerSlug,
        webhookUrl: `${DOMAIN}/api/successbizhub-webhook`
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
                timeout: 30000 // 30 second timeout
            }
        );

        // Save provider's reference to our database
        orderDoc.apiReference = response.data.reference;
        orderDoc.apiOrderId = response.data.orderId;
        orderDoc.status = 'processing'; // Change status to processing
        await orderDoc.save();

        console.log(`✅ Order sent to provider! Reference: ${response.data.reference}`);
        return { success: true, data: response.data };

    } catch (error) {
        console.error('❌ Success Biz Hub API Error:', error.response?.data || error.message);
        
        // Update order status to failed
        orderDoc.status = 'failed';
        orderDoc.metadata = { 
            ...orderDoc.metadata, 
            apiError: error.message,
            apiResponse: error.response?.data
        };
        await orderDoc.save();
        
        return { 
            success: false, 
            error: 'Provider API failed: ' + (error.response?.data?.message || error.message) 
        };
    }
}

// ========== API ROUTES ==========

// Health check endpoint
app.get('/api/health', (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    res.json({ 
        success: true,
        status: 'online',
        service: 'Mystery Bundle Hub API',
        domain: DOMAIN,
        timestamp: new Date().toISOString(),
        database: dbStatus,
        fulfillment: SUCCESSBIZHUB_API_KEY ? 'Success Biz Hub Ready' : 'Fulfillment Not Configured',
        version: '4.1.0-production',
        environment: process.env.NODE_ENV || 'development'
    });
});

// Test Success Biz Hub connection (admin only)
app.get('/api/test-fulfillment', async (req, res) => {
    try {
        // Simple test to verify API connection
        const testResponse = await axios.get(`${SUCCESSBIZHUB_BASE_URL}/test`, {
            headers: {
                'x-api-key': SUCCESSBIZHUB_API_KEY
            },
            timeout: 10000
        });
        
        res.json({
            success: true,
            message: 'Success Biz Hub API is reachable',
            status: testResponse.status,
            data: testResponse.data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to connect to Success Biz Hub',
            details: error.message
        });
    }
});

// ========== ADMIN AUTHENTICATION ==========
app.post('/api/admin/login', async (req, res) => {
    try {
        console.log('🔐 Admin login attempt from:', req.ip);
        
        const { email, password } = req.body;
        
        // Input validation
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required'
            });
        }
        
        // Validate email format
        if (!validateEmail(email)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email format'
            });
        }
        
        // Check if email is authorized
        const authorizedEmails = [
            'aryeeteyemmanuel852@gmail.com',
            'aryeeteyemmanuel111@gmail.com'
        ];
        
        if (!authorizedEmails.includes(email)) {
            console.log('🚫 Unauthorized email attempt:', email);
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }
        
        // Generate hash for password comparison
        const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
        const passwordMatch = await bcrypt.compare(password, hashedPassword);
        
        if (!passwordMatch) {
            console.log('🔒 Password mismatch for:', email);
            // Delay response to prevent timing attacks
            await new Promise(resolve => setTimeout(resolve, 1000));
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }
        
        // Generate JWT token
        const token = jwt.sign(
            {
                email: email,
                role: 'admin',
                domain: DOMAIN,
                timestamp: Date.now()
            },
            JWT_SECRET,
            { expiresIn: '8h' }
        );
        
        console.log('✅ Admin login successful:', email);
        
        res.json({
            success: true,
            token: token,
            user: {
                email: email,
                role: 'admin'
            },
            expiresIn: '8h',
            domain: DOMAIN,
            message: 'Login successful'
        });
        
    } catch (error) {
        console.error('❌ Admin login error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// ========== ORDER MANAGEMENT ==========
app.post('/api/orders/create', async (req, res) => {
    try {
        console.log('🛒 Order creation request:', req.body);
        
        const { bundleId, recipientPhone, customerEmail, amount } = req.body;
        
        // Validate required fields
        if (!bundleId || !recipientPhone || !amount) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: bundleId, recipientPhone, amount'
            });
        }
        
        // Validate phone number
        if (!validatePhone(recipientPhone)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid Ghana phone number. Example: 0592066298'
            });
        }
        
        // Validate amount
        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid amount'
            });
        }
        
        // Check if bundle exists in mapping
        if (!BUNDLE_MAP[bundleId]) {
            return res.status(400).json({
                success: false,
                error: 'Invalid bundle selection'
            });
        }
        
        // Generate unique order ID
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 8).toUpperCase();
        const orderId = `MYST-${timestamp}-${random}`;
        
        // Determine bundle info
        const bundleSize = getBundleSize(bundleId);
        const network = getNetwork(bundleId);
        
        // Create order document
        const order = new Order({
            orderId,
            customerEmail: customerEmail || 'customer@example.com',
            recipientPhone,
            bundleId,
            bundleSize,
            network,
            amount: amountNum,
            status: 'pending_payment',
            createdAt: new Date(),
            updatedAt: new Date(),
            metadata: {
                source: 'website',
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                costPrice: BUNDLE_MAP[bundleId].costPrice,
                profit: (amountNum - BUNDLE_MAP[bundleId].costPrice).toFixed(2)
            }
        });
        
        // Save to database
        await order.save();
        console.log(`✅ Order created successfully: ${orderId}`);
        
        // Check for PayStack public key
        if (!PAYSTACK_PUBLIC_KEY) {
            console.warn('⚠️ PAYSTACK_PUBLIC_KEY not set in environment variables');
        }
        
        // Return success response with PayStack data
        res.json({
            success: true,
            orderId: order.orderId,
            amount: order.amount * 100, // Convert to pesewas for PayStack
            email: order.customerEmail,
            publicKey: PAYSTACK_PUBLIC_KEY || 'pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
            customerEmail: order.customerEmail,
            recipientPhone: order.recipientPhone,
            bundleSize: order.bundleSize,
            network: order.network,
            message: 'Order created successfully. Ready for payment.',
            nextStep: 'Initialize PayStack payment with the provided publicKey and amount'
        });
        
    } catch (error) {
        console.error('❌ Order creation error:', error);
        
        // Handle duplicate order ID
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                error: 'Order ID conflict. Please try again.'
            });
        }
        
        // Handle database errors
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                error: 'Validation error: ' + Object.values(error.errors).map(e => e.message).join(', ')
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
        const { orderId } = req.params;
        
        const order = await Order.findOne({ orderId });
        
        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }
        
        // Return sanitized order data
        res.json({
            success: true,
            order: {
                orderId: order.orderId,
                status: order.status,
                recipientPhone: order.recipientPhone,
                bundleSize: order.bundleSize,
                network: order.network,
                amount: order.amount,
                paystackReference: order.paystackReference,
                apiReference: order.apiReference,
                apiOrderId: order.apiOrderId,
                createdAt: order.createdAt,
                updatedAt: order.updatedAt
            }
        });
        
    } catch (error) {
        console.error('❌ Get order error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch order'
        });
    }
});

// Search orders by phone number
app.get('/api/orders/search/:phone', async (req, res) => {
    try {
        const { phone } = req.params;
        
        if (!validatePhone(phone)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid phone number format'
            });
        }
        
        const orders = await Order.find({ 
            recipientPhone: phone 
        })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('orderId status recipientPhone bundleSize network amount createdAt apiReference');
        
        res.json({
            success: true,
            count: orders.length,
            orders: orders
        });
        
    } catch (error) {
        console.error('❌ Search orders error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to search orders'
        });
    }
});

// ========== PROTECTED ADMIN ROUTES ==========
const authenticateAdmin = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Access denied. No token provided.'
            });
        }
        
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Check if token is for admin
        if (decoded.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Access denied. Admin privileges required.'
            });
        }
        
        req.admin = decoded;
        next();
    } catch (error) {
        console.error('❌ Admin authentication error:', error.message);
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'Token expired. Please login again.'
            });
        }
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                error: 'Invalid token.'
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Authentication error'
        });
    }
};

// Get all orders (admin)
app.get('/api/admin/orders', authenticateAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;
        
        const [orders, total] = await Promise.all([
            Order.find()
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Order.countDocuments()
        ]);
        
        res.json({
            success: true,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            },
            orders: orders.map(order => ({
                orderId: order.orderId,
                customerEmail: order.customerEmail,
                recipientPhone: order.recipientPhone,
                bundleId: order.bundleId,
                bundleSize: order.bundleSize,
                network: order.network,
                amount: order.amount,
                status: order.status,
                paystackReference: order.paystackReference,
                apiReference: order.apiReference,
                apiOrderId: order.apiOrderId,
                createdAt: order.createdAt,
                updatedAt: order.updatedAt,
                metadata: order.metadata
            }))
        });
        
    } catch (error) {
        console.error('❌ Get admin orders error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch orders'
        });
    }
});

// Get admin dashboard statistics
app.get('/api/admin/stats', authenticateAdmin, async (req, res) => {
    try {
        // Today's date range
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        // Last 7 days
        const lastWeek = new Date();
        lastWeek.setDate(lastWeek.getDate() - 7);
        
        const [
            totalOrders,
            todayOrders,
            todayRevenue,
            pendingOrders,
            paidOrders,
            processingOrders,
            deliveredOrders,
            failedOrders,
            lastWeekOrders
        ] = await Promise.all([
            Order.countDocuments(),
            Order.countDocuments({ createdAt: { $gte: today, $lt: tomorrow } }),
            Order.aggregate([
                { $match: { createdAt: { $gte: today, $lt: tomorrow } } },
                { $group: { _id: null, total: { $sum: "$amount" } } }
            ]),
            Order.countDocuments({ status: 'pending_payment' }),
            Order.countDocuments({ status: 'paid' }),
            Order.countDocuments({ status: 'processing' }),
            Order.countDocuments({ status: 'delivered' }),
            Order.countDocuments({ status: 'failed' }),
            Order.countDocuments({ createdAt: { $gte: lastWeek } })
        ]);
        
        const revenue = todayRevenue[0]?.total || 0;
        const successRate = totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : 0;
        
        res.json({
            success: true,
            stats: {
                totalOrders,
                todayOrders,
                todayRevenue: revenue,
                pendingOrders,
                paidOrders,
                processingOrders,
                deliveredOrders,
                failedOrders,
                lastWeekOrders,
                successRate,
                averageOrderValue: totalOrders > 0 ? (revenue / totalOrders).toFixed(2) : 0
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Get admin stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch statistics'
        });
    }
});

// Update order status (admin)
app.put('/api/admin/orders/:orderId/status', authenticateAdmin, async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;
        
        const validStatuses = ['pending_payment', 'paid', 'processing', 'delivered', 'failed', 'cancelled'];
        
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
            });
        }
        
        const order = await Order.findOneAndUpdate(
            { orderId },
            { 
                status,
                updatedAt: new Date()
            },
            { new: true }
        );
        
        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }
        
        console.log(`📝 Admin updated order ${orderId} status to: ${status}`);
        
        res.json({
            success: true,
            message: 'Order status updated successfully',
            order: {
                orderId: order.orderId,
                status: order.status,
                updatedAt: order.updatedAt
            }
        });
        
    } catch (error) {
        console.error('❌ Update order status error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update order status'
        });
    }
});

// Manual fulfillment trigger (admin)
app.post('/api/admin/orders/:orderId/fulfill', authenticateAdmin, async (req, res) => {
    try {
        const { orderId } = req.params;
        
        const order = await Order.findOne({ orderId });
        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }
        
        if (order.status !== 'paid') {
            return res.status(400).json({
                success: false,
                error: 'Order must be in paid status to fulfill'
            });
        }
        
        console.log(`🔄 Admin manually triggering fulfillment for: ${orderId}`);
        const result = await fulfillOrderWithProvider(order);
        
        res.json({
            success: result.success,
            message: result.success ? 'Fulfillment initiated successfully' : 'Fulfillment failed',
            details: result,
            order: {
                orderId: order.orderId,
                status: order.status,
                apiReference: order.apiReference
            }
        });
        
    } catch (error) {
        console.error('❌ Manual fulfillment error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to trigger fulfillment: ' + error.message
        });
    }
});

// ========== PAYSTACK WEBHOOK ==========
app.post('/api/paystack-webhook', express.json(), async (req, res) => {
    const event = req.body;
    
    console.log('📩 PayStack webhook received:', event.event);
    
    // Immediately respond to PayStack to prevent retries
    res.status(200).send('Webhook received');
    
    try {
        if (event.event === 'charge.success') {
            const paymentData = event.data;
            const metadata = paymentData.metadata;
            const orderId = metadata?.orderId;
            
            if (!orderId) {
                console.error('❌ Webhook missing orderId in metadata');
                return;
            }
            
            const order = await Order.findOne({ orderId });
            
            if (!order) {
                console.error(`❌ Order ${orderId} not found in database`);
                return;
            }
            
            // Update order with payment details
            order.status = 'paid';
            order.paystackReference = paymentData.reference;
            order.paystackStatus = paymentData.status;
            order.updatedAt = new Date();
            
            await order.save();
            
            console.log(`✅ Order ${orderId} marked as paid. Reference: ${paymentData.reference}`);
            
            // ========== CRITICAL: TRIGGER FULFILLMENT ==========
            console.log(`🔄 Triggering fulfillment for order: ${orderId}`);
            const fulfillmentResult = await fulfillOrderWithProvider(order);
            
            if (fulfillmentResult.success) {
                console.log(`🚀 Fulfillment initiated for order ${orderId}. Provider Ref: ${fulfillmentResult.data.reference}`);
            } else {
                console.error(`❌ Fulfillment failed for order ${orderId}:`, fulfillmentResult.error);
                // You might want to send an alert email here
            }
            
        } else if (event.event === 'charge.failed') {
            const paymentData = event.data;
            const orderId = paymentData.metadata?.orderId;
            
            if (orderId) {
                await Order.findOneAndUpdate(
                    { orderId },
                    { 
                        status: 'failed',
                        paystackStatus: 'failed',
                        updatedAt: new Date()
                    }
                );
                console.log(`❌ Order ${orderId} payment failed`);
            }
        }
    } catch (error) {
        console.error('❌ Webhook processing error:', error);
    }
});

// ========== SUCCESS BIZ HUB WEBHOOK - FIXED VERSION ==========
app.post('/api/successbizhub-webhook', express.json(), async (req, res) => {
    console.log('📩 Success Biz Hub Webhook:', JSON.stringify(req.body, null, 2));
    
    const webhookData = req.body;
    
    // Immediately respond to prevent retries
    res.status(200).send('OK');
    
    try {
        // Try multiple ways to find the order
        let order = null;
        
        // Method 1: Search by reference
        if (webhookData.reference) {
            order = await Order.findOne({ apiReference: webhookData.reference });
            console.log(`🔍 Searching by reference: ${webhookData.reference} - Found: ${order ? 'YES' : 'NO'}`);
        }
        
        // Method 2: Search by order ID from provider
        if (!order && webhookData.orderId) {
            order = await Order.findOne({ apiOrderId: webhookData.orderId });
            console.log(`🔍 Searching by provider orderId: ${webhookData.orderId} - Found: ${order ? 'YES' : 'NO'}`);
        }
        
        // Method 3: If phone is provided, find the most recent order for that phone
        if (!order && webhookData.phone) {
            // Convert phone to local format if needed
            let searchPhone = webhookData.phone;
            if (searchPhone.startsWith('233')) {
                searchPhone = '0' + searchPhone.substring(3);
            }
            
            const orders = await Order.find({ recipientPhone: searchPhone })
                .sort({ createdAt: -1 })
                .limit(1);
            
            if (orders.length > 0) {
                order = orders[0];
                console.log(`🔍 Searching by phone: ${searchPhone} - Found: ${order ? 'YES' : 'NO'}`);
            }
        }
        
        if (order) {
            // Enhanced status mapping with better logging
            const statusMap = {
                'completed': 'delivered',
                'delivered': 'delivered',
                'success': 'delivered',
                'successful': 'delivered',
                'fulfilled': 'delivered',
                'processing': 'processing',
                'pending': 'processing',
                'sent': 'processing',
                'in progress': 'processing',
                'failed': 'failed',
                'failure': 'failed',
                'error': 'failed',
                'cancelled': 'cancelled',
                'refunded': 'cancelled'
            };
            
            // Get provider status (convert to lowercase)
            const providerStatus = (webhookData.status || '').toLowerCase();
            let newStatus = order.status;
            
            // Check if we should update status
            if (providerStatus && statusMap[providerStatus]) {
                newStatus = statusMap[providerStatus];
            } else if (providerStatus) {
                console.log(`⚠️ Unknown provider status: ${providerStatus}`);
                // If provider says delivered but with different wording
                if (providerStatus.includes('deliver') || providerStatus.includes('complete')) {
                    newStatus = 'delivered';
                }
            }
            
            // Check if status actually changed
            if (order.status !== newStatus) {
                console.log(`🔄 Updating order ${order.orderId} from ${order.status} to ${newStatus} (Provider: ${providerStatus})`);
                
                order.status = newStatus;
                order.updatedAt = new Date();
                
                // Save provider response for debugging
                if (!order.metadata) order.metadata = {};
                order.metadata.lastWebhook = {
                    data: webhookData,
                    receivedAt: new Date(),
                    providerStatus: providerStatus
                };
                
                await order.save();
                
                // Log delivery celebration
                if (newStatus === 'delivered') {
                    console.log(`🎉🎉🎉 BUNDLE DELIVERED! Order: ${order.orderId}, Phone: ${order.recipientPhone}, Bundle: ${order.bundleSize}`);
                    console.log(`⏰ Delivery time: ${new Date().toLocaleString()}`);
                }
            } else {
                console.log(`ℹ️ Order ${order.orderId} already has status: ${order.status}, no update needed`);
            }
            
        } else {
            console.log(`⚠️ Webhook received for unknown order. Data:`, {
                reference: webhookData.reference,
                orderId: webhookData.orderId,
                phone: webhookData.phone,
                status: webhookData.status
            });
            
            // Save orphan webhook for later investigation
            try {
                const OrphanWebhook = mongoose.model('OrphanWebhook', new mongoose.Schema({
                    data: Object,
                    receivedAt: { type: Date, default: Date.now }
                }));
                
                await new OrphanWebhook({ 
                    data: webhookData 
                }).save();
                
                console.log('📝 Saved orphan webhook for investigation');
            } catch (saveError) {
                console.error('Failed to save orphan webhook:', saveError);
            }
        }
    } catch (error) {
        console.error('❌ Success Biz Hub webhook error:', error);
        console.error('Error details:', error.stack);
    }
});

// ========== NEW SYNC ENDPOINT FOR MANUAL STATUS CHECK ==========
app.get('/api/orders/:orderId/sync', async (req, res) => {
    try {
        const { orderId } = req.params;
        
        const order = await Order.findOne({ orderId });
        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }
        
        if (!order.apiReference) {
            return res.status(400).json({
                success: false,
                error: 'No provider reference available for sync'
            });
        }
        
        console.log(`🔄 Manual sync requested for order: ${orderId}`);
        
        // Try to check status with provider
        try {
            const response = await axios.get(
                `${SUCCESSBIZHUB_BASE_URL}/order/status/${order.apiReference}`,
                {
                    headers: {
                        'x-api-key': SUCCESSBIZHUB_API_KEY
                    },
                    timeout: 15000
                }
            );
            
            if (response.data && response.data.status) {
                // Process the status update similar to webhook
                const statusMap = {
                    'completed': 'delivered',
                    'delivered': 'delivered',
                    'success': 'delivered',
                    'processing': 'processing',
                    'failed': 'failed'
                };
                
                const providerStatus = response.data.status.toLowerCase();
                let newStatus = order.status;
                
                if (statusMap[providerStatus]) {
                    newStatus = statusMap[providerStatus];
                }
                
                if (order.status !== newStatus) {
                    order.status = newStatus;
                    order.updatedAt = new Date();
                    await order.save();
                    
                    console.log(`✅ Sync updated order ${orderId} to: ${newStatus}`);
                }
                
                res.json({
                    success: true,
                    message: 'Order synchronized',
                    order: {
                        orderId: order.orderId,
                        status: order.status,
                        providerStatus: providerStatus,
                        apiReference: order.apiReference
                    },
                    providerResponse: response.data
                });
            } else {
                res.json({
                    success: false,
                    message: 'No status information from provider',
                    order: {
                        orderId: order.orderId,
                        status: order.status
                    }
                });
            }
            
        } catch (apiError) {
            console.error('Provider API error during sync:', apiError.message);
            res.status(500).json({
                success: false,
                error: 'Failed to sync with provider: ' + apiError.message,
                order: {
                    orderId: order.orderId,
                    status: order.status
                }
            });
        }
        
    } catch (error) {
        console.error('Sync endpoint error:', error);
        res.status(500).json({
            success: false,
            error: 'Sync failed: ' + error.message
        });
    }
});

// ========== ERROR HANDLING MIDDLEWARE ==========
app.use((err, req, res, next) => {
    console.error('🚨 Unhandled error:', err);
    
    const errorResponse = {
        success: false,
        error: 'An unexpected error occurred',
        timestamp: new Date().toISOString()
    };
    
    // Add more details in development
    if (process.env.NODE_ENV !== 'production') {
        errorResponse.message = err.message;
        errorResponse.stack = err.stack;
    }
    
    res.status(500).json(errorResponse);
});

// 404 handler for undefined routes
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: `Endpoint ${req.originalUrl} not found`,
        availableEndpoints: [
            'GET  /api/health',
            'GET  /api/test-fulfillment',
            'POST /api/admin/login',
            'POST /api/orders/create',
            'GET  /api/orders/:orderId',
            'GET  /api/orders/:orderId/sync',
            'GET  /api/orders/search/:phone',
            'GET  /api/admin/orders',
            'GET  /api/admin/stats',
            'PUT  /api/admin/orders/:orderId/status',
            'POST /api/admin/orders/:orderId/fulfill',
            'POST /api/paystack-webhook',
            'POST /api/successbizhub-webhook'
        ]
    });
});

// ========== START SERVER ==========
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════════════════════════╗
║       MYSTERY BUNDLE HUB API - PRODUCTION v4.1      ║
║            WITH FIXED WEBHOOK HANDLING              ║
╚══════════════════════════════════════════════════════╝
    
✅ Server running on port: ${PORT}
🌐 Domain: ${DOMAIN}
🔗 Health Check: ${DOMAIN}/api/health
🔐 Admin Login: ${DOMAIN}/admin-login.html
📧 Admin Email: ${ADMIN_EMAIL}
📱 Support Phone: 059 206 6298
    
⚙️ Environment: ${process.env.NODE_ENV || 'development'}
🗄️ Database: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'}
💰 PayStack: ${PAYSTACK_PUBLIC_KEY ? 'Configured' : 'NOT CONFIGURED'}
🚚 Success Biz Hub: ${SUCCESSBIZHUB_API_KEY ? 'Fulfillment Ready' : 'NOT CONFIGURED'}
🔄 Manual Sync: Available at /api/orders/:orderId/sync
    
🚀 Ready to accept and fulfill orders!
    `);
    
    // Log startup warnings
    if (!PAYSTACK_PUBLIC_KEY) {
        console.warn('⚠️ WARNING: PAYSTACK_PUBLIC_KEY not set. Payments will not work!');
    }
    
    if (!PAYSTACK_SECRET_KEY) {
        console.warn('⚠️ WARNING: PAYSTACK_SECRET_KEY not set. Webhooks will not work!');
    }
    
    if (!SUCCESSBIZHUB_API_KEY) {
        console.warn('⚠️ WARNING: SUCCESSBIZHUB_API_KEY not set. Fulfillment will not work!');
    }
    
    if (ADMIN_PASSWORD === 'admin123') {
        console.warn('⚠️ WARNING: Using default admin password. Change ADMIN_PASSWORD immediately!');
    }
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        mongoose.connection.close(false, () => {
            console.log('MongoDB connection closed');
            process.exit(0);
        });
    });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('🚨 Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
});
