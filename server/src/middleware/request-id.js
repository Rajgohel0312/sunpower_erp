/**
 * Request ID Middleware
 * Assigns or propagates a unique correlation ID for every request.
 */

import crypto from 'crypto';

export function requestIdMiddleware(req, res, next) {
  const reqId = req.headers['x-request-id'] || crypto.randomUUID();
  req.id = reqId;
  res.setHeader('X-Request-Id', reqId);
  next();
}

export default requestIdMiddleware;
