/**
 * Authentication Middleware for SunPower ERP
 * Verifies JWT access token from Authorization header or HttpOnly cookie.
 */

import { verifyAccessToken } from '../utils/jwt.js';
import { AppError } from '../utils/response.js';
import { tokenStore } from '../utils/token-store.js';

export function authenticate(req, res, next) {
  let token = null;

  // 1. Check Authorization Bearer header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  // 2. Fallback to HttpOnly cookie if header is absent
  if (!token && req.cookies && req.cookies.access_token) {
    token = req.cookies.access_token;
  }

  if (!token) {
    return next(new AppError('Authentication required. Missing token.', 401, 'UNAUTHENTICATED'));
  }

  // 3. Check token revocation denylist (e.g. after logout)
  if (tokenStore.isRevoked(token)) {
    return next(new AppError('This session has been logged out. Please log in again.', 401, 'TOKEN_REVOKED'));
  }

  try {
    const decoded = verifyAccessToken(token);
    req.token = token;
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      fullName: decoded.fullName,
      roles: Array.isArray(decoded.roles) ? decoded.roles : [],
      permissions: Array.isArray(decoded.permissions) ? decoded.permissions : []
    };
    next();
  } catch (err) {
    return next(new AppError('Invalid or expired authentication token.', 401, 'INVALID_TOKEN'));
  }
}

export default authenticate;
