/**
 * Global Express Error Handling Middleware for SunPower ERP
 * Sanitizes errors and returns standard error envelope. Never leaks stack traces or secrets to users.
 */

import { AppError, sendError } from '../utils/response.js';
import { DatabaseError } from '../database/index.js';

export function errorHandler(err, req, res, next) {
  // If response has already started streaming, delegate to default Express handler
  if (res.headersSent) {
    return next(err);
  }

  // AppError (Expected domain/business error)
  if (err instanceof AppError) {
    return sendError(
      res,
      {
        code: err.code,
        message: err.message,
        details: err.details
      },
      err.statusCode
    );
  }

  // Database error mapped safely
  if (err instanceof DatabaseError) {
    return sendError(
      res,
      {
        code: err.code,
        message: err.message,
        details: err.details
      },
      400
    );
  }

  // Malformed JSON payload
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return sendError(
      res,
      {
        code: 'INVALID_JSON_PAYLOAD',
        message: 'Malformed JSON payload in request body'
      },
      400
    );
  }

  // Unhandled / Unexpected system error
  // Log locally with correlation ID for debugging
  console.error(`[Unhandled Server Error] [Request: ${req.id || 'N/A'}]:`, err.message, err.stack);

  return sendError(
    res,
    {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected internal server error occurred.'
    },
    500
  );
}

export default errorHandler;
