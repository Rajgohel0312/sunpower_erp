/**
 * In-Memory Access Token Revocation Denylist for SunPower ERP
 * Tracks revoked access tokens until their natural expiration (max 15m),
 * preventing token reuse after logout without incurring database latency.
 */

class TokenRevocationStore {
  constructor() {
    this.revoked = new Map(); // token -> expiryTimestamp

    // Sweep expired tokens every 5 minutes to prevent memory leak
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);

    // Don't keep Node.js process alive just for the cleanup timer
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Revoke an access token
   * @param {string} token
   * @param {number} [ttlMs] Time-to-live in ms (default: 15 minutes)
   */
  revoke(token, ttlMs = 15 * 60 * 1000) {
    if (!token || typeof token !== 'string') return;
    const expiresAt = Date.now() + ttlMs;
    this.revoked.set(token, expiresAt);
  }

  /**
   * Check if an access token has been revoked
   * @param {string} token
   * @returns {boolean}
   */
  isRevoked(token) {
    if (!token) return false;
    const expiresAt = this.revoked.get(token);
    if (!expiresAt) return false;

    if (Date.now() > expiresAt) {
      this.revoked.delete(token);
      return false;
    }

    return true;
  }

  /**
   * Remove expired tokens from the map
   */
  cleanup() {
    const now = Date.now();
    for (const [token, expiresAt] of this.revoked.entries()) {
      if (now > expiresAt) {
        this.revoked.delete(token);
      }
    }
  }

  /**
   * Clear all revoked tokens (used in test teardown)
   */
  clear() {
    this.revoked.clear();
  }
}

export const tokenStore = new TokenRevocationStore();
export default tokenStore;
