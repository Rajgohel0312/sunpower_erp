/**
 * Database Seed Script for SunPower ERP
 * Seeds initial administrator account for testing.
 * Powered by Prisma ORM.
 */

import { prisma, closeDatabase } from './index.js';
import { hashPassword } from '../utils/crypto.js';

async function seed() {
  console.log('[Seed]: Seeding initial administrator account...');

  try {
    const adminEmail = 'admin@sunpower.com';
    const existing = await prisma.users.findFirst({
      where: { email: adminEmail }
    });

    if (existing) {
      console.log(`[Seed]: Admin user already exists with ID: ${existing.id}`);
      return;
    }

    const passwordHash = await hashPassword('SunPower@Admin2026');

    // Fetch SUPER_ADMIN role ID
    const superAdminRole = await prisma.roles.findFirst({
      where: { code: 'SUPER_ADMIN' }
    });

    // Create admin user and link role
    const newUser = await prisma.users.create({
      data: {
        email: adminEmail,
        phone_e164: '+919999999999',
        full_name: 'SunPower Super Administrator',
        password_hash: passwordHash,
        is_active: true,
        user_roles: superAdminRole ? {
          create: {
            role_id: superAdminRole.id
          }
        } : undefined
      }
    });

    console.log(`[Seed]: Admin created successfully!`);
    console.log(`------------------------------------------`);
    console.log(`Email:    admin@sunpower.com`);
    console.log(`Password: SunPower@Admin2026`);
    console.log(`------------------------------------------`);
  } catch (err) {
    console.error('[Seed Error]:', err.message);
  } finally {
    await closeDatabase();
  }
}

seed();
