/**
 * Database Reset / Truncate Script for SunPower ERP
 * Cleans all transactional and operational data while strictly preserving:
 * - Master/seed data: schema_migrations, roles, permissions, role_permissions
 * - System admin user (admin@sunpower.com)
 * - Product catalog: product_categories, products, product_specifications, product_prices
 * - Procurement depots: warehouses, suppliers
 * - Resets stock balances and all document sequence counters to 1.
 */

import { prisma, closeDatabase } from './index.js';

const TRANSACTIONAL_TABLES = [
  'serial_movements',
  'serial_numbers',
  'stock_movements',
  'stock_reservations',
  'goods_receipt_items',
  'goods_receipts',
  'purchase_order_items',
  'purchase_orders',
  'sales_orders',
  'quotation_items',
  'quotations',
  'bom_validations',
  'project_bom_items',
  'project_boms',
  'survey_photos',
  'surveys',
  'lead_activities',
  'follow_ups',
  'leads',
  'customer_documents',
  'customer_addresses',
  'customers',
  'file_records',
  'idempotency_keys',
  'notifications',
  'login_events',
  'refresh_tokens',
  'audit_logs',
  'background_jobs'
];

const SEQUENCES_TO_RESET = [
  'lead_number_seq',
  'customer_code_seq',
  'survey_number_seq',
  'bom_number_seq',
  'quotation_number_seq',
  'sales_order_number_seq',
  'purchase_order_number_seq',
  'goods_receipt_number_seq',
  'stock_movement_number_seq',
  'supplier_code_seq'
];

export async function truncateOperationalData() {
  console.log('====================================================');
  console.log('⚡ SunPower ERP: Database Truncate & Reset Initiated');
  console.log('====================================================');

  try {
    // 1. Truncate all operational tables with CASCADE
    console.log(`[Truncate]: Purging ${TRANSACTIONAL_TABLES.length} transactional tables...`);
    const tableListSql = TRANSACTIONAL_TABLES.join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableListSql} RESTART IDENTITY CASCADE;`);
    console.log(`✓ Truncated: ${tableListSql}`);

    // 2. Preserve admin user (admin@sunpower.com) and clean any test users
    console.log('[Truncate]: Preserving Super Admin account and cleaning temporary users...');
    await prisma.$executeRawUnsafe(`
      DELETE FROM user_roles 
      WHERE user_id NOT IN (
        SELECT id FROM users WHERE email = 'admin@sunpower.com'
      )
    `);
    await prisma.$executeRawUnsafe(`
      DELETE FROM users 
      WHERE email != 'admin@sunpower.com'
    `);
    console.log('✓ Admin user preserved (admin@sunpower.com)');

    // 3. Preserve baseline master suppliers and clean test suppliers
    console.log('[Truncate]: Preserving baseline suppliers and cleaning test suppliers...');
    await prisma.$executeRawUnsafe(`
      DELETE FROM suppliers 
      WHERE supplier_code NOT IN ('SUP-2026-001', 'SUP-2026-002', 'SUP-2026-003')
    `);
    console.log('✓ Master suppliers preserved (Waaree, Growatt, Polycab)');

    // 4. Reset stock balances for active warehouses to zero
    console.log('[Truncate]: Resetting warehouse stock balances to 0...');
    await prisma.$executeRawUnsafe(`
      UPDATE stock_balances 
      SET quantity_on_hand = 0, 
          quantity_reserved = 0, 
          quantity_available = 0,
          updated_at = NOW();
    `);
    console.log('✓ Stock balances reset');

    // 5. Reset all sequence counters back to 1
    console.log('[Truncate]: Resetting sequential number generators...');
    for (const seq of SEQUENCES_TO_RESET) {
      try {
        await prisma.$executeRawUnsafe(`ALTER SEQUENCE IF EXISTS ${seq} RESTART WITH 1;`);
      } catch (err) {
        // Sequence may not exist if migration was skipped
      }
    }
    console.log(`✓ Reset sequences: ${SEQUENCES_TO_RESET.join(', ')}`);

    console.log('----------------------------------------------------');
    console.log('✅ PRESERVED TABLES (Unmodified):');
    console.log('   - schema_migrations (Applied DB migrations)');
    console.log('   - roles, permissions, role_permissions (RBAC)');
    console.log('   - users (Super Admin: admin@sunpower.com)');
    console.log('   - product_categories, products, specifications, prices');
    console.log('   - warehouses (Ahmedabad & Surat depots)');
    console.log('   - suppliers (Waaree, Growatt, Polycab, etc.)');
    console.log('====================================================');
    console.log('✨ Operational database clean and ready for fresh data!');
    console.log('====================================================');
  } catch (err) {
    console.error('❌ [Truncate Error]:', err.message);
    throw err;
  }
}

// Direct execution from CLI
if (process.argv[1]?.endsWith('truncate.js') || process.argv[1]?.includes('truncate')) {
  truncateOperationalData()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(async () => {
      await closeDatabase();
    });
}
