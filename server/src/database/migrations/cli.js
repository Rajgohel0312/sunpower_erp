/**
 * CLI Runner for Database Migrations
 */

import { runMigrations } from './runner.js';
import { closePool } from '../pool.js';

async function main() {
  try {
    const result = await runMigrations();
    console.log(`Migrations finished. Applied: ${result.applied.length} / Total: ${result.total}`);
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await closePool();
  }
}

main();
