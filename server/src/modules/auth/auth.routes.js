/**
 * Authentication Express Router
 */

import { Router } from 'express';
import { authController } from './auth.controller.js';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import {
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema
} from './auth.schemas.js';

export const authRouter = Router();

authRouter.post('/login', validate({ body: loginSchema }), authController.login);
authRouter.post('/refresh', validate({ body: refreshTokenSchema }), authController.refresh);
authRouter.post('/logout', authController.logout);
authRouter.get('/me', authenticate, authController.me);
authRouter.post('/forgot-password', validate({ body: forgotPasswordSchema }), authController.forgotPassword);
authRouter.post('/reset-password', validate({ body: resetPasswordSchema }), authController.resetPassword);
authRouter.post('/change-password', authenticate, validate({ body: changePasswordSchema }), authController.changePassword);

export default authRouter;
