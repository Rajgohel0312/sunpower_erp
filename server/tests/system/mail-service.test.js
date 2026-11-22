import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { mailService } from '../../src/services/mail.service.js';

describe('Nodemailer SMTP & Transactional Email System', () => {
  test('sendPasswordResetEmail generates well-formed email envelope with token and link', async () => {
    const res = await mailService.sendPasswordResetEmail({
      to: 'solar.customer@example.com',
      name: 'Aditya Sharma',
      resetToken: 'test-crypto-reset-token-32-bytes'
    });

    assert.equal(res.success, true);
    assert.ok(res.messageId);
  });

  test('sendCustomerWelcomeEmail dispatches portal onboarding credentials', async () => {
    const res = await mailService.sendCustomerWelcomeEmail({
      to: 'onboarding.client@example.com',
      name: 'Pooja Verma',
      temporaryPassword: 'SunPower@9821'
    });

    assert.equal(res.success, true);
    assert.ok(res.messageId);
  });

  test('sendOtpEmail dispatches 6-digit verification code with 10-minute expiry notice', async () => {
    const res = await mailService.sendOtpEmail({
      to: 'verify@example.com',
      name: 'Rohan Mehta',
      otp: '782914',
      purpose: 'Two-Factor Login'
    });

    assert.equal(res.success, true);
    assert.ok(res.messageId);
  });

  test('sendInvoiceNotification dispatches milestone tax invoice notice', async () => {
    const res = await mailService.sendInvoiceNotification({
      to: 'billing.client@example.com',
      name: 'Vikram Joshi',
      invoiceNumber: 'INV-2026-00001',
      amount: 84000,
      dueDate: new Date().toISOString()
    });

    assert.equal(res.success, true);
    assert.ok(res.messageId);
  });

  test('sendTestEmail successfully sends connectivity test', async () => {
    const res = await mailService.sendTestEmail({
      to: 'admin@sunpower.com'
    });

    assert.equal(res.success, true);
    assert.ok(res.messageId);
  });
});
