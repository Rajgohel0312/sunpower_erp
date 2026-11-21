/**
 * Authentication Database Repository for SunPower ERP
 * All queries execute through the custom query builder.
 */

import { db } from '../../database/index.js';

export const authRepository = {
  /**
   * Find user by email (including password_hash and active status)
   * @param {string} email
   * @param {object} [client]
   * @returns {Promise<object|null>}
   */
  async findUserByEmail(email, client = null) {
    return db
      .select(
        'id',
        'email',
        'phone_e164',
        'full_name',
        'password_hash',
        'is_active',
        'failed_login_attempts',
        'locked_until'
      )
      .from('users')
      .where('email', '=', email)
      .andWhere('deleted_at', 'IS', null)
      .executeTakeFirst(client);
  },

  /**
   * Find user by ID
   * @param {string} id
   * @param {object} [client]
   * @returns {Promise<object|null>}
   */
  async findUserById(id, client = null) {
    return db
      .select('id', 'email', 'phone_e164', 'full_name', 'is_active')
      .from('users')
      .where('id', '=', id)
      .andWhere('deleted_at', 'IS', null)
      .executeTakeFirst(client);
  },

  /**
   * Fetch active roles and permissions for a user
   * @param {string} userId
   * @param {object} [client]
   * @returns {Promise<{ roles: string[], permissions: string[] }>}
   */
  async getUserRolesAndPermissions(userId, client = null) {
    // 1. Fetch role codes
    const roleRows = await db
      .select('r.code')
      .from('user_roles AS ur')
      .join('roles AS r', 'r.id', '=', 'ur.role_id')
      .where('ur.user_id', '=', userId)
      .execute(client);

    const roles = roleRows.map(r => r.code);

    // 2. Fetch distinct permission codes
    const permRows = await db
      .select('p.code')
      .distinct()
      .from('user_roles AS ur')
      .join('role_permissions AS rp', 'rp.role_id', '=', 'ur.role_id')
      .join('permissions AS p', 'p.id', '=', 'rp.permission_id')
      .where('ur.user_id', '=', userId)
      .execute(client);

    const permissions = permRows.map(p => p.code);

    return { roles, permissions };
  },

  /**
   * Records a login event for auditing and security monitoring
   * @param {object} event
   */
  async recordLoginEvent(event) {
    return db.insertInto('login_events', {
      email: event.email,
      user_id: event.userId || null,
      success: event.success,
      failure_reason: event.failureReason || null,
      ip_address: event.ipAddress || null,
      user_agent: event.userAgent || null
    }).execute();
  },

  /**
   * Increments failed login count and locks account if threshold exceeded (5 attempts -> 15 min lock)
   */
  async recordFailedLogin(userId, currentAttempts) {
    const nextAttempts = currentAttempts + 1;
    const updateData = { failed_login_attempts: nextAttempts };
    if (nextAttempts >= 5) {
      updateData.locked_until = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
    }
    return db.update('users', updateData).where('id', '=', userId).execute();
  },

  /**
   * Resets failed login count upon successful authentication
   */
  async resetFailedLogins(userId) {
    return db.update('users', {
      failed_login_attempts: 0,
      locked_until: null
    }).where('id', '=', userId).execute();
  },

  /**
   * Inserts a new hashed refresh token
   */
  async insertRefreshToken(data, client = null) {
    return db.insertInto('refresh_tokens', {
      user_id: data.userId,
      token_hash: data.tokenHash,
      family_id: data.familyId,
      expires_at: data.expiresAt,
      ip_address: data.ipAddress || null,
      user_agent: data.userAgent || null
    }).execute(client);
  },

  /**
   * Finds refresh token by hash
   */
  async findRefreshToken(tokenHash, client = null) {
    return db
      .select('*')
      .from('refresh_tokens')
      .where('token_hash', '=', tokenHash)
      .executeTakeFirst(client);
  },

  /**
   * Revokes a specific refresh token by ID
   */
  async revokeRefreshToken(id, client = null) {
    return db.update('refresh_tokens', { is_revoked: true })
      .where('id', '=', id)
      .execute(client);
  },

  /**
   * Revokes an entire token family (used upon reuse detection)
   */
  async revokeTokenFamily(familyId, client = null) {
    return db.update('refresh_tokens', { is_revoked: true })
      .where('family_id', '=', familyId)
      .execute(client);
  },

  /**
   * Stores password reset token hash and expiration
   */
  async setPasswordResetToken(userId, tokenHash, expiresAt) {
    return db.update('users', {
      password_reset_token_hash: tokenHash,
      password_reset_expires_at: expiresAt
    }).where('id', '=', userId).execute();
  },

  /**
   * Finds user by valid reset token hash
   */
  async findUserByResetToken(tokenHash) {
    return db
      .select('id', 'email')
      .from('users')
      .where('password_reset_token_hash', '=', tokenHash)
      .andWhere('password_reset_expires_at', '>', new Date())
      .andWhere('deleted_at', 'IS', null)
      .executeTakeFirst();
  },

  /**
   * Updates password and clears reset token
   */
  async updatePassword(userId, passwordHash) {
    return db.update('users', {
      password_hash: passwordHash,
      password_reset_token_hash: null,
      password_reset_expires_at: null,
      failed_login_attempts: 0,
      locked_until: null
    }).where('id', '=', userId).execute();
  }
};

export default authRepository;
