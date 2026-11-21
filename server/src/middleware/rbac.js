/**
 * Role-Based Access Control (RBAC) Middleware for SunPower ERP
 * Enforces Deny-by-Default security.
 */

import { AppError } from '../utils/response.js';

/**
 * Requires the authenticated actor to possess a specific permission.
 * SUPER_ADMIN role bypasses individual permission checks.
 *
 * @param {string} permissionCode
 * @returns {import('express').RequestHandler}
 */
export function requirePermission(permissionCode) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required.', 401, 'UNAUTHENTICATED'));
    }

    // Super Admin bypass
    if (req.user.roles && req.user.roles.includes('SUPER_ADMIN')) {
      return next();
    }

    if (!req.user.permissions || !req.user.permissions.includes(permissionCode)) {
      return next(
        new AppError(
          `Access denied. Missing required permission: "${permissionCode}"`,
          403,
          'INSUFFICIENT_PERMISSIONS',
          { requiredPermission: permissionCode }
        )
      );
    }

    next();
  };
}

/**
 * Requires the authenticated actor to possess at least one of the specified roles.
 *
 * @param {...string} roleCodes
 * @returns {import('express').RequestHandler}
 */
export function requireRole(...roleCodes) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required.', 401, 'UNAUTHENTICATED'));
    }

    if (req.user.roles && req.user.roles.includes('SUPER_ADMIN')) {
      return next();
    }

    const hasRole = roleCodes.some(r => req.user.roles && req.user.roles.includes(r));
    if (!hasRole) {
      return next(
        new AppError(
          `Access denied. Requires one of roles: [${roleCodes.join(', ')}]`,
          403,
          'FORBIDDEN_ROLE',
          { requiredRoles: roleCodes }
        )
      );
    }

    next();
  };
}
