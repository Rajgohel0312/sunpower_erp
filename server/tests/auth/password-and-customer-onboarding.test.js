import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../../src/database/prisma.js';
import { authService } from '../../src/modules/auth/auth.service.js';
import { ensureCustomerPortalUser } from '../../src/modules/orders/order.service.js';

describe('Customer Portal Auto-Onboarding, Forgot Password & Change Password Security', () => {
  let testCustomer;
  let testUser;

  before(async () => {
    // 1. Create or find customer with email
    const email = `solar.customer.${Date.now()}@example.com`;
    testCustomer = await prisma.customers.create({
      data: {
        customer_code: `CUST-${Date.now().toString().slice(-5)}`,
        full_name: 'Aditya Sharma',
        phone_e164: `+9198${Date.now().toString().slice(-8)}`,
        email: email,
        customer_type: 'RESIDENTIAL'
      }
    });
    assert.ok(testCustomer.id);
  });

  test('1. Customer Conversion: Auto-provisions Customer Portal account with CUSTOMER role and credentials', async () => {
    const onboarding = await ensureCustomerPortalUser(testCustomer.id);

    assert.ok(onboarding);
    assert.ok(onboarding.userId);
    assert.equal(onboarding.isExisting, false);
    assert.match(onboarding.tempPassword, /^SunPower@\d{4}$/);

    // Verify user was created in database
    const createdUser = await prisma.users.findUnique({
      where: { id: onboarding.userId },
      include: {
        user_roles: {
          include: { roles: true }
        }
      }
    });

    assert.ok(createdUser);
    assert.equal(createdUser.email, testCustomer.email.toLowerCase());
    assert.equal(createdUser.is_active, true);
    assert.ok(createdUser.user_roles.some((ur) => ur.roles.code === 'CUSTOMER'), 'User must have CUSTOMER role');

    // Calling again must be idempotent and recognize existing user
    const secondCall = await ensureCustomerPortalUser(testCustomer.id);
    assert.equal(secondCall.isExisting, true);
    assert.equal(secondCall.userId, onboarding.userId);

    testUser = createdUser;
  });

  test('2. Forgot Password: Generates single-use crypto-random token with 1-hour expiry', async () => {
    const forgotRes = await authService.forgotPassword({ email: testUser.email });

    assert.ok(forgotRes.message);
    assert.ok(forgotRes.devResetToken, 'Dev reset token must be returned in dev/test mode');

    // Verify database has hashed token and future expiry
    const dbUser = await prisma.users.findUnique({
      where: { id: testUser.id }
    });

    assert.ok(dbUser.password_reset_token_hash);
    assert.ok(dbUser.password_reset_expires_at);
    assert.ok(new Date(dbUser.password_reset_expires_at) > new Date());
  });

  test('3. Reset Password: Validates token, updates password hash, and clears reset token', async () => {
    // Generate fresh reset token
    const forgotRes = await authService.forgotPassword({ email: testUser.email });
    const resetToken = forgotRes.devResetToken;

    const newPassword = 'NewSecretCustomerPass@2026';
    const resetRes = await authService.resetPassword({
      token: resetToken,
      newPassword
    });

    assert.match(resetRes.message, /successfully/i);

    // Verify database has cleared reset token
    const updatedUser = await prisma.users.findUnique({
      where: { id: testUser.id }
    });

    assert.equal(updatedUser.password_reset_token_hash, null);
    assert.equal(updatedUser.password_reset_expires_at, null);

    // Test logging in with new password
    const loginRes = await authService.login({
      email: testUser.email,
      password: newPassword
    });

    assert.ok(loginRes.accessToken);
    assert.ok(loginRes.user.roles.includes('CUSTOMER'));
  });

  test('4. Change Password: Validates current password, rejects same password, updates hash', async () => {
    const currentPass = 'NewSecretCustomerPass@2026';
    const newerPass = 'EvenMoreSecurePassword@2027';

    // 1. Wrong current password throws error
    await assert.rejects(
      async () => {
        await authService.changePassword({
          userId: testUser.id,
          currentPassword: 'WrongPassword@123',
          newPassword: newerPass
        });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, 'INVALID_CURRENT_PASSWORD');
        return true;
      }
    );

    // 2. Same password throws error
    await assert.rejects(
      async () => {
        await authService.changePassword({
          userId: testUser.id,
          currentPassword: currentPass,
          newPassword: currentPass
        });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, 'PASSWORD_UNCHANGED');
        return true;
      }
    );

    // 3. Valid change password succeeds
    const changeRes = await authService.changePassword({
      userId: testUser.id,
      currentPassword: currentPass,
      newPassword: newerPass
    });

    assert.match(changeRes.message, /successfully/i);

    // 4. Verify login succeeds with the newer password
    const loginRes = await authService.login({
      email: testUser.email,
      password: newerPass
    });

    assert.ok(loginRes.accessToken);
    assert.equal(loginRes.user.id, testUser.id);
  });
});
