/**
 * Authentication HTTP Controller for SunPower ERP
 */

import { authService } from './auth.service.js';
import { sendSuccess } from '../../utils/response.js';
import { config } from '../../config/index.js';

// Standard cookie options for refresh token
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/api/v1/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};

export const authController = {
  /**
   * POST /api/v1/auth/login
   */
  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await authService.login({
        email,
        password,
        ipAddress,
        userAgent
      });

      // Set refresh token in HttpOnly cookie
      res.cookie('refresh_token', result.refreshToken, COOKIE_OPTIONS);

      return sendSuccess(res, {
        accessToken: result.accessToken,
        user: result.user
      }, { message: 'Authentication successful' });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/v1/auth/refresh
   */
  async refresh(req, res, next) {
    try {
      // Extract from cookie or body fallback
      const rawRefreshToken = req.cookies.refresh_token || req.body.refreshToken;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await authService.refreshTokens({
        rawRefreshToken,
        ipAddress,
        userAgent
      });

      res.cookie('refresh_token', result.refreshToken, COOKIE_OPTIONS);

      return sendSuccess(res, {
        accessToken: result.accessToken
      }, { message: 'Token refreshed' });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/v1/auth/logout
   */
  async logout(req, res, next) {
    try {
      const rawRefreshToken = req.cookies.refresh_token || req.body.refreshToken;
      await authService.logout({ rawRefreshToken });

      res.clearCookie('refresh_token', { ...COOKIE_OPTIONS, maxAge: 0 });

      return sendSuccess(res, null, { message: 'Logged out successfully' });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/v1/auth/me
   */
  async me(req, res, next) {
    try {
      return sendSuccess(res, {
        user: req.user
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/v1/auth/forgot-password
   */
  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      const result = await authService.forgotPassword({ email });
      return sendSuccess(res, null, { message: result.message });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/v1/auth/reset-password
   */
  async resetPassword(req, res, next) {
    try {
      const { token, newPassword } = req.body;
      const result = await authService.resetPassword({ token, newPassword });
      return sendSuccess(res, null, { message: result.message });
    } catch (err) {
      next(err);
    }
  }
};

export default authController;
