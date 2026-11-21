/**
 * Database Entry Point for SunPower ERP
 * Provides fluent query builder bound to connection pool and transaction helpers.
 */

import { QueryBuilder } from './query-builder/builder.js';
import { pool, withTransaction, closePool, DatabaseError } from './pool.js';

export { QueryBuilder, DatabaseError, withTransaction, closePool, pool };

export const db = {
  /**
   * Start a SELECT query builder
   * @param {...string} columns
   * @returns {QueryBuilder}
   */
  select(...columns) {
    const qb = new QueryBuilder(pool);
    return qb.select(...columns);
  },

  /**
   * Start an INSERT query builder
   * @param {string} [table]
   * @param {object|object[]} [data]
   * @returns {QueryBuilder}
   */
  insert(data) {
    const qb = new QueryBuilder(pool);
    return qb.insert(data);
  },

  /**
   * Convenience insert helper: db.insertInto('customers', { name: 'Raj' })
   * @param {string} table
   * @param {object|object[]} data
   * @returns {QueryBuilder}
   */
  insertInto(table, data) {
    const qb = new QueryBuilder(pool);
    return qb.into(table).insert(data);
  },

  /**
   * Start an UPDATE query builder
   * @param {string} table
   * @param {object} [data]
   * @returns {QueryBuilder}
   */
  update(table, data) {
    const qb = new QueryBuilder(pool);
    qb.table(table);
    if (data) qb.set(data);
    return qb;
  },

  /**
   * Start a DELETE query builder
   * @param {string} table
   * @returns {QueryBuilder}
   */
  deleteFrom(table) {
    const qb = new QueryBuilder(pool);
    return qb.delete(table);
  },

  /**
   * Execute raw parameterized query (trusted internal use only, NEVER from raw user input)
   * @param {string} text
   * @param {any[]} [values]
   * @param {object} [client] Optional transaction client
   * @returns {Promise<any[]>}
   */
  async raw(text, values = [], client = null) {
    const target = client || pool;
    const result = await target.query(text, values);
    return result.rows || [];
  },

  /**
   * Scoped transaction runner
   */
  withTransaction,

  /**
   * Access to raw pool
   */
  pool,

  /**
   * Graceful close
   */
  closePool
};

export default db;
