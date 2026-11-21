/**
 * Zod Schema Validation Middleware for SunPower ERP
 * Validates request body, query, and params. Strips unknown fields.
 */

import { AppError } from '../utils/response.js';

export function validate(schemas = {}) {
  return (req, res, next) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        const parsedQuery = schemas.query.parse(req.query);
        try {
          req.query = parsedQuery;
        } catch {
          Object.defineProperty(req, 'query', {
            value: parsedQuery,
            writable: true,
            configurable: true,
            enumerable: true
          });
        }
      }
      if (schemas.params) {
        const parsedParams = schemas.params.parse(req.params);
        try {
          req.params = parsedParams;
        } catch {
          Object.defineProperty(req, 'params', {
            value: parsedParams,
            writable: true,
            configurable: true,
            enumerable: true
          });
        }
      }
      next();
    } catch (err) {
      if (err.name === 'ZodError') {
        const issues = err.issues.map(i => ({
          path: i.path.join('.'),
          message: i.message,
          code: i.code
        }));
        return next(new AppError('Input validation failed', 400, 'VALIDATION_ERROR', issues));
      }
      next(err);
    }
  };
}

export default validate;
