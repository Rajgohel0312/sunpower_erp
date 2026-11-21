/**
 * Authentication HTTP Controller for SunPower ERP
 */

import { authService } from './auth.service.js';
import { sendSuccess } from '../../utils/response.js';
import { config } from '../../config/index.js';

// Cookie options for secure token delivery
const ACCESS_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 15 * 60 * 1000 // 15 mins
};

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
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

      // Set tokens in HttpOnly cookies
      res.cookie('access_token', result.accessToken, ACCESS_COOKIE_OPTIONS);
      res.cookie('refresh_token', result.refreshToken, REFRESH_COOKIE_OPTIONS);

      return sendSuccess(res, {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        tokens: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken
        },
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

      res.cookie('access_token', result.accessToken, ACCESS_COOKIE_OPTIONS);
      res.cookie('refresh_token', result.refreshToken, REFRESH_COOKIE_OPTIONS);

      return sendSuccess(res, {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        tokens: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken
        }
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
      const rawAccessToken = req.token || req.cookies.access_token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.substring(7) : null);

      await authService.logout({ rawRefreshToken, rawAccessToken });

      res.clearCookie('access_token', { ...ACCESS_COOKIE_OPTIONS, maxAge: 0 });
      res.clearCookie('refresh_token', { ...REFRESH_COOKIE_OPTIONS, maxAge: 0 });

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
