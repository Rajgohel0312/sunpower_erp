/**
 * Centralized Mail Service via Nodemailer for SunPower ERP
 * Handles transactional emails, OTPs, password resets, onboarding credentials, and milestone notifications.
 */

import nodemailer from 'nodemailer';
import { config } from '../config/index.js';

let cachedTransporter = null;

/**
 * Initializes and returns the Nodemailer transporter.
 */
function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const isRunningTests = process.env.NODE_ENV === 'test' || process.argv.some(a => a.includes('test'));

  const isRealSmtpConfigured = !isRunningTests && Boolean(
    config.SMTP_HOST &&
    config.SMTP_USER &&
    config.SMTP_PASS &&
    config.SMTP_PASS.trim() !== ''
  );

  if (isRealSmtpConfigured) {
    const isGmail = config.SMTP_HOST.toLowerCase().includes('gmail');
    const cleanPass = config.SMTP_PASS.replace(/\s+/g, '');

    cachedTransporter = nodemailer.createTransport(isGmail ? {
      service: 'gmail',
      auth: {
        user: config.SMTP_USER,
        pass: cleanPass
      }
    } : {
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE || config.SMTP_PORT === 465,
      auth: {
        user: config.SMTP_USER,
        pass: cleanPass
      },
      tls: {
        rejectUnauthorized: false // Dev-tolerant
      }
    });
  } else {
    // Development & test fallback mock transporter (logs to console without crashing)
    cachedTransporter = {
      isMock: true,
      async sendMail(options) {
        console.log('\n======================================================');
        console.log('📧 [SMTP (Dev Fallback)] Transactional Email Dispatched');
        console.log(`To:      ${options.to}`);
        console.log(`Subject: ${options.subject}`);
        console.log(`From:    ${options.from || config.SMTP_FROM}`);
        if (options.text) {
          console.log('--- Plaintext Preview ---');
          console.log(options.text.trim());
        }
        console.log('======================================================\n');
        return { messageId: `mock-${Date.now()}`, simulated: true };
      },
      async verify() {
        return true;
      }
    };
  }

  return cachedTransporter;
}

/**
 * Base email layout wrapper with SunPower Solar brand design
 */
