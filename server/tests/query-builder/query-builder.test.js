/**
 * Comprehensive Unit Test Suite for SunPower ERP Custom Query Builder
 * Tests SQL generation, parameterized bindings, operator allowlists, and injection prevention.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { QueryBuilder } from '../../src/database/query-builder/builder.js';
import { formatColumn, formatTable, quoteIdentifier } from '../../src/database/query-builder/identifiers.js';
import { validateOperator } from '../../src/database/query-builder/operators.js';

describe('Query Builder — Identifiers & Operator Safety', () => {
  test('quoteIdentifier allows valid snake_case identifiers', () => {
    assert.equal(quoteIdentifier('users'), '"users"');
    assert.equal(quoteIdentifier('customer_addresses'), '"customer_addresses"');
    assert.equal(quoteIdentifier('_private_field'), '"_private_field"');
    assert.equal(quoteIdentifier('solar_inverter_18'), '"solar_inverter_18"');
  });

  test('quoteIdentifier rejects SQL injection and invalid characters', () => {
    const malicious = [
      'users; DROP TABLE customers;--',
      'users" OR "1"="1"',
      'users/*',
      'user-names',
      'users.status',
      '123users',
      'users\x00'
    ];

    for (const bad of malicious) {
      assert.throws(
        () => quoteIdentifier(bad),
        /Invalid SQL identifier/,
        `Should reject malicious identifier: ${bad}`
      );
    }
  });

  test('formatColumn correctly formats columns, table qualifiers, aliases, and aggregates', () => {
    assert.equal(formatColumn('*'), '*');
    assert.equal(formatColumn('c.*'), '"c".*');
    assert.equal(formatColumn('name'), '"name"');
    assert.equal(formatColumn('customers.name'), '"customers"."name"');
    assert.equal(formatColumn('customers.name AS full_name'), '"customers"."name" AS "full_name"');
    assert.equal(formatColumn('COUNT(*)'), 'COUNT(*)');
    assert.equal(formatColumn('COUNT(*) AS total'), 'COUNT(*) AS "total"');
    assert.equal(formatColumn('SUM(amount) AS total_revenue'), 'SUM("amount") AS "total_revenue"');
  });

  test('formatTable correctly formats table with optional alias', () => {
    assert.equal(formatTable('customers'), '"customers"');
    assert.equal(formatTable('customers AS c'), '"customers" AS "c"');
    assert.equal(formatTable('customers c'), '"customers" AS "c"');
  });

  test('validateOperator enforces allowlist', () => {
    assert.equal(validateOperator('='), '=');
    assert.equal(validateOperator('!='), '<>');
    assert.equal(validateOperator('<>'), '<>');
    assert.equal(validateOperator('>'), '>');
    assert.equal(validateOperator('LIKE'), 'LIKE');
    assert.equal(validateOperator('ilike'), 'ILIKE');
    assert.equal(validateOperator('IS'), 'IS');
    assert.equal(validateOperator('is not'), 'IS NOT');

    assert.throws(() => validateOperator('SLEEP(5)'), /Disallowed SQL operator/);
    assert.throws(() => validateOperator('UNION SELECT'), /Disallowed SQL operator/);
  });
});

describe('Query Builder — SELECT Compilation', () => {
  test('compiles basic SELECT * query', () => {
    const qb = new QueryBuilder().select('*').from('customers');
    const { text, values } = qb.toSql();

    assert.equal(text, 'SELECT * FROM "customers";');
    assert.deepEqual(values, []);
  });

  test('compiles SELECT with columns, aliases, and WHERE conditions', () => {
    const qb = new QueryBuilder()
      .select('c.id', 'c.full_name', 'c.phone_e164 AS phone')
      .from('customers AS c')
      .where('c.customer_type', '=', 'RESIDENTIAL')
      .andWhere('c.phone_e164', '=', '+919876543210');

    const { text, values } = qb.toSql();

    assert.equal(
      text,
      'SELECT "c"."id", "c"."full_name", "c"."phone_e164" AS "phone" FROM "customers" AS "c" WHERE "c"."customer_type" = $1 AND "c"."phone_e164" = $2;'
    );
    assert.deepEqual(values, ['RESIDENTIAL', '+919876543210']);
  });

  test('compiles JOINs with on conditions', () => {
    const qb = new QueryBuilder()
      .select('l.id', 'l.lead_number', 'c.full_name')
      .from('leads AS l')
      .leftJoin('customers AS c', 'c.id', '=', 'l.customer_id')
      .where('l.stage', '=', 'QUALIFIED');

    const { text, values } = qb.toSql();

    assert.equal(
      text,
      'SELECT "l"."id", "l"."lead_number", "c"."full_name" FROM "leads" AS "l" LEFT JOIN "customers" AS "c" ON "c"."id" = "l"."customer_id" WHERE "l"."stage" = $1;'
    );
    assert.deepEqual(values, ['QUALIFIED']);
  });

  test('compiles IN lists and handles empty IN lists safely', () => {
    // Normal IN list
    const qb1 = new QueryBuilder()
      .select('id')
      .from('products')
      .whereIn('category_id', ['uuid-1', 'uuid-2']);

    const res1 = qb1.toSql();
    assert.equal(res1.text, 'SELECT "id" FROM "products" WHERE "category_id" IN ($1, $2);');
    assert.deepEqual(res1.values, ['uuid-1', 'uuid-2']);

    // Empty IN list must NOT fail with SQL syntax error; compiles safely to (1 = 0)
    const qb2 = new QueryBuilder()
      .select('id')
      .from('products')
      .whereIn('category_id', []);

    const res2 = qb2.toSql();
    assert.equal(res2.text, 'SELECT "id" FROM "products" WHERE (1 = 0);');
    assert.deepEqual(res2.values, []);
  });

  test('compiles NULL checks safely without generating invalid IS $placeholder', () => {
    // 1. Using whereNull
    const qb1 = new QueryBuilder().select('id').from('users').whereNull('deleted_at');
    const res1 = qb1.toSql();
    assert.equal(res1.text, 'SELECT "id" FROM "users" WHERE "deleted_at" IS NULL;');
    assert.deepEqual(res1.values, []);

    // 2. Using where with IS null
    const qb2 = new QueryBuilder().select('id').from('users').where('deleted_at', 'IS', null);
    const res2 = qb2.toSql();
    assert.equal(res2.text, 'SELECT "id" FROM "users" WHERE "deleted_at" IS NULL;');
    assert.deepEqual(res2.values, []);

    // 3. Using where with IS NOT null
    const qb3 = new QueryBuilder().select('id').from('users').where('deleted_at', 'IS NOT', null);
    const res3 = qb3.toSql();
    assert.equal(res3.text, 'SELECT "id" FROM "users" WHERE "deleted_at" IS NOT NULL;');
    assert.deepEqual(res3.values, []);
  });

  test('compiles nested WHERE groups with parentheses', () => {
    const qb = new QueryBuilder()
      .select('id')
      .from('leads')
      .where('source', '=', 'WEBSITE')
      .andWhere(g => {
        g.where('stage', '=', 'NEW').orWhere('stage', '=', 'CONTACTED');
      });

    // Or using whereGroup explicitly
    const qbExplicit = new QueryBuilder()
      .select('id')
      .from('leads')
      .where('source', '=', 'WEBSITE')
      .whereGroup(g => {
        g.where('stage', '=', 'NEW').orWhere('stage', '=', 'CONTACTED');
      });

    const { text, values } = qbExplicit.toSql();
    assert.equal(
      text,
      'SELECT "id" FROM "leads" WHERE "source" = $1 AND ("stage" = $2 OR "stage" = $3);'
    );
    assert.deepEqual(values, ['WEBSITE', 'NEW', 'CONTACTED']);
  });

  test('compiles ORDER BY, LIMIT, OFFSET and FOR UPDATE', () => {
    const qb = new QueryBuilder()
      .select('*')
      .from('stock_balances')
      .where('product_id', '=', 'prod-uuid')
      .orderBy('quantity_available', 'DESC')
      .limit(10)
      .offset(20)
      .forUpdate();

    const { text, values } = qb.toSql();
    assert.equal(
      text,
      'SELECT * FROM "stock_balances" WHERE "product_id" = $1 ORDER BY "quantity_available" DESC LIMIT 10 OFFSET 20 FOR UPDATE;'
    );
    assert.deepEqual(values, ['prod-uuid']);
  });
});

describe('Query Builder — INSERT Compilation', () => {
  test('compiles single-row INSERT with RETURNING', () => {
    const qb = new QueryBuilder()
      .into('customers')
      .insert({
        customer_code: 'CUST-001',
        full_name: 'Raj Gohel',
        phone_e164: '+919999999999',
        customer_type: 'RESIDENTIAL'
      })
      .returning('id', 'created_at');

    const { text, values } = qb.toSql();
    assert.equal(
      text,
      'INSERT INTO "customers" ("customer_code", "full_name", "phone_e164", "customer_type") VALUES ($1, $2, $3, $4) RETURNING "id", "created_at";'
    );
    assert.deepEqual(values, ['CUST-001', 'Raj Gohel', '+919999999999', 'RESIDENTIAL']);
  });

  test('compiles multi-row batch INSERT', () => {
    const qb = new QueryBuilder()
      .into('warehouse_locations')
      .values([
        { code: 'A1', name: 'Bay 1' },
        { code: 'A2', name: 'Bay 2' }
      ]);

    const { text, values } = qb.toSql();
    assert.equal(
      text,
      'INSERT INTO "warehouse_locations" ("code", "name") VALUES ($1, $2), ($3, $4);'
    );
    assert.deepEqual(values, ['A1', 'Bay 1', 'A2', 'Bay 2']);
  });

  test('compiles INSERT with ON CONFLICT DO UPDATE (upsert)', () => {
    const qb = new QueryBuilder()
      .into('stock_balances')
      .insert({ product_id: 'p1', warehouse_id: 'w1', quantity_on_hand: 50 })
      .onConflict(['product_id', 'warehouse_id'], 'DO UPDATE', ['quantity_on_hand']);

    const { text, values } = qb.toSql();
    assert.equal(
      text,
      'INSERT INTO "stock_balances" ("product_id", "warehouse_id", "quantity_on_hand") VALUES ($1, $2, $3) ON CONFLICT ("product_id", "warehouse_id") DO UPDATE SET "quantity_on_hand" = EXCLUDED."quantity_on_hand";'
    );
    assert.deepEqual(values, ['p1', 'w1', 50]);
  });
});

describe('Query Builder — UPDATE Compilation & Guardrails', () => {
  test('compiles UPDATE with WHERE and RETURNING', () => {
    const qb = new QueryBuilder()
      .table('leads')
      .update({ stage: 'WON', notes: 'Contract signed' })
      .where('id', '=', 'lead-uuid')
      .returning('id', 'stage', 'updated_at');

    const { text, values } = qb.toSql();
    assert.equal(
      text,
      'UPDATE "leads" SET "stage" = $1, "notes" = $2 WHERE "id" = $3 RETURNING "id", "stage", "updated_at";'
    );
    assert.deepEqual(values, ['WON', 'Contract signed', 'lead-uuid']);
  });

  test('negative test: rejects dangerous UPDATE without WHERE clause', () => {
    const qb = new QueryBuilder()
      .table('users')
      .update({ is_active: false });

    assert.throws(
      () => qb.toSql(),
      /Dangerous UPDATE without WHERE clause is prohibited/,
      'Must block unbounded UPDATE'
    );
  });

  test('allows unbounded UPDATE only when allowAll() is explicitly invoked', () => {
    const qb = new QueryBuilder()
      .table('notifications')
      .update({ is_read: true })
      .allowAll();

    const { text, values } = qb.toSql();
    assert.equal(text, 'UPDATE "notifications" SET "is_read" = $1;');
    assert.deepEqual(values, [true]);
  });
});

describe('Query Builder — DELETE Compilation & Guardrails', () => {
  test('compiles DELETE with WHERE', () => {
    const qb = new QueryBuilder()
      .delete('idempotency_keys')
      .where('expires_at', '<', '2026-11-21T00:00:00Z');

    const { text, values } = qb.toSql();
    assert.equal(
      text,
      'DELETE FROM "idempotency_keys" WHERE "expires_at" < $1;'
    );
    assert.deepEqual(values, ['2026-11-21T00:00:00Z']);
  });

  test('negative test: rejects dangerous DELETE without WHERE clause', () => {
    const qb = new QueryBuilder().delete('customers');

    assert.throws(
      () => qb.toSql(),
      /Dangerous DELETE without WHERE clause is prohibited/,
      'Must block unbounded DELETE'
    );
  });
});

describe('Query Builder — SQL Injection Immunity', () => {
  test('injection attempt in WHERE value is strictly parameterized as $1', () => {
    const attackPayload = "'; DROP TABLE users; -- ' OR '1'='1";
    const qb = new QueryBuilder()
      .select('id')
      .from('users')
      .where('email', '=', attackPayload);

    const { text, values } = qb.toSql();
    assert.equal(text, 'SELECT "id" FROM "users" WHERE "email" = $1;');
    assert.equal(values[0], attackPayload);
  });

  test('injection attempt in table name is stopped by identifier validator', () => {
    assert.throws(
      () => new QueryBuilder().select('*').from('users; DROP TABLE leads;--').toSql(),
      /Invalid SQL identifier/
    );
  });

  test('injection attempt in column name is stopped by identifier validator', () => {
    assert.throws(
      () => new QueryBuilder().select('id', 'name; DELETE FROM users;--').from('users').toSql(),
      /Invalid SQL identifier/
    );
  });

  test('injection attempt in sort direction is rejected', () => {
    assert.throws(
      () => new QueryBuilder().select('*').from('users').orderBy('created_at', 'ASC; DROP TABLE users;--').toSql(),
      /Invalid sort direction/
    );
  });
});
