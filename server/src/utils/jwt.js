/**
 * JWT Token Signing & Verification Utilities for SunPower ERP
 */

import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

/**
 * Signs a short-lived access token (default: 15m)
 * @param {object} payload
 * @returns {string}
 */
export function signAccessToken(payload) {
  return jwt.sign(payload, config.JWT_ACCESS_SECRET, {
    expiresIn: config.ACCESS_TOKEN_TTL,
    algorithm: 'HS256'
  });
}

/**
 * Verifies an access token
 * @param {string} token
 * @returns {object}
 */
export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, config.JWT_ACCESS_SECRET, {
      algorithms: ['HS256']
    });
  } catch (err) {
    throw new Error('INVALID_ACCESS_TOKEN');
  }
}

/**
 * Signs a long-lived refresh token (default: 7d)
 * @param {object} payload
 * @returns {string}
 */
export function signRefreshToken(payload) {
  return jwt.sign(payload, config.JWT_REFRESH_SECRET, {
    expiresIn: config.REFRESH_TOKEN_TTL,
    algorithm: 'HS256'
  });
}

/**
 * Verifies a refresh token
 * @param {string} token
 * @returns {object}
 */
export function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, config.JWT_REFRESH_SECRET, {
      algorithms: ['HS256']
    });
  } catch (err) {
    throw new Error('INVALID_REFRESH_TOKEN');
  }
}
