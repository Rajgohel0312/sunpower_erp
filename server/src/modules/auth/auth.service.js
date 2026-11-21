/**
 * Authentication Business Logic Service for SunPower ERP
 * Enforces security rules, rotating refresh tokens, and rate limits.
 */

import crypto from 'crypto';
import { authRepository } from './auth.repository.js';
import { comparePassword, hashPassword, hashToken, generateSecureToken } from '../../utils/crypto.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt.js';
import { tokenStore } from '../../utils/token-store.js';
import { AppError } from '../../utils/response.js';
import { withTransaction } from '../../database/index.js';

export const authService = {
  /**
   * Authenticates user credentials, handles account locking, and issues tokens.
   */
  async login({ email, password, ipAddress, userAgent }) {
    const user = await authRepository.findUserByEmail(email);

    // Account does not exist
    if (!user) {
      await authRepository.recordLoginEvent({
        email,
        success: false,
        failureReason: 'USER_NOT_FOUND',
        ipAddress,
        userAgent
      });
      throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }

    // Account deactivated
    if (!user.is_active) {
      await authRepository.recordLoginEvent({
        email,
        userId: user.id,
        success: false,
        failureReason: 'ACCOUNT_DEACTIVATED',
        ipAddress,
        userAgent
      });
      throw new AppError('This user account has been deactivated. Contact an administrator.', 403, 'ACCOUNT_DEACTIVATED');
    }

    // Account temporarily locked due to brute-force attempts
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const remainingMins = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
      throw new AppError(
        `Account is temporarily locked due to multiple failed login attempts. Try again in ${remainingMins} minute(s).`,
        429,
        'ACCOUNT_LOCKED',
        { lockedUntil: user.locked_until }
      );
    }

    // Verify password hash
    const isValid = await comparePassword(password, user.password_hash);
    if (!isValid) {
      await authRepository.recordFailedLogin(user.id, user.failed_login_attempts);
      await authRepository.recordLoginEvent({
        email,
        userId: user.id,
        success: false,
        failureReason: 'INVALID_PASSWORD',
        ipAddress,
        userAgent
      });
      throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }

    // Reset failed login counter on success
    await authRepository.resetFailedLogins(user.id);

    // Load active roles & permissions
    const { roles, permissions } = await authRepository.getUserRolesAndPermissions(user.id);

    // Generate tokens
    const tokenPayload = {
      sub: user.id,
      email: user.email,
      fullName: user.full_name,
      roles,
      permissions
    };

    const accessToken = signAccessToken(tokenPayload);
    const familyId = crypto.randomUUID();
    const rawRefreshToken = signRefreshToken({ sub: user.id, familyId });
    const hashedRefresh = hashToken(rawRefreshToken);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await authRepository.insertRefreshToken({
      userId: user.id,
      tokenHash: hashedRefresh,
      familyId,
      expiresAt,
      ipAddress,
      userAgent
    });

    await authRepository.recordLoginEvent({
      email,
      userId: user.id,
      success: true,
      ipAddress,
      userAgent
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        phone: user.phone_e164,
        roles,
        permissions
      }
    };
  },

  /**
   * Refreshes access token with full refresh token rotation and reuse detection.
   */
  async refreshTokens({ rawRefreshToken, ipAddress, userAgent }) {
    if (!rawRefreshToken) {
      throw new AppError('Missing refresh token.', 401, 'UNAUTHENTICATED');
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(rawRefreshToken);
    } catch {
      throw new AppError('Invalid or expired refresh token.', 401, 'INVALID_REFRESH_TOKEN');
    }

    const hashedToken = hashToken(rawRefreshToken);
    const existingToken = await authRepository.findRefreshToken(hashedToken);

    if (!existingToken) {
      throw new AppError('Refresh token not recognized.', 401, 'INVALID_REFRESH_TOKEN');
    }

    // Token reuse detection! If already revoked, revoke the entire family!
    if (existingToken.is_revoked) {
      await authRepository.revokeTokenFamily(existingToken.family_id);
      console.warn(`[Security Alert]: Refresh token reuse detected for user ${existingToken.user_id}! Revoking token family.`);
      throw new AppError('Token reuse detected. All sessions in this chain have been terminated for security.', 401, 'TOKEN_REUSE_DETECTED');
    }

    if (new Date(existingToken.expires_at) < new Date()) {
      throw new AppError('Refresh token has expired.', 401, 'REFRESH_TOKEN_EXPIRED');
    }

    return withTransaction(async (trx) => {
      // Revoke current refresh token
      await authRepository.revokeRefreshToken(existingToken.id, trx);

      // Load user details & permissions
      const user = await authRepository.findUserById(existingToken.user_id, trx);
      if (!user || !user.is_active) {
        throw new AppError('User account not found or deactivated.', 401, 'ACCOUNT_INACTIVE');
      }

      const { roles, permissions } = await authRepository.getUserRolesAndPermissions(user.id, trx);

      const tokenPayload = {
        sub: user.id,
        email: user.email,
        fullName: user.full_name,
        roles,
        permissions
      };

      // Issue rotated pair
      const newAccessToken = signAccessToken(tokenPayload);
      const newRawRefreshToken = signRefreshToken({ sub: user.id, familyId: existingToken.family_id });
      const newHashed = hashToken(newRawRefreshToken);

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await authRepository.insertRefreshToken({
        userId: user.id,
        tokenHash: newHashed,
        familyId: existingToken.family_id,
        expiresAt,
        ipAddress,
        userAgent
      }, trx);

      return {
        accessToken: newAccessToken,
        refreshToken: newRawRefreshToken
      };
    });
  },

  /**
   * Logs out the user by revoking the refresh token and adding access token to denylist
   */
  async logout({ rawRefreshToken, rawAccessToken }) {
    if (rawAccessToken) {
      tokenStore.revoke(rawAccessToken);
    }
    if (rawRefreshToken) {
      try {
        const hashed = hashToken(rawRefreshToken);
        const token = await authRepository.findRefreshToken(hashed);
        if (token) {
          await authRepository.revokeRefreshToken(token.id);
        }
      } catch (err) {
        // Silent on logout errors
      }
    }
  },

  /**
   * Request password reset token. Always returns generic message to prevent account enumeration.
   */
  async forgotPassword({ email }) {
    const user = await authRepository.findUserByEmail(email);
    if (!user || !user.is_active) {
      return { message: 'If this email is registered, password reset instructions have been sent.' };
    }

    const resetToken = generateSecureToken(32);
    const tokenHash = hashToken(resetToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await authRepository.setPasswordResetToken(user.id, tokenHash, expiresAt);

    // In production: send email with reset link containing resetToken.
    // For development, keep the reset token in audit logs.
    console.log(`[Auth]: Password reset token generated for ${user.email}: ${resetToken}`);

    return { message: 'If this email is registered, password reset instructions have been sent.' };
  },

  /**
   * Resets password using the received token
   */
  async resetPassword({ token, newPassword }) {
    const tokenHash = hashToken(token);
    const user = await authRepository.findUserByResetToken(tokenHash);

    if (!user) {
      throw new AppError('Invalid or expired password reset token.', 400, 'INVALID_RESET_TOKEN');
    }

    const newHash = await hashPassword(newPassword);
    await authRepository.updatePassword(user.id, newHash);

    // Revoke all existing refresh tokens for the user
    await authRepository.revokeTokenFamily(user.id);

    return { message: 'Password has been reset successfully. You may now log in.' };
  }
};

export default authService;
