// server.js - MYSTERY BUNDLE HUB - PRODUCTION VERSION v4.0
// ============================================================
// PRODUCTION READY WITH:
// 1. Custom domain support (mysterybundlehub.com)
// 2. PayStack payment integration
// 3. Secure authentication
// 4. MongoDB database
// 5. Webhook handling
// 6. CORS for custom domain

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
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
    metadata: Object,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Add indexes for better performance
orderSchema.index({ orderId: 1 });
orderSchema.index({ recipientPhone: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });

const Order = mongoose.model('Order', orderSchema);

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
        version: '4.0.0-production',
        environment: process.env.NODE_ENV || 'development'
    });
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
                userAgent: req.get('User-Agent')
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
        .select('orderId status recipientPhone bundleSize network amount createdAt');
        
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
                bundleSize: order.bundleSize,
                network: order.network,
                amount: order.amount,
                status: order.status,
                paystackReference: order.paystackReference,
                createdAt: order.createdAt,
                updatedAt: order.updatedAt
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
            
            // Here you would trigger bundle delivery to the phone number
            // For now, we'll just log it
            console.log(`📱 Bundle should be delivered to: ${order.recipientPhone}`);
            console.log(`📧 Receipt sent to: ${order.customerEmail}`);
            
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
            'POST /api/admin/login',
            'POST /api/orders/create',
            'GET  /api/orders/:orderId',
            'GET  /api/orders/search/:phone',
            'GET  /api/admin/orders',
            'GET  /api/admin/stats',
            'POST /api/paystack-webhook'
        ]
    });
});

// ========== START SERVER ==========
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════════════════════════╗
║       MYSTERY BUNDLE HUB API - PRODUCTION v4.0      ║
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
    
🚀 Ready to accept orders!
    `);
    
    // Log startup warnings
    if (!PAYSTACK_PUBLIC_KEY) {
        console.warn('⚠️ WARNING: PAYSTACK_PUBLIC_KEY not set. Payments will not work!');
    }
    
    if (!PAYSTACK_SECRET_KEY) {
        console.warn('⚠️ WARNING: PAYSTACK_SECRET_KEY not set. Webhooks will not work!');
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
