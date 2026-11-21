/**
 * Standard API Response & Error Envelope for SunPower ERP
 * Conforms to API Design Guidelines:
 * Success: { data, meta }
 * Failure: { error: { code, message, details, requestId } }
 */

export class AppError extends Error {
  constructor(message, statusCode = 400, code = 'BAD_REQUEST', details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/**
 * Sends standard success envelope
 * @param {object} res
 * @param {any} data
 * @param {object} [meta]
 * @param {number} [statusCode]
 */
export function sendSuccess(res, data, meta = {}, statusCode = 200) {
  return res.status(statusCode).json({
    data,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: res.req?.id || null,
      ...meta
    }
  });
}

/**
 * Sends standard error envelope
 * @param {object} res
 * @param {object} error
 * @param {number} [statusCode]
 */
export function sendError(res, { code, message, details }, statusCode = 400) {
  return res.status(statusCode).json({
    error: {
      code: code || 'ERROR',
      message: message || 'An unexpected error occurred',
      details: details || null,
      requestId: res.req?.id || null
    }
  });
}
