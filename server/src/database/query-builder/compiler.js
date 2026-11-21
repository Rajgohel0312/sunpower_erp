/**
 * Pure SQL Compiler for SunPower ERP
 * Compiles Query AST into { text: string, values: any[] } with positional $n parameters.
 */

import { formatColumn, formatTable, quoteIdentifier } from './identifiers.js';
import { validateOperator } from './operators.js';

class CompileContext {
  constructor() {
    this.values = [];
  }

  addValue(val) {
    this.values.push(val);
    return `$${this.values.length}`;
  }
}

/**
 * Compiles a WHERE condition node
 * @param {object} cond
 * @param {CompileContext} ctx
 * @returns {string}
 */
function compileCondition(cond, ctx) {
  // Nested group: { type: 'group', boolean: 'AND'|'OR', conditions: [...] }
  if (cond.type === 'group') {
    if (!cond.conditions || cond.conditions.length === 0) {
      return '';
    }
    const parts = cond.conditions
      .map((c, i) => {
        const compiled = compileCondition(c, ctx);
        if (!compiled) return '';
        return i === 0 ? compiled : `${c.boolean || 'AND'} ${compiled}`;
      })
      .filter(Boolean);

    return parts.length > 0 ? `(${parts.join(' ')})` : '';
  }

  // Null check: { type: 'null', column, isNot: boolean }
  if (cond.type === 'null') {
    const col = formatColumn(cond.column);
    return `${col} ${cond.isNot ? 'IS NOT NULL' : 'IS NULL'}`;
  }

  // IN list: { type: 'in', column, values: [...], isNot: boolean }
  if (cond.type === 'in') {
    const col = formatColumn(cond.column);
    const list = Array.isArray(cond.values) ? cond.values : [];
    if (list.length === 0) {
      // Safe false / true condition when list is empty
      return cond.isNot ? '(1 = 1)' : '(1 = 0)';
    }
    const placeholders = list.map(v => ctx.addValue(v)).join(', ');
    return `${col} ${cond.isNot ? 'NOT IN' : 'IN'} (${placeholders})`;
  }

  // BETWEEN: { type: 'between', column, from, to, isNot: boolean }
  if (cond.type === 'between') {
    const col = formatColumn(cond.column);
    const p1 = ctx.addValue(cond.from);
    const p2 = ctx.addValue(cond.to);
    return `${col} ${cond.isNot ? 'NOT BETWEEN' : 'BETWEEN'} ${p1} AND ${p2}`;
  }

  // Column-to-Column comparison: { type: 'column', left, op, right }
  if (cond.type === 'column') {
    const left = formatColumn(cond.left);
    const op = validateOperator(cond.op);
    const right = formatColumn(cond.right);
    return `${left} ${op} ${right}`;
  }

  // Standard comparison: { type: 'basic', column, op, value }
  if (cond.type === 'basic') {
    const col = formatColumn(cond.column);
    const op = validateOperator(cond.op);

    // Handle NULL checks with any equality or IS operator
    if (cond.value === null || cond.value === undefined) {
      if (op === '=' || op === 'IS') return `${col} IS NULL`;
      if (op === '<>' || op === '!=' || op === 'IS NOT') return `${col} IS NOT NULL`;
    }

    // Handle boolean IS checks (PostgreSQL does not allow IS $placeholder)
    if (op === 'IS') {
      if (cond.value === true) return `${col} IS TRUE`;
      if (cond.value === false) return `${col} IS FALSE`;
    }
    if (op === 'IS NOT') {
      if (cond.value === true) return `${col} IS NOT TRUE`;
      if (cond.value === false) return `${col} IS NOT FALSE`;
    }

    const placeholder = ctx.addValue(cond.value);
    return `${col} ${op} ${placeholder}`;
  }

  throw new Error(`Unknown condition type: "${cond.type}"`);
}

/**
 * Compiles a list of WHERE conditions joined by their boolean connector
 */
function compileWhereClause(wheres, ctx) {
  if (!wheres || wheres.length === 0) return '';

  const parts = wheres
    .map((cond, i) => {
      const clause = compileCondition(cond, ctx);
      if (!clause) return '';
      return i === 0 ? clause : `${cond.boolean || 'AND'} ${clause}`;
    })
    .filter(Boolean);

  return parts.length > 0 ? `WHERE ${parts.join(' ')}` : '';
}

