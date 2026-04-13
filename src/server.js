import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { connectDB } from './config/database.js';
import paymentRoutes from './routes/payment.routes.js';
import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';
import catalogRoutes from './routes/catalog.routes.js';
import { errorHandler } from './middleware/error.middleware.js';

dotenv.config();
connectDB();

const app = express();
const configuredCorsOrigins = String(process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const localOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    if (origin === 'null' || localOriginPattern.test(origin)) {
      return callback(null, true);
    }

    if (!configuredCorsOrigins.length) {
      return callback(null, true);
    }

    return callback(null, configuredCorsOrigins.includes(origin));
  },
  credentials: true
};

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 100
});

app.use(helmet());
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(morgan('dev'));
app.use(
  express.json({
    verify: (req, res, buf) => {
      if (req.originalUrl.includes('/api/payment/webhook')) {
        req.rawBody = buf;
      }
    }
  })
);
app.use((req, res, next) => {
  if (req.originalUrl.includes('/api/payment/webhook')) return next();
  return limiter(req, res, next);
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/payment', paymentRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
