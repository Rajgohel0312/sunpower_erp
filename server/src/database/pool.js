/**
 * PostgreSQL Connection Pool & Transaction Manager for SunPower ERP
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Pool configuration with production-grade timeouts and connection caps
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://app_user:postgres@localhost:5432/sunpower_erp',
  max: parseInt(process.env.DB_POOL_MAX || '20', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  // Log safe error without secrets
  console.error('[PostgreSQL Pool Error]: Unexpected idle client error:', err.message);
});

/**
 * Standard database error wrapper preventing secret leaks
 */
export class DatabaseError extends Error {
  constructor(message, code = 'DB_ERROR', details = null) {
    super(message);
    this.name = 'DatabaseError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Maps raw PostgreSQL error codes to safe application domain errors
 * @param {Error} err
 * @returns {DatabaseError}
 */
export function mapDatabaseError(err) {
  if (err instanceof DatabaseError) return err;

  // Preserve AppError or standard non-database errors
  if (err?.name === 'AppError' || err?.statusCode) return err;

  // If error has no standard 5-character PostgreSQL code, don't mask it
  if (!err?.code || typeof err.code !== 'string' || err.code.length !== 5) {
    return err;
  }

  // PostgreSQL Error Code 23505 = unique_violation
  if (err.code === '23505') {
    return new DatabaseError(
      'A record with this unique identifier already exists.',
      'UNIQUE_CONSTRAINT_VIOLATION',
      { constraint: err.constraint }
    );
  }

  // PostgreSQL Error Code 23503 = foreign_key_violation
  if (err.code === '23503') {
    return new DatabaseError(
      'Referenced entity was not found.',
      'FOREIGN_KEY_VIOLATION',
      { constraint: err.constraint }
    );
  }

  // PostgreSQL Error Code 23514 = check_violation
  if (err.code === '23514') {
    return new DatabaseError(
      'Database constraint validation failed.',
      'CHECK_CONSTRAINT_VIOLATION',
      { constraint: err.constraint }
    );
  }

  // Generic DB error without leaking stack or SQL internals
  return new DatabaseError('Database operation failed.', 'DATABASE_OPERATION_FAILED');
}

/**
 * Transaction helper executing a callback inside a BEGIN / COMMIT / ROLLBACK block.
 * Guarantees client checkout and release in all conditions.
 *
 * @param {Function} callback (client: pg.PoolClient) => Promise<T>
 * @returns {Promise<T>}
 */
export async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('[PostgreSQL Rollback Error]:', rollbackErr.message);
    }
    throw mapDatabaseError(err);
  } finally {
    client.release();
  }
}

/**
 * Closes the connection pool gracefully
 */
export async function closePool() {
  await pool.end();
}
