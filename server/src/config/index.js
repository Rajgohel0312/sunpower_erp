/**
 * Centralized Application Configuration & Environment Validator
 */

import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  API_BASE_URL: z.string().default('http://localhost:5000/api/v1'),

  DATABASE_URL: z.string().default('postgresql://app_user:postgres@localhost:5432/sunpower_erp'),
  DB_POOL_MAX: z.coerce.number().default(20),

  JWT_ACCESS_SECRET: z.string().min(16).default('development_jwt_access_secret_sunpower_erp_min_32_chars!'),
  JWT_REFRESH_SECRET: z.string().min(16).default('development_jwt_refresh_secret_sunpower_erp_min_32_chars!'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('7d'),
  BCRYPT_ROUNDS: z.coerce.number().default(12),

  COOKIE_SECRET: z.string().default('development_cookie_secret_sunpower_erp'),
  STORAGE_ROOT: z.string().default('./storage'),
  MAX_UPLOAD_BYTES: z.coerce.number().default(10485760), // 10MB

  // SMTP Email Configuration (Nodemailer)
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM: z.string().default('"SunPower Solar ERP" <notifications@sunpower.com>'),
});

const parsed = configSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('[Config Error]: Invalid environment configuration:', parsed.error.format());
  throw new Error('Environment configuration validation failed');
}

export const config = parsed.data;
export default config;
