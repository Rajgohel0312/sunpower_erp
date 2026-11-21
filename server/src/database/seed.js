/**
 * Database Seed Script for SunPower ERP
 * Seeds initial administrator account for testing.
 */

import { db } from './index.js';
import { hashPassword } from '../utils/crypto.js';
import { closePool } from './pool.js';

async function seed() {
  console.log('[Seed]: Seeding initial administrator account...');

  try {
    const adminEmail = 'admin@sunpower.com';
    const existing = await db
      .select('id', 'email')
      .from('users')
      .where('email', '=', adminEmail)
      .executeTakeFirst();

    if (existing) {
      console.log(`[Seed]: Admin user already exists with ID: ${existing.id}`);
      return;
    }

    const passwordHash = await hashPassword('SunPower@Admin2026');

    // 1. Create admin user
    const newUser = await db
      .insertInto('users', {
        email: adminEmail,
        phone_e164: '+919999999999',
        full_name: 'SunPower Super Administrator',
        password_hash: passwordHash,
        is_active: true
      })
      .returning('id', 'email')
      .executeTakeFirst();

    // 2. Fetch SUPER_ADMIN role ID
    const superAdminRole = await db
      .select('id')
      .from('roles')
      .where('code', '=', 'SUPER_ADMIN')
      .executeTakeFirst();

    if (superAdminRole) {
      await db.insertInto('user_roles', {
        user_id: newUser.id,
        role_id: superAdminRole.id
      }).execute();
      console.log('[Seed]: Assigned SUPER_ADMIN role to admin user.');
    }

    console.log(`[Seed]: Admin created successfully!`);
    console.log(`------------------------------------------`);
    console.log(`Email:    admin@sunpower.com`);
    console.log(`Password: SunPower@Admin2026`);
    console.log(`------------------------------------------`);
  } catch (err) {
    console.error('[Seed Error]:', err.message);
  } finally {
    await closePool();
  }
}

seed();
