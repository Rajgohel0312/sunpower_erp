/**
 * Comprehensive Automated Test Suite for Phase 2: Auth, Security & RBAC
 * Tests password hashing, JWT rotation, deny-by-default RBAC, validation, and error envelopes.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, comparePassword, hashToken, generateSecureToken } from '../../src/utils/crypto.js';
import { signAccessToken, verifyAccessToken, signRefreshToken, verifyRefreshToken } from '../../src/utils/jwt.js';
import { requirePermission, requireRole } from '../../src/middleware/rbac.js';
import { validate } from '../../src/middleware/validate.js';
import { loginSchema } from '../../src/modules/auth/auth.schemas.js';
import { createUserSchema } from '../../src/modules/users/user.schemas.js';
import { sendSuccess, sendError, AppError } from '../../src/utils/response.js';
import { app } from '../../src/app.js';

describe('Phase 2 — Cryptography & Hashing', () => {
  test('hashPassword produces valid bcrypt hash and comparePassword validates match', async () => {
    const rawPass = 'SunPower@SecurePass2026';
    const hashed = await hashPassword(rawPass);

    assert.notEqual(hashed, rawPass);
    assert.match(hashed, /^\$2[aby]\$\d+\$/);

    const isMatch = await comparePassword(rawPass, hashed);
    assert.equal(isMatch, true);

    const isWrong = await comparePassword('WrongPassword', hashed);
    assert.equal(isWrong, false);
  });

  test('hashToken produces consistent SHA-256 hex digest', () => {
    const token = 'sample_refresh_token_string_12345';
    const hash1 = hashToken(token);
    const hash2 = hashToken(token);

    assert.equal(hash1, hash2);
    assert.equal(hash1.length, 64);
  });

  test('generateSecureToken produces unique cryptographically random tokens', () => {
    const t1 = generateSecureToken(32);
    const t2 = generateSecureToken(32);

    assert.equal(t1.length, 64); // 32 bytes in hex = 64 chars
    assert.notEqual(t1, t2);
  });
});

describe('Phase 2 — JWT Token Lifecycle', () => {
  test('signAccessToken and verifyAccessToken roundtrip with claims', () => {
    const claims = {
      sub: 'user-uuid-123',
      email: 'engineer@sunpower.com',
      fullName: 'SunPower Engineer',
      roles: ['SURVEY_ENGINEER'],
      permissions: ['surveys:create', 'surveys:read']
    };

    const token = signAccessToken(claims);
    assert.ok(typeof token === 'string');

    const decoded = verifyAccessToken(token);
    assert.equal(decoded.sub, claims.sub);
    assert.equal(decoded.email, claims.email);
    assert.deepEqual(decoded.roles, claims.roles);
    assert.deepEqual(decoded.permissions, claims.permissions);
  });

  test('tampered access token fails verification', () => {
    const token = signAccessToken({ sub: 'user-1' });
    const tampered = token.slice(0, -5) + 'xxxxx';

    assert.throws(
      () => verifyAccessToken(tampered),
      /INVALID_ACCESS_TOKEN/
    );
  });

  test('signRefreshToken and verifyRefreshToken roundtrip', () => {
    const claims = { sub: 'user-uuid-456', familyId: 'family-uuid-789' };
    const token = signRefreshToken(claims);
    const decoded = verifyRefreshToken(token);

    assert.equal(decoded.sub, claims.sub);
    assert.equal(decoded.familyId, claims.familyId);
  });
});

describe('Phase 2 — Deny-by-Default RBAC Middleware', () => {
  test('unauthenticated actor (!req.user) is blocked with 401', () => {
    const req = { user: null };
    const res = {};
    let caughtErr = null;

    const middleware = requirePermission('leads:create');
    middleware(req, res, (err) => {
      caughtErr = err;
    });

    assert.ok(caughtErr instanceof AppError);
    assert.equal(caughtErr.statusCode, 401);
    assert.equal(caughtErr.code, 'UNAUTHENTICATED');
  });

  test('authenticated user lacking required permission is blocked with 403', () => {
    const req = {
      user: {
        id: 'u1',
        roles: ['SALES_REP'],
        permissions: ['leads:create', 'leads:read']
      }
    };
    const res = {};
    let caughtErr = null;

    // Check for an unauthorized permission
    const middleware = requirePermission('quotations:approve');
    middleware(req, res, (err) => {
      caughtErr = err;
    });

    assert.ok(caughtErr instanceof AppError);
    assert.equal(caughtErr.statusCode, 403);
    assert.equal(caughtErr.code, 'INSUFFICIENT_PERMISSIONS');
  });

  test('authenticated user possessing required permission passes through', () => {
    const req = {
      user: {
        id: 'u1',
        roles: ['SALES_REP'],
        permissions: ['leads:create', 'leads:read']
      }
    };
    const res = {};
    let calledNext = false;

    const middleware = requirePermission('leads:create');
    middleware(req, res, (err) => {
      assert.ifError(err);
      calledNext = true;
    });

    assert.equal(calledNext, true);
  });

  test('SUPER_ADMIN role bypasses permission check', () => {
    const req = {
      user: {
        id: 'super-admin-id',
        roles: ['SUPER_ADMIN'],
        permissions: [] // Even with empty permissions array
      }
    };
    const res = {};
    let calledNext = false;

    const middleware = requirePermission('system:restricted_action');
    middleware(req, res, (err) => {
      assert.ifError(err);
      calledNext = true;
    });

    assert.equal(calledNext, true);
  });

  test('requireRole enforces allowed role list', () => {
    const req = {
      user: {
        id: 'tech-1',
        roles: ['TECHNICIAN'],
        permissions: []
      }
    };
    let caughtErr = null;

    // Requires ACCOUNTANT or SUPER_ADMIN
    requireRole('ACCOUNTANT', 'SUPER_ADMIN')(req, {}, (err) => {
      caughtErr = err;
    });

    assert.ok(caughtErr instanceof AppError);
    assert.equal(caughtErr.statusCode, 403);
    assert.equal(caughtErr.code, 'FORBIDDEN_ROLE');
  });
});

describe('Phase 2 — Zod Schema Validation at Boundaries', () => {
  test('loginSchema validates email and password length', () => {
    const valid = loginSchema.parse({
      email: '  Sales.User@SunPower.com  ',
      password: 'password123'
    });

    assert.equal(valid.email, 'sales.user@sunpower.com'); // Trimmed and lowercased
    assert.equal(valid.password, 'password123');

    // Invalid email
    assert.throws(
      () => loginSchema.parse({ email: 'not-an-email', password: 'password123' }),
      /Invalid email/
    );

    // Short password
    assert.throws(
      () => loginSchema.parse({ email: 'valid@sunpower.com', password: 'short' }),
      /at least 8 characters/
    );
  });

  test('validation middleware catches ZodError and forwards AppError with details', () => {
    const middleware = validate({ body: loginSchema });
    const req = { body: { email: 'invalid', password: '123' } };
    let caughtErr = null;

    middleware(req, {}, (err) => {
      caughtErr = err;
    });

    assert.ok(caughtErr instanceof AppError);
    assert.equal(caughtErr.statusCode, 400);
    assert.equal(caughtErr.code, 'VALIDATION_ERROR');
    assert.ok(Array.isArray(caughtErr.details));
    assert.equal(caughtErr.details.length, 2);
  });
});

describe('Phase 2 — Standard Response Envelope', () => {
  test('sendSuccess formats data and meta envelope', () => {
    let sentStatus = null;
    let sentJson = null;

    const mockRes = {
      req: { id: 'req-uuid-123' },
      status(s) { sentStatus = s; return this; },
      json(j) { sentJson = j; return this; }
    };

    sendSuccess(mockRes, { user: 'Raj' }, { count: 1 }, 200);

    assert.equal(sentStatus, 200);
    assert.deepEqual(sentJson.data, { user: 'Raj' });
    assert.equal(sentJson.meta.requestId, 'req-uuid-123');
    assert.equal(sentJson.meta.count, 1);
    assert.ok(sentJson.meta.timestamp);
  });

  test('sendError formats error envelope with code, message, details, and requestId', () => {
    let sentStatus = null;
    let sentJson = null;

    const mockRes = {
      req: { id: 'req-uuid-456' },
      status(s) { sentStatus = s; return this; },
      json(j) { sentJson = j; return this; }
    };

    sendError(mockRes, {
      code: 'RESOURCE_LOCKED',
      message: 'Row is locked by another transaction',
      details: { rowId: 'row-1' }
    }, 409);

    assert.equal(sentStatus, 409);
    assert.equal(sentJson.error.code, 'RESOURCE_LOCKED');
    assert.equal(sentJson.error.message, 'Row is locked by another transaction');
    assert.deepEqual(sentJson.error.details, { rowId: 'row-1' });
    assert.equal(sentJson.error.requestId, 'req-uuid-456');
  });
});
