/**
 * Main Express Application for SunPower ERP
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import { config } from './config/index.js';
import { requestIdMiddleware } from './middleware/request-id.js';
import { errorHandler } from './middleware/error-handler.js';
import { AppError } from './utils/response.js';

import { authRouter } from './modules/auth/auth.routes.js';
import { userRouter } from './modules/users/user.routes.js';
import crmRouter from './modules/crm/crm.routes.js';

export const app = express();

// Security HTTP headers
app.use(helmet());

// CORS configuration (strictly allow configured client origin with credentials)
app.use(cors({
  origin: config.CLIENT_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Idempotency-Key']
}));

// Parsers
app.use(cookieParser(config.COOKIE_SECRET));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Request correlation ID
app.use(requestIdMiddleware);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    environment: config.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// Mount API v1 Routers
const apiV1 = express.Router();
apiV1.use('/auth', authRouter);
apiV1.use('/users', userRouter);
apiV1.use('/crm', crmRouter);
apiV1.use('/', crmRouter);

app.use('/api/v1', apiV1);

// 404 Not Found Handler
app.use((req, res, next) => {
  next(new AppError(`Endpoint not found: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND'));
});

// Global Error Handler
app.use(errorHandler);

export default app;
