/**
 * Authentication Database Repository for SunPower ERP
 * Powered by Prisma ORM (@prisma/client)
 */

import { prisma } from '../../database/index.js';

export const authRepository = {
  /**
   * Find user by email (including password_hash and active status)
   */
  async findUserByEmail(email, tx = null) {
    const client = tx || prisma;
    return client.users.findFirst({
      where: {
        email,
        deleted_at: null
      }
    });
  },

  /**
   * Find user by ID
   */
  async findUserById(id, tx = null) {
    const client = tx || prisma;
    return client.users.findFirst({
      where: {
        id,
        deleted_at: null
      },
      select: {
        id: true,
        email: true,
        phone_e164: true,
        full_name: true,
        is_active: true
      }
    });
  },

  /**
   * Fetch active roles and permissions for a user
   */
  async getUserRolesAndPermissions(userId, tx = null) {
    const client = tx || prisma;
    const userRoles = await client.user_roles.findMany({
      where: { user_id: userId },
      include: {
        roles: {
          include: {
            role_permissions: {
              include: {
                permissions: true
              }
            }
          }
        }
      }
    });

    const roles = userRoles.map(ur => ur.roles.code);
    const permissions = [...new Set(
      userRoles.flatMap(ur => ur.roles.role_permissions.map(rp => rp.permissions.code))
    )];

    return { roles, permissions };
  },

  /**
   * Records a login event for auditing and security monitoring
   */
  async recordLoginEvent(event, tx = null) {
    const client = tx || prisma;
    return client.login_events.create({
      data: {
        email: event.email,
        user_id: event.userId || null,
        success: event.success,
        failure_reason: event.failureReason || null,
        ip_address: event.ipAddress || null,
        user_agent: event.userAgent || null
      }
    });
  },

  /**
   * Increments failed login count and locks account if threshold exceeded (5 attempts -> 15 min lock)
   */
  async recordFailedLogin(userId, currentAttempts, tx = null) {
    const client = tx || prisma;
    const nextAttempts = currentAttempts + 1;
    const updateData = { failed_login_attempts: nextAttempts };

    if (nextAttempts >= 5) {
      updateData.locked_until = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
    }

    return client.users.update({
      where: { id: userId },
      data: updateData
    });
  },

  /**
   * Resets failed login count upon successful authentication
   */
  async resetFailedLogins(userId, tx = null) {
    const client = tx || prisma;
    return client.users.update({
      where: { id: userId },
      data: {
        failed_login_attempts: 0,
        locked_until: null
      }
    });
  },

  /**
   * Inserts a new hashed refresh token
   */
  async insertRefreshToken(data, tx = null) {
    const client = tx || prisma;
    return client.refresh_tokens.create({
      data: {
        user_id: data.userId,
        token_hash: data.tokenHash,
        family_id: data.familyId,
        expires_at: data.expiresAt,
        ip_address: data.ipAddress || null,
        user_agent: data.userAgent || null
      }
    });
  },

  /**
   * Finds refresh token by hash
   */
  async findRefreshToken(tokenHash, tx = null) {
    const client = tx || prisma;
    return client.refresh_tokens.findFirst({
      where: { token_hash: tokenHash }
    });
  },

  /**
   * Revokes a specific refresh token by ID
   */
  async revokeRefreshToken(id, tx = null) {
    const client = tx || prisma;
    return client.refresh_tokens.update({
      where: { id },
      data: { is_revoked: true }
    });
  },

  /**
   * Revokes an entire token family (used upon reuse detection)
   */
  async revokeTokenFamily(familyId, tx = null) {
    const client = tx || prisma;
    return client.refresh_tokens.updateMany({
      where: { family_id: familyId },
      data: { is_revoked: true }
    });
  },

  /**
   * Stores password reset token hash and expiration
   */
  async setPasswordResetToken(userId, tokenHash, expiresAt, tx = null) {
    const client = tx || prisma;
    return client.users.update({
      where: { id: userId },
      data: {
        password_reset_token_hash: tokenHash,
        password_reset_expires_at: expiresAt
      }
    });
  },

  /**
   * Finds user by valid reset token hash
   */
  async findUserByResetToken(tokenHash, tx = null) {
    const client = tx || prisma;
    return client.users.findFirst({
      where: {
        password_reset_token_hash: tokenHash,
        password_reset_expires_at: { gt: new Date() },
        deleted_at: null
      },
      select: {
        id: true,
        email: true
      }
    });
  },

  /**
   * Updates password and clears reset token
   */
  async updatePassword(userId, passwordHash, tx = null) {
    const client = tx || prisma;
    return client.users.update({
      where: { id: userId },
      data: {
        password_hash: passwordHash,
        password_reset_token_hash: null,
        password_reset_expires_at: null,
        failed_login_attempts: 0,
        locked_until: null
      }
    });
  }
};

export default authRepository;
