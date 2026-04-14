import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveFrontendDir() {
  const possiblePaths = [
    path.join(process.cwd(), 'Frontend'),
    path.join(__dirname, '../../Frontend'),
    process.cwd()
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(path.join(p, 'index.html'))) {
      console.log('Serving frontend from:', p);
      return p;
    }
  }

  console.error('❌ Frontend not found. Checked:', possiblePaths);
  return process.cwd();
}

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
  const frontendPath = resolveFrontendDir();
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
  app.use('/api/agent', agentRoutes);
  app.use('/api/agents', agentRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/catalog', catalogRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/payment', paymentRoutes);

  app.use(express.static(frontendPath));
  app.get('/', (req, res) => {
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