/**
 * Compiles a SELECT query AST
 */
function compileSelect(ast, ctx) {
  if (!ast.table) {
    throw new Error('SELECT query must specify a target table using from()');
  }

  const distinct = ast.distinct ? 'DISTINCT ' : '';
  const columns = ast.columns && ast.columns.length > 0
    ? ast.columns.map(formatColumn).join(', ')
    : '*';

  let sql = `SELECT ${distinct}${columns} FROM ${formatTable(ast.table)}`;

  // Joins
  if (ast.joins && ast.joins.length > 0) {
    for (const j of ast.joins) {
      const joinType = (j.type || 'INNER').toUpperCase();
      if (!['INNER', 'LEFT', 'RIGHT', 'FULL'].includes(joinType)) {
        throw new Error(`Invalid JOIN type: "${joinType}"`);
      }
      const table = formatTable(j.table);
      const onClause = compileCondition(j.on, ctx);
      sql += ` ${joinType} JOIN ${table} ON ${onClause}`;
    }
  }

  // WHERE
  const whereSql = compileWhereClause(ast.wheres, ctx);
  if (whereSql) {
    sql += ` ${whereSql}`;
  }

  // GROUP BY
  if (ast.groups && ast.groups.length > 0) {
    const groupCols = ast.groups.map(formatColumn).join(', ');
    sql += ` GROUP BY ${groupCols}`;
  }

  // HAVING
  if (ast.havings && ast.havings.length > 0) {
    const havingParts = ast.havings.map((h, i) => {
      const compiled = compileCondition(h, ctx);
      return i === 0 ? compiled : `${h.boolean || 'AND'} ${compiled}`;
    });
    sql += ` HAVING ${havingParts.join(' ')}`;
  }

  // ORDER BY
  if (ast.orders && ast.orders.length > 0) {
    const orderParts = ast.orders.map(o => {
      const col = formatColumn(o.column);
      const dir = (o.direction || 'ASC').toUpperCase();
      if (dir !== 'ASC' && dir !== 'DESC') {
        throw new Error(`Invalid sort direction: "${dir}". Must be ASC or DESC`);
      }
      return `${col} ${dir}`;
    });
    sql += ` ORDER BY ${orderParts.join(', ')}`;
  }

  // LIMIT & OFFSET
  if (typeof ast.limit === 'number') {
    if (!Number.isInteger(ast.limit) || ast.limit < 0) {
      throw new Error(`LIMIT must be a non-negative integer, got ${ast.limit}`);
    }
    sql += ` LIMIT ${ast.limit}`;
  }

  if (typeof ast.offset === 'number') {
    if (!Number.isInteger(ast.offset) || ast.offset < 0) {
      throw new Error(`OFFSET must be a non-negative integer, got ${ast.offset}`);
    }
    sql += ` OFFSET ${ast.offset}`;
  }

  // Row locking (e.g. FOR UPDATE)
  if (ast.lock) {
    const lockType = ast.lock.toUpperCase();
    if (!['FOR UPDATE', 'FOR UPDATE SKIP LOCKED', 'FOR SHARE'].includes(lockType)) {
      throw new Error(`Invalid lock type: "${lockType}"`);
    }
    sql += ` ${lockType}`;
  }

  return sql;
}

/**
 * Compiles an INSERT query AST
 */