function wrapHtmlTemplate({ title, preheader, contentHtml }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; }
    .container { max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); }
    .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 28px 32px; text-align: left; }
    .logo-badge { display: inline-flex; align-items: center; gap: 8px; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px; }
    .logo-sun { color: #f59e0b; font-size: 24px; }
    .content { padding: 36px 32px; font-size: 15px; line-height: 1.6; color: #334155; }
    .title { font-size: 22px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 16px; }
    .button-container { margin: 28px 0; text-align: center; }
    .button { display: inline-block; background-color: #f59e0b; color: #0f172a; font-weight: 600; text-decoration: none; padding: 13px 28px; border-radius: 8px; font-size: 15px; box-shadow: 0 2px 4px rgba(245, 158, 11, 0.3); }
    .code-box { background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center; }
    .code-value { font-family: monospace; font-size: 26px; font-weight: 700; letter-spacing: 4px; color: #0f172a; }
    .credentials-box { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 20px 0; }
    .credentials-row { margin-bottom: 8px; font-size: 14px; }
    .credentials-row:last-child { margin-bottom: 0; }
    .credentials-label { font-weight: 600; color: #475569; width: 140px; display: inline-block; }
    .credentials-val { font-family: monospace; font-weight: 600; color: #0f172a; background: #e2e8f0; padding: 2px 6px; border-radius: 4px; }
    .footer { background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; font-size: 12px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div style="display: none; max-height: 0px; overflow: hidden;">${preheader || title}</div>
  <div class="container">
    <div class="header">
      <div class="logo-badge">
        <span class="logo-sun">☀</span> SunPower Solar ERP
      </div>
    </div>
    <div class="content">
      ${contentHtml}
    </div>
    <div class="footer">
      <p style="margin: 0 0 6px 0;">SunPower Solar Engineering Ltd &bull; Sustainable Energy Infrastructure</p>
      <p style="margin: 0;">This is an automated notification. Please do not reply directly to this email.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generic email dispatcher
 */
export async function sendEmail({ to, subject, html, text }) {
  const transporter = getTransporter();
  const mailOptions = {
    from: config.SMTP_FROM,
    to,
    subject,
    text,
    html
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId, simulated: !!info.simulated };
  } catch (error) {
    console.error(`[Mail Service Error]: Failed to send email to ${to}:`, error.message);
    // Don't let email failures crash business workflows in non-production environments
    if (config.NODE_ENV !== 'production') {
      return { success: false, error: error.message, simulated: true };
    }
    throw error;
  }
}

/**
 * 1. Password Reset Email
 */
export async function sendPasswordResetEmail({ to, name, resetToken, resetUrl }) {
  const finalResetUrl = resetUrl || `${config.CLIENT_ORIGIN}/reset-password?token=${resetToken}`;
  const subject = 'Reset Your SunPower ERP Password';

  const contentHtml = `
    <h1 class="title">Password Reset Request</h1>
    <p>Hello ${name || 'there'},</p>
    <p>We received a request to reset your password for your SunPower ERP account. Click the button below to set a new password:</p>
    <div class="button-container">
      <a href="${finalResetUrl}" class="button">Reset Password</a>
    </div>
    <p style="font-size: 13px; color: #64748b;">Or paste this link into your browser:<br/><a href="${finalResetUrl}" style="color: #0284c7; word-break: break-all;">${finalResetUrl}</a></p>
    <div class="code-box">
      <div style="font-size: 13px; color: #64748b; margin-bottom: 6px;">Reset Token (if requested on screen):</div>
      <div class="code-value" style="font-size: 16px; letter-spacing: 1px;">${resetToken}</div>
    </div>
    <p style="font-size: 13px; color: #dc2626;"><strong>Security Notice:</strong> This link is single-use and will expire in <strong>1 hour</strong>. If you did not request a password reset, please ignore this email or contact support immediately.</p>
  `;

  const text = `
Hello ${name || 'there'},

We received a request to reset your password for your SunPower ERP account.
To reset your password, visit: ${finalResetUrl}

Reset Token: ${resetToken}
This link will expire in 1 hour. If you did not request this, please disregard.
  `.trim();

  const html = wrapHtmlTemplate({
    title: subject,
    preheader: 'Reset your SunPower account password within 1 hour.',
    contentHtml
  });

  return await sendEmail({ to, subject, html, text });
}

/**
 * 2. Customer Welcome & Portal Onboarding Email
 */
export async function sendCustomerWelcomeEmail({ to, name, temporaryPassword, portalUrl }) {
  const finalPortalUrl = portalUrl || `${config.CLIENT_ORIGIN}/login`;
  const subject = 'Welcome to SunPower Solar! Customer Portal Credentials';

  const contentHtml = `
    <h1 class="title">Welcome to SunPower Solar!</h1>
    <p>Dear ${name || 'Valued Customer'},</p>
    <p>Your rooftop solar project has been officially confirmed! To monitor your project progress, download warranty certificates, and view tax invoices, your dedicated <strong>SunPower Customer Portal</strong> account is now active.</p>
    
    <div class="credentials-box">
      <div style="font-weight: 700; color: #0f172a; margin-bottom: 12px; font-size: 15px;">Your Customer Portal Credentials:</div>
      <div class="credentials-row">
        <span class="credentials-label">Portal Login URL:</span>
        <a href="${finalPortalUrl}" style="color: #0284c7; font-weight: 600;">${finalPortalUrl}</a>
      </div>
      <div class="credentials-row">
        <span class="credentials-label">Username / Email:</span>
        <span class="credentials-val">${to}</span>
      </div>
      <div class="credentials-row">
        <span class="credentials-label">Temporary Password:</span>
        <span class="credentials-val">${temporaryPassword}</span>
      </div>
    </div>

    <div class="button-container">
      <a href="${finalPortalUrl}" class="button">Log In to Customer Portal</a>
    </div>

    <p style="font-size: 13px; color: #475569;">
      <strong>Security Recommendation:</strong> For your protection, please change your password immediately after your first sign-in using the "Change Password" button in your portal header.
    </p>
  `;

  const text = `
Welcome to SunPower Solar!

Dear ${name || 'Valued Customer'},
Your rooftop solar project is confirmed and your Customer Portal account is ready.

Portal Login: ${finalPortalUrl}
Username: ${to}
Temporary Password: ${temporaryPassword}

Please log in and update your password under your account settings.
  `.trim();

  const html = wrapHtmlTemplate({
    title: subject,
    preheader: 'Your SunPower Solar Customer Portal access credentials are ready.',
    contentHtml
  });

  return await sendEmail({ to, subject, html, text });
}

/**
 * 3. One-Time Password (OTP) Verification Email
 */
export async function sendOtpEmail({ to, name, otp, purpose = 'Account Verification' }) {
  const subject = `Your SunPower Verification Code: ${otp}`;

  const contentHtml = `
    <h1 class="title">${purpose}</h1>
    <p>Hello ${name || 'there'},</p>
    <p>Use the following verification code to proceed with ${purpose.toLowerCase()}:</p>
    
    <div class="code-box">
      <div class="code-value">${otp}</div>
      <div style="font-size: 12px; color: #64748b; margin-top: 8px;">Valid for 10 minutes &bull; Single-use code</div>
    </div>

    <p style="font-size: 13px; color: #dc2626;">
      <strong>Never share your OTP with anyone.</strong> SunPower staff will never ask for your verification code.
    </p>
  `;

  const text = `
Your SunPower Verification Code: ${otp}
Valid for 10 minutes for ${purpose}. Never share this code with anyone.
  `.trim();

  const html = wrapHtmlTemplate({
    title: subject,
    preheader: `Your verification code is ${otp}.`,
    contentHtml
  });

  return await sendEmail({ to, subject, html, text });
}

/**
 * 4. Milestone Tax Invoice Notification Email
 */
export async function sendInvoiceNotification({ to, name, invoiceNumber, amount, dueDate, portalUrl }) {
  const finalPortalUrl = portalUrl || `${config.CLIENT_ORIGIN}/portal`;
  const subject = `Tax Invoice Issued: ${invoiceNumber} - SunPower Solar`;

  const contentHtml = `
    <h1 class="title">Tax Invoice Issued</h1>
    <p>Dear ${name || 'Customer'},</p>
    <p>A new tax invoice has been generated for your solar installation project milestone.</p>
    
    <div class="credentials-box">
      <div class="credentials-row">
        <span class="credentials-label">Invoice Number:</span>
        <span style="font-weight: 700; color: #0f172a;">${invoiceNumber}</span>
      </div>
      <div class="credentials-row">
        <span class="credentials-label">Invoice Total:</span>
        <span style="font-weight: 700; color: #0f172a; font-size: 16px;">₹${Number(amount).toLocaleString('en-IN')}</span>
      </div>
      ${dueDate ? `
      <div class="credentials-row">
        <span class="credentials-label">Payment Due Date:</span>
        <span>${new Date(dueDate).toLocaleDateString('en-IN')}</span>
      </div>
      ` : ''}
    </div>

    <div class="button-container">
      <a href="${finalPortalUrl}" class="button">View & Download Invoice</a>
    </div>
  `;

  const text = `
Dear ${name || 'Customer'},
A new tax invoice ${invoiceNumber} for ₹${Number(amount).toLocaleString('en-IN')} has been generated.
Log in to view: ${finalPortalUrl}
  `.trim();

  const html = wrapHtmlTemplate({
    title: subject,
    preheader: `Tax Invoice ${invoiceNumber} for ₹${Number(amount).toLocaleString('en-IN')} has been issued.`,
    contentHtml
  });

  return await sendEmail({ to, subject, html, text });
}

/**
 * 5. Test Email to verify SMTP configuration
 */
export async function sendTestEmail({ to }) {
  const subject = 'SunPower ERP: SMTP Connectivity Verification';
  const timestamp = new Date().toLocaleString('en-IN');

  const contentHtml = `
    <h1 class="title">SMTP Test Successful! 🚀</h1>
    <p>This email confirms that your SMTP mail settings in SunPower ERP are configured properly and operational.</p>
    
    <div class="credentials-box">
      <div class="credentials-row">
        <span class="credentials-label">Sent At:</span>
        <span>${timestamp}</span>
      </div>
      <div class="credentials-row">
        <span class="credentials-label">SMTP Server:</span>
        <span>${config.SMTP_HOST || 'Development Mock Transporter'}</span>
      </div>
      <div class="credentials-row">
        <span class="credentials-label">Sender Address:</span>
        <span>${config.SMTP_FROM}</span>
      </div>
    </div>
  `;

  const text = `SunPower ERP SMTP Test Email sent successfully at ${timestamp}.`;

  const html = wrapHtmlTemplate({
    title: subject,
    preheader: 'Your SMTP mail server configuration is working correctly.',
    contentHtml
  });

  return await sendEmail({ to, subject, html, text });
}

export const mailService = {
  sendEmail,
  sendPasswordResetEmail,
  sendCustomerWelcomeEmail,
  sendOtpEmail,
  sendInvoiceNotification,
  sendTestEmail
};

export default mailService;
