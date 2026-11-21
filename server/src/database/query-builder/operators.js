/**
 * Allowlisted SQL Operators for SunPower ERP Query Builder
 */

export const ALLOWED_OPERATORS = new Set([
  '=',
  '<>',
  '!=',
  '>',
  '>=',
  '<',
  '<=',
  'LIKE',
  'ILIKE',
  'NOT LIKE',
  'NOT ILIKE',
  'IS',
  'IS NOT',
  'IN',
  'NOT IN',
  'BETWEEN'
]);

/**
 * Validates and normalizes an operator.
 * @param {string} op
 * @returns {string}
 */
export function validateOperator(op) {
  if (typeof op !== 'string') {
    throw new Error(`Operator must be a string, got ${typeof op}`);
  }
  const normalized = op.trim().toUpperCase();
  if (!ALLOWED_OPERATORS.has(normalized)) {
    throw new Error(`Disallowed SQL operator: "${op}". Allowed operators: ${Array.from(ALLOWED_OPERATORS).join(', ')}`);
  }
  return normalized === '!=' ? '<>' : normalized;
}
