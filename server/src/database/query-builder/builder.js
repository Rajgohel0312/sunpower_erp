/**
 * Fluent Query Builder for SunPower ERP
 * Builds query AST and compiles to parameterized SQL.
 */

import { compile } from './compiler.js';

export class QueryBuilder {
  constructor(defaultExecutor = null) {
    this.executor = defaultExecutor;
    this.ast = {
      operation: 'SELECT',
      columns: [],
      distinct: false,
      table: null,
      joins: [],
      wheres: [],
      groups: [],
      havings: [],
      orders: [],
      limit: null,
      offset: null,
      lock: null,
      allowAll: false,
      rows: null,
      data: null,
      returning: [],
      onConflict: null
    };
  }

  // Operation Select
  select(...columns) {
    this.ast.operation = 'SELECT';
    const flat = columns.flat().filter(Boolean);
    this.ast.columns = flat.length > 0 ? flat : ['*'];
    return this;
  }

  distinct(isDistinct = true) {
    this.ast.distinct = isDistinct;
    return this;
  }

  from(table) {
    this.ast.table = table;
    return this;
  }

  // Joins
  join(table, left, op, right) {
    return this._addJoin('INNER', table, left, op, right);
  }

  leftJoin(table, left, op, right) {
    return this._addJoin('LEFT', table, left, op, right);
  }

  rightJoin(table, left, op, right) {
    return this._addJoin('RIGHT', table, left, op, right);
  }

  _addJoin(type, table, left, op, right) {
    let onCondition;
    if (typeof left === 'object' && left !== null) {
      onCondition = left;
    } else {
      onCondition = { type: 'column', left, op, right };
    }
    this.ast.joins.push({ type, table, on: onCondition });
    return this;
  }

  // Where Conditions
  where(column, op, value) {
    return this._addWhere('AND', column, op, value);
  }

  andWhere(column, op, value) {
    return this._addWhere('AND', column, op, value);
  }

  orWhere(column, op, value) {
    return this._addWhere('OR', column, op, value);
  }

  _addWhere(boolean, column, op, value) {
    // Shorthand where({ status: 'active', role: 'admin' })
    if (typeof column === 'object' && column !== null && op === undefined) {
      for (const [key, val] of Object.entries(column)) {
        if (val === null) {
          this.whereNull(key);
        } else if (Array.isArray(val)) {
          this.whereIn(key, val);
        } else {
          this._addWhere(boolean, key, '=', val);
        }
      }
      return this;
    }

    // Standard where('col', '=', value) or where('col', value) defaulting to '='
    if (value === undefined) {
      value = op;
      op = '=';
    }

    this.ast.wheres.push({
      boolean,
      type: 'basic',
      column,
      op,
      value
    });
    return this;
  }

  whereIn(column, values) {
    this.ast.wheres.push({
      boolean: 'AND',
      type: 'in',
      column,
      values,
      isNot: false
    });
    return this;
  }

  whereNotIn(column, values) {
    this.ast.wheres.push({
      boolean: 'AND',
      type: 'in',
      column,
      values,
      isNot: true
    });
    return this;
  }

  whereNull(column) {
    this.ast.wheres.push({
      boolean: 'AND',
      type: 'null',
      column,
      isNot: false
    });
    return this;
  }

  whereNotNull(column) {
    this.ast.wheres.push({
      boolean: 'AND',
      type: 'null',
      column,
      isNot: true
    });
    return this;
  }

  whereBetween(column, from, to) {
    this.ast.wheres.push({
      boolean: 'AND',
      type: 'between',
      column,
      from,
      to,
      isNot: false
    });
    return this;
  }

  // Nested groups e.g. .whereGroup(g => g.where('status', '=', 'active').orWhere('role', '=', 'admin'))
  whereGroup(fn) {
    return this._addGroup('AND', fn);
  }

  orWhereGroup(fn) {
    return this._addGroup('OR', fn);
  }

  _addGroup(boolean, fn) {
    const subBuilder = new QueryBuilder();
    fn(subBuilder);
    if (subBuilder.ast.wheres.length > 0) {
      this.ast.wheres.push({
        boolean,
        type: 'group',
        conditions: subBuilder.ast.wheres
      });
    }
    return this;
  }

  // Aggregations & Grouping
  groupBy(...columns) {
    this.ast.groups.push(...columns.flat());
    return this;
  }

  having(column, op, value) {
    if (value === undefined) {
      value = op;
      op = '=';
    }
    this.ast.havings.push({
      boolean: 'AND',
      type: 'basic',
      column,
      op,
      value
    });
    return this;
  }

  // Ordering & Pagination
  orderBy(column, direction = 'ASC') {
    this.ast.orders.push({ column, direction });
    return this;
  }

  limit(limitCount) {
    this.ast.limit = limitCount;
    return this;
  }

  offset(offsetCount) {
    this.ast.offset = offsetCount;
    return this;
  }

  // Row Locking (Pessimistic concurrency)
  forUpdate(skipLocked = false) {
    this.ast.lock = skipLocked ? 'FOR UPDATE SKIP LOCKED' : 'FOR UPDATE';
    return this;
  }

  // Insert
  insert(dataOrArray) {
    this.ast.operation = 'INSERT';
    if (dataOrArray) {
      this.ast.rows = Array.isArray(dataOrArray) ? dataOrArray : [dataOrArray];
    }
    return this;
  }

  into(table) {
    this.ast.operation = 'INSERT';
    this.ast.table = table;
    return this;
  }

  values(dataOrArray) {
    this.ast.operation = 'INSERT';
    this.ast.rows = Array.isArray(dataOrArray) ? dataOrArray : [dataOrArray];
    return this;
  }

  onConflict(target, action = 'DO NOTHING', updateColumns = []) {
    this.ast.onConflict = { target, action, updateColumns };
    return this;
  }

  // Update
  update(data) {
    this.ast.operation = 'UPDATE';
    if (data) {
      this.ast.data = data;
    }
    return this;
  }

  table(table) {
    this.ast.table = table;
    return this;
  }

  set(data) {
    this.ast.data = data;
    return this;
  }

  // Delete
  delete(table) {
    this.ast.operation = 'DELETE';
    if (table) {
      this.ast.table = table;
    }
    return this;
  }

  // Returning
  returning(...columns) {
    this.ast.returning.push(...columns.flat());
    return this;
  }

  // Explicit safety override for unbounded updates/deletes
  allowAll() {
    this.ast.allowAll = true;
    return this;
  }

  /**
   * Compiles current AST into { text: string, values: any[] }
   * @returns {{ text: string, values: any[] }}
   */
  toSql() {
    return compile(this.ast);
  }

  /**
   * Executes the compiled query using the assigned or provided executor/pool/client.
   * @param {object} [clientOrPool]
   * @returns {Promise<any[]>}
   */
  async execute(clientOrPool = null) {
    const target = clientOrPool || this.executor;
    if (!target) {
      throw new Error('No database client or pool available to execute query. Call toSql() to inspect compiled SQL.');
    }
    const { text, values } = this.toSql();
    const result = await target.query(text, values);
    return result.rows || [];
  }

  /**
   * Executes and returns the first row or null if not found.
   * @param {object} [clientOrPool]
   * @returns {Promise<object|null>}
   */
  async executeTakeFirst(clientOrPool = null) {
    const rows = await this.execute(clientOrPool);
    return rows.length > 0 ? rows[0] : null;
  }
}
