/**
 * Authentication Middleware for SunPower ERP
 * Verifies JWT access token from Authorization header or HttpOnly cookie.
 */

import { verifyAccessToken } from '../utils/jwt.js';
import { AppError } from '../utils/response.js';

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

  try {
    const decoded = verifyAccessToken(token);
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
