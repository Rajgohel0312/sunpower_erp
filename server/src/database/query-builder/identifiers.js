/**
 * Safe SQL Identifier Parser & Validator for SunPower ERP
 * Enforces PostgreSQL identifier rules and protects against SQL injection.
 */

// Basic identifier: must start with a lowercase letter or underscore, followed by lowercase alphanumeric or underscore.
const IDENTIFIER_REGEX = /^[a-z_][a-z0-9_]*$/;

/**
 * Validates and quotes a single identifier part (e.g., "users" -> '"users"')
 * @param {string} name
 * @returns {string}
 */
export function quoteIdentifier(name) {
  if (typeof name !== 'string' || !IDENTIFIER_REGEX.test(name)) {
    throw new Error(`Invalid SQL identifier: "${name}". Identifiers must match /^[a-z_][a-z0-9_]*$/`);
  }
  return `"${name}"`;
}

/**
 * Parses and quotes a column or table reference which may contain:
 * - Simple identifier: 'email' -> '"email"'
 * - Table qualified: 'users.email' -> '"users"."email"'
 * - Wildcard: '*' -> '*'
 * - Table wildcard: 'users.*' -> '"users".*'
 * - Alias: 'users.email AS user_email' -> '"users"."email" AS "user_email"'
 * - Function wrapper (whitelisted only): 'COUNT(*)' -> 'COUNT(*)'
 *
 * @param {string} expr
 * @returns {string}
 */
export function formatColumn(expr) {
  if (typeof expr !== 'string') {
    throw new Error(`Column expression must be a string, got ${typeof expr}`);
  }

  const trimmed = expr.trim();

  // Wildcard
  if (trimmed === '*') return '*';

  // Table wildcard: 'table.*'
  if (trimmed.endsWith('.*')) {
    const tablePart = trimmed.slice(0, -2);
    return `${quoteIdentifier(tablePart)}.*`;
  }

  // Aggregate functions whitelist: COUNT(*), SUM(col), AVG(col), MIN(col), MAX(col)
  const aggMatch = trimmed.match(/^(COUNT|SUM|AVG|MIN|MAX)\((.+)\)(?:\s+AS\s+([a-z_][a-z0-9_]*))?$/i);
  if (aggMatch) {
    const [, func, arg, alias] = aggMatch;
    const cleanArg = arg.trim() === '*' ? '*' : formatColumn(arg.trim());
    const funcPart = `${func.toUpperCase()}(${cleanArg})`;
    return alias ? `${funcPart} AS ${quoteIdentifier(alias.toLowerCase())}` : funcPart;
  }

  // Check for 'AS alias'
  const asMatch = trimmed.match(/^(.+?)\s+AS\s+([a-z_][a-z0-9_]*)$/i);
  if (asMatch) {
    const [, target, alias] = asMatch;
    return `${formatColumn(target.trim())} AS ${quoteIdentifier(alias.toLowerCase())}`;
  }

  // Qualified identifier: 'table.column'
  if (trimmed.includes('.')) {
    const parts = trimmed.split('.');
    if (parts.length !== 2) {
      throw new Error(`Invalid qualified column reference: "${expr}"`);
    }
    return `${quoteIdentifier(parts[0])}.${quoteIdentifier(parts[1])}`;
  }

  // Simple identifier
  return quoteIdentifier(trimmed);
}

/**
 * Formats a table reference, supporting optional alias:
 * 'customers' -> '"customers"'
 * 'customers AS c' -> '"customers" AS "c"'
 *
 * @param {string} tableExpr
 * @returns {string}
 */
export function formatTable(tableExpr) {
  if (typeof tableExpr !== 'string') {
    throw new Error(`Table expression must be a string, got ${typeof tableExpr}`);
  }

  const trimmed = tableExpr.trim();
  const asMatch = trimmed.match(/^([a-z_][a-z0-9_]*)\s+(?:AS\s+)?([a-z_][a-z0-9_]*)$/i);
  if (asMatch) {
    const [, table, alias] = asMatch;
    return `${quoteIdentifier(table.toLowerCase())} AS ${quoteIdentifier(alias.toLowerCase())}`;
  }

  return quoteIdentifier(trimmed.toLowerCase());
}
