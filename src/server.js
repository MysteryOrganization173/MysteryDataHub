import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { connectDB } from './config/database.js';
import agentRoutes from './routes/agent.routes.js';
import orderRoutes from './routes/order.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';
import catalogRoutes from './routes/catalog.routes.js';
import { errorHandler } from './middleware/error.middleware.js';
import { validateRuntimeConfig } from './config/runtime.js';
import { ensureSeedAdminAccount } from './services/admin-seed.service.js';
import { getNetworkStatusSetting, getWithdrawalConfig } from './services/agent-program.service.js';

dotenv.config();

async function bootstrap() {
  validateRuntimeConfig();
  const dbConnected = await connectDB();
  if (dbConnected) {
    await ensureSeedAdminAccount();
    await Promise.all([
      getNetworkStatusSetting(),
      getWithdrawalConfig()
    ]);
  }

  const app = express();
  const frontendPath = path.join(process.cwd(), 'Frontend');
  const configuredCorsOrigins = String(process.env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const localOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

  function normalizeOriginForCompare(value) {
    try {
      const url = new URL(String(value || '').trim());
      const host = url.host.toLowerCase();
      const baseHost = host.startsWith('www.') ? host.slice(4) : host;
      return `${url.protocol}//${baseHost}`;
    } catch {
      return String(value || '').trim().replace(/\/$/, '').toLowerCase();
    }
  }

  const normalizedCorsOrigins = configuredCorsOrigins.map(normalizeOriginForCompare);

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

      const normalized = normalizeOriginForCompare(origin);
      const allowed = normalizedCorsOrigins.includes(normalized);
      return callback(null, allowed);
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
  app.use('/api/agent', agentRoutes);
  app.use('/api/agents', agentRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/catalog', catalogRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/payment', paymentRoutes);

  console.log('Serving frontend from:', frontendPath);
  app.use(express.static(frontendPath));
  app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendPath, 'index.html'));
  });

  app.use(errorHandler);

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}

bootstrap().catch((error) => {
  console.error('❌ Backend startup failed:', error.message);
  process.exit(1);
});