function compileInsert(ast, ctx) {
  if (!ast.table) throw new Error('INSERT query must specify a target table');
  if (!ast.rows || ast.rows.length === 0) throw new Error('INSERT query requires at least one row of values');

  const table = formatTable(ast.table);

  // Extract keys from first row to establish column order
  const sample = ast.rows[0];
  const keys = Object.keys(sample);
  if (keys.length === 0) throw new Error('Cannot insert empty object');

  // Verify all rows have matching keys and format columns
  const quotedCols = keys.map(k => quoteIdentifier(k.toLowerCase()));

  const valuesRows = ast.rows.map(row => {
    const rowPlaceholders = keys.map(k => {
      const val = row[k] !== undefined ? row[k] : null;
      return ctx.addValue(val);
    });
    return `(${rowPlaceholders.join(', ')})`;
  });

  let sql = `INSERT INTO ${table} (${quotedCols.join(', ')}) VALUES ${valuesRows.join(', ')}`;

  // ON CONFLICT (upsert)
  if (ast.onConflict) {
    const { target, action, updateColumns } = ast.onConflict;
    const targetCols = Array.isArray(target)
      ? `(${target.map(t => quoteIdentifier(t.toLowerCase())).join(', ')})`
      : quoteIdentifier(target.toLowerCase());

    if (action === 'DO NOTHING') {
      sql += ` ON CONFLICT ${targetCols} DO NOTHING`;
    } else if (action === 'DO UPDATE') {
      if (!updateColumns || updateColumns.length === 0) {
        throw new Error('ON CONFLICT DO UPDATE requires updateColumns');
      }
      const sets = updateColumns.map(col => {
        const qCol = quoteIdentifier(col.toLowerCase());
        return `${qCol} = EXCLUDED.${qCol}`;
      });
      sql += ` ON CONFLICT ${targetCols} DO UPDATE SET ${sets.join(', ')}`;
    }
  }

  // RETURNING
  if (ast.returning && ast.returning.length > 0) {
    const retCols = ast.returning.map(formatColumn).join(', ');
    sql += ` RETURNING ${retCols}`;
  }

  return sql;
}

/**
 * Compiles an UPDATE query AST
 */
function compileUpdate(ast, ctx) {
  if (!ast.table) throw new Error('UPDATE query must specify a target table');
  if (!ast.data || Object.keys(ast.data).length === 0) {
    throw new Error('UPDATE query requires a set() object with at least one field');
  }

  // Safety non-negotiable: UPDATE requires a WHERE clause unless explicitly overridden with allowAll()
  if ((!ast.wheres || ast.wheres.length === 0) && !ast.allowAll) {
    throw new Error('Dangerous UPDATE without WHERE clause is prohibited. Use allowAll() if you intentionally want to update all rows.');
  }

  const table = formatTable(ast.table);
  const sets = Object.entries(ast.data).map(([key, val]) => {
    const col = quoteIdentifier(key.toLowerCase());
    const placeholder = ctx.addValue(val);
    return `${col} = ${placeholder}`;
  });

  let sql = `UPDATE ${table} SET ${sets.join(', ')}`;

  const whereSql = compileWhereClause(ast.wheres, ctx);
  if (whereSql) {
    sql += ` ${whereSql}`;
  }

  if (ast.returning && ast.returning.length > 0) {
    const retCols = ast.returning.map(formatColumn).join(', ');
    sql += ` RETURNING ${retCols}`;
  }

  return sql;
}

/**
 * Compiles a DELETE query AST
 */
function compileDelete(ast, ctx) {
  if (!ast.table) throw new Error('DELETE query must specify a target table');

  // Safety non-negotiable: DELETE requires a WHERE clause unless explicitly overridden with allowAll()
  if ((!ast.wheres || ast.wheres.length === 0) && !ast.allowAll) {
    throw new Error('Dangerous DELETE without WHERE clause is prohibited. Use allowAll() if you intentionally want to delete all rows.');
  }

  const table = formatTable(ast.table);
  let sql = `DELETE FROM ${table}`;

  const whereSql = compileWhereClause(ast.wheres, ctx);
  if (whereSql) {
    sql += ` ${whereSql}`;
  }

  if (ast.returning && ast.returning.length > 0) {
    const retCols = ast.returning.map(formatColumn).join(', ');
    sql += ` RETURNING ${retCols}`;
  }

  return sql;
}

/**
 * Main pure compiler entry point: AST -> { text: string, values: any[] }
 * @param {object} ast
 * @returns {{ text: string, values: any[] }}
 */
export function compile(ast) {
  if (!ast || typeof ast !== 'object') {
    throw new Error('Query AST must be a valid object');
  }

  const ctx = new CompileContext();
  let text = '';

  switch (ast.operation) {
    case 'SELECT':
      text = compileSelect(ast, ctx);
      break;
    case 'INSERT':
      text = compileInsert(ast, ctx);
      break;
    case 'UPDATE':
      text = compileUpdate(ast, ctx);
      break;
    case 'DELETE':
      text = compileDelete(ast, ctx);
      break;
    default:
      throw new Error(`Unsupported query operation: "${ast.operation}"`);
  }

  return {
    text: `${text};`,
    values: ctx.values
  };
}
