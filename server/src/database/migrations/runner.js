/**
 * Forward-Only SQL Migration Runner for SunPower ERP
 * Reads numbered SQL files, tracks applied migrations with SHA-256 checksums in a transaction.
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { pool } from '../pool.js';

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, '../../../migrations');

/**
 * Computes SHA-256 checksum of SQL file content
 * @param {string} content
 * @returns {string}
 */
function computeChecksum(content) {
  return crypto.createHash('sha256').update(content.trim(), 'utf8').digest('hex');
}

/**
 * Ensures the schema_migrations tracking table exists.
 * @param {object} client
 */
async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      version VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      checksum VARCHAR(64) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

/**
 * Runs all pending migrations
 * @returns {Promise<{ applied: string[], total: number }>}
 */
export async function runMigrations() {
  const client = await pool.connect();
  const applied = [];

  try {
    await client.query('BEGIN');
    await ensureMigrationsTable(client);

    // Fetch already applied migrations
    const res = await client.query('SELECT version, checksum FROM schema_migrations ORDER BY version ASC');
    const appliedMap = new Map(res.rows.map(r => [r.version, r.checksum]));

    // Read migration files in directory
    await fs.mkdir(MIGRATIONS_DIR, { recursive: true });
    const allFiles = await fs.readdir(MIGRATIONS_DIR);
    const sqlFiles = allFiles.filter(f => f.endsWith('.sql')).sort();

    for (const file of sqlFiles) {
      const match = file.match(/^(\d+)_(.+)\.sql$/);
      if (!match) {
        console.warn(`[Migrations]: Skipping non-standard filename: ${file}`);
        continue;
      }

      const [ , version, name ] = match;
      const fullPath = path.join(MIGRATIONS_DIR, file);
      const sqlContent = await fs.readFile(fullPath, 'utf8');
      const currentChecksum = computeChecksum(sqlContent);

      if (appliedMap.has(version)) {
        // Integrity check: verify checksum hasn't been altered after application
        const storedChecksum = appliedMap.get(version);
        if (storedChecksum !== currentChecksum) {
          throw new Error(
            `Migration integrity error: Migration ${file} (v${version}) has been modified after being applied!\nStored: ${storedChecksum}\nPresent: ${currentChecksum}`
          );
        }
        continue;
      }

      // Execute pending migration
      console.log(`[Migrations]: Applying migration ${file}...`);
      await client.query(sqlContent);

      // Record in schema_migrations
      await client.query(
        'INSERT INTO schema_migrations (version, name, checksum) VALUES ($1, $2, $3)',
        [version, name, currentChecksum]
      );

      applied.push(file);
    }

    await client.query('COMMIT');
    console.log(`[Migrations]: Complete. ${applied.length} migration(s) applied successfully.`);
    return { applied, total: sqlFiles.length };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`[Migrations]: Failed to apply migrations. Rolled back. Reason:`, err.message);
    throw err;
  } finally {
    client.release();
  }
}
