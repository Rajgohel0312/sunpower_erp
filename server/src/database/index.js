/**
 * Database Entry Point for SunPower ERP
 * Powered by Prisma ORM (@prisma/client)
 */

import { prisma, withTransaction, closeDatabase, DatabaseError, mapDatabaseError } from './prisma.js';

export { prisma, withTransaction, closeDatabase, DatabaseError, mapDatabaseError };
export default prisma;
