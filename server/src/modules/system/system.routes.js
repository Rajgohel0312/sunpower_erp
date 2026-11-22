/**
 * System Management & Diagnostics Routes for SunPower ERP
 * Handles SMTP testing, health diagnostics, and environment status.
 */

import express from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { sendSuccess, AppError } from '../../utils/response.js';
import { mailService } from '../../services/mail.service.js';
import { config } from '../../config/index.js';
import { z } from 'zod';

const router = express.Router();

const testEmailSchema = z.object({
  to: z.string().email('Invalid email address')
});

/**
 * GET /api/v1/system/email/status
 * Returns current SMTP configuration status
 */
router.get('/email/status', authenticate, requireRole(['SUPER_ADMIN']), (req, res) => {
  const isConfigured = Boolean(config.SMTP_HOST && config.SMTP_USER);

  return sendSuccess(res, {
    configured: isConfigured,
    host: config.SMTP_HOST || 'Not Configured (Using Development Console Stream)',
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    from: config.SMTP_FROM,
    user: config.SMTP_USER ? `${config.SMTP_USER.slice(0, 3)}***@***` : 'None'
  }, 'SMTP status retrieved successfully');
});

/**
 * POST /api/v1/system/email/test
 * Sends a live verification test email via Nodemailer
 */
router.post('/email/test', authenticate, requireRole(['SUPER_ADMIN']), async (req, res, next) => {
  try {
    const parse = testEmailSchema.safeParse(req.body);
    if (!parse.success) {
      throw new AppError('Valid destination email address is required', 400, 'INVALID_INPUT', parse.error.format());
    }

    const { to } = parse.data;
    const result = await mailService.sendTestEmail({ to });

    return sendSuccess(res, {
      sentTo: to,
      messageId: result.messageId,
      simulated: result.simulated
    }, result.simulated
      ? 'Development preview email logged to server console successfully.'
      : `Test email successfully dispatched to ${to} via ${config.SMTP_HOST}`);
  } catch (err) {
    next(err);
  }
});

export const systemRouter = router;
export default router;
