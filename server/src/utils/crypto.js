/**
 * Cryptographic & Hashing Utilities for SunPower ERP
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { config } from '../config/index.js';

/**
 * Hashes a plaintext password using bcrypt
 * @param {string} password
 * @returns {Promise<string>}
 */
export async function hashPassword(password) {
  return bcrypt.hash(password, config.BCRYPT_ROUNDS);
}

/**
 * Compares plaintext password against a bcrypt hash in constant-time
 * @param {string} password
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Generates SHA-256 hash of a token string (used for storing refresh tokens and reset tokens)
 * @param {string} token
 * @returns {string}
 */
export function hashToken(token) {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * Generates cryptographically secure random token string
 * @param {number} bytes
 * @returns {string}
 */
export function generateSecureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}
