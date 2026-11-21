/**
 * Prisma ORM Integration & Safety Test Suite
 * Tests client connectivity, transactions, and error mapping.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, withTransaction, mapDatabaseError, DatabaseError } from '../../src/database/index.js';

describe('Phase 1 (Replaced) — Prisma ORM & Database Engine', () => {
  test('Prisma client connects and can execute a simple query', async () => {
    const roles = await prisma.roles.findMany({ take: 2 });
    assert.ok(Array.isArray(roles));
    assert.ok(roles.length > 0);
  });

  test('mapDatabaseError correctly wraps Prisma P2002 into UNIQUE_CONSTRAINT_VIOLATION', () => {
    const mockP2002 = {
      code: 'P2002',
      meta: { target: ['email'] },
      message: 'Unique constraint failed on the fields: (`email`)'
    };

    const mapped = mapDatabaseError(mockP2002);
    assert.ok(mapped instanceof DatabaseError);
    assert.equal(mapped.code, 'UNIQUE_CONSTRAINT_VIOLATION');
    assert.deepEqual(mapped.details, { target: ['email'] });
  });

  test('mapDatabaseError correctly wraps Prisma P2003 into FOREIGN_KEY_VIOLATION', () => {
    const mockP2003 = {
      code: 'P2003',
      meta: { field_name: 'user_id' },
      message: 'Foreign key constraint failed'
    };

    const mapped = mapDatabaseError(mockP2003);
    assert.ok(mapped instanceof DatabaseError);
    assert.equal(mapped.code, 'FOREIGN_KEY_VIOLATION');
  });

  test('withTransaction rolls back when callback throws an error', async () => {
    const tempEmail = `rollback-test-${Date.now()}@sunpower.com`;

    await assert.rejects(
      async () => {
        await withTransaction(async (tx) => {
          await tx.users.create({
            data: {
              email: tempEmail,
              phone_e164: `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`,
              password_hash: 'hash123',
              full_name: 'Rollback Tester'
            }
          });

          // Deliberate error to trigger rollback
          throw new Error('SIMULATED_TRANSACTION_FAILURE');
        });
      },
      /SIMULATED_TRANSACTION_FAILURE/
    );

    // Verify user was NOT persisted due to rollback
    const user = await prisma.users.findFirst({ where: { email: tempEmail } });
    assert.equal(user, null);
  });
});
