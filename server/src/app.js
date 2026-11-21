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
import { catalogRouter } from './modules/catalog/catalog.routes.js';
import { surveyRouter } from './modules/surveys/survey.routes.js';
import { bomRouter } from './modules/bom/bom.routes.js';
import { quotationRouter } from './modules/quotations/quotation.routes.js';
import { orderRouter } from './modules/orders/order.routes.js';
import inventoryRouter from './modules/inventory/inventory.routes.js';
import { procurementRouter, serialsRouter } from './modules/procurement/procurement.routes.js';

export const app = express();

// Security HTTP headers
app.use(helmet());

// CORS configuration (strictly allow configured client origin with credentials)
const allowedOrigins = new Set([
  config.CLIENT_ORIGIN,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5000',
  'http://127.0.0.1:5000'
]);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
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
apiV1.use('/catalog', catalogRouter);
apiV1.use('/surveys', surveyRouter);
apiV1.use('/boms', bomRouter);
apiV1.use('/quotations', quotationRouter);
apiV1.use('/orders', orderRouter);
apiV1.use('/inventory', inventoryRouter);
apiV1.use('/procurement', procurementRouter);
apiV1.use('/serials', serialsRouter);
apiV1.use('/', crmRouter);

app.use('/api/v1', apiV1);

// 404 Not Found Handler
app.use((req, res, next) => {
  next(new AppError(`Endpoint not found: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND'));
});

// Global Error Handler
app.use(errorHandler);

export default app;
