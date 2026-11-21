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
        req.query = schemas.query.parse(req.query);
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
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
