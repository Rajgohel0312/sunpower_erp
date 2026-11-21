/**
 * Prisma Client Singleton & Database Helpers for SunPower ERP
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

// Standard database error wrapper preventing secret leaks
export class DatabaseError extends Error {
  constructor(message, code = 'DB_ERROR', details = null) {
    super(message);
    this.name = 'DatabaseError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Maps Prisma and raw errors to safe application domain errors
 */
export function mapDatabaseError(err) {
  if (err instanceof DatabaseError) return err;
  if (err?.name === 'AppError' || err?.statusCode) return err;

  // Prisma Known Request Errors
  if (err?.code === 'P2002') {
    return new DatabaseError(
      'A record with this unique identifier already exists.',
      'UNIQUE_CONSTRAINT_VIOLATION',
      { target: err.meta?.target }
    );
  }

  if (err?.code === 'P2003') {
    return new DatabaseError(
      'Referenced entity was not found.',
      'FOREIGN_KEY_VIOLATION',
      { field: err.meta?.field_name }
    );
  }

  if (err?.code === 'P2025') {
    return new DatabaseError(
      'The requested record was not found.',
      'RECORD_NOT_FOUND',
      { cause: err.meta?.cause }
    );
  }

  return new DatabaseError(err.message || 'Database operation failed.', 'DATABASE_OPERATION_FAILED');
}

// Global singleton instance
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
});

/**
 * Transaction helper executing callback inside a Prisma interactive transaction.
 * @param {Function} callback (tx: PrismaClient) => Promise<T>
 * @returns {Promise<T>}
 */
export async function withTransaction(callback) {
  try {
    return await prisma.$transaction(async (tx) => {
      return await callback(tx);
    });
  } catch (err) {
    throw mapDatabaseError(err);
  }
}

/**
 * Disconnects Prisma client gracefully
 */
export async function closeDatabase() {
  await prisma.$disconnect();
}
