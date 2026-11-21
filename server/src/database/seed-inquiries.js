/**
 * High-Performance Inquiries / Leads Seeder for SunPower ERP
 * Generates 5,000 to 10,000 realistic solar inquiries using @faker-js/faker.
 *
 * Features:
 * - Authentic Indian names, phone numbers (+91), Gujarat cities & pin codes.
 * - Realistic solar EPC metrics: monthly bills, sizing (kW), system types, and sources.
 * - Distributed stages: NEW, CONTACTED, QUALIFIED, SURVEY_SCHEDULED, LOST.
 * - Fast batch insertion via Prisma createMany (inserts 10k rows in ~3-4 seconds).
 * - Synchronizes PostgreSQL sequence 'lead_number_seq' so new manual inquiries continue smoothly.
 *
 * Usage:
 *   node src/database/seed-inquiries.js [count]
 *   e.g. node src/database/seed-inquiries.js 5000
 *   e.g. node src/database/seed-inquiries.js 10000
 */

import { fakerEN_IN, faker } from '@faker-js/faker';
import { prisma, closeDatabase } from './index.js';

// Top Gujarat Solar EPC Cities & Neighborhoods
const GUJARAT_CITIES = [
  { city: 'Ahmedabad', areas: ['Satellite', 'Bopal', 'Vastrapur', 'Maninagar', 'Gota', 'Chandkheda', 'Bodakdev', 'Thaltej', 'Prahlad Nagar', 'Naroda', 'Nikol', 'South Bopal', 'Ghatlodia'], pinPrefix: '380' },
  { city: 'Surat', areas: ['Adajan', 'Vesu', 'Piplod', 'Varachha', 'Katargam', 'Pal', 'Althan', 'City Light', 'Rander', 'Dindoli', 'Mota Varachha'], pinPrefix: '395' },
  { city: 'Vadodara', areas: ['Alkapuri', 'Gotri', 'Manjalpur', 'Akota', 'Karelibaug', 'Vasna Road', 'Waghodia Road', 'Subhanpura', 'Fatehgunj', 'Harni'], pinPrefix: '390' },
  { city: 'Rajkot', areas: ['Kalawad Road', 'University Road', '150 Feet Ring Road', 'Mavdi', 'Yagnik Road', 'Kothariya', 'Madhapar', 'Nana Mava'], pinPrefix: '360' },
  { city: 'Gandhinagar', areas: ['Sector 1', 'Sector 7', 'Sector 16', 'Sector 21', 'Kudasan', 'Raysan', 'Sargasan', 'Infocity', 'Bhaijipura'], pinPrefix: '382' },
  { city: 'Bhavnagar', areas: ['Waghawadi Road', 'Kalanala', 'Ghogha Road', 'Chitra', 'Vidhyanagar', 'Kaliabid'], pinPrefix: '364' },
  { city: 'Jamnagar', areas: ['Patel Colony', 'Digvijay Plot', 'Shankar Tekri', 'Valkeshwari', 'Khodiyar Colony'], pinPrefix: '361' },
  { city: 'Anand', areas: ['Vidyanagar Road', 'Ganesh Chokdi', 'Bakrol', 'Mogra', 'Jitodia'], pinPrefix: '388' },
  { city: 'Bharuch', areas: ['Zadeshwar Road', 'Link Road', 'Bholav', 'GNFC Township', 'Shravan Chokdi'], pinPrefix: '392' },
  { city: 'Navsari', areas: ['Lunsikui', 'Chhapra Road', 'Station Road', 'Vijalpor'], pinPrefix: '396' },
  { city: 'Morbi', areas: ['Ravapar Road', 'Sanala Road', 'Shakti Plot', 'Trajpar'], pinPrefix: '363' }
];

const SOURCES = ['WEBSITE', 'WHATSAPP', 'PHONE', 'WALK_IN', 'REFERRAL', 'MANUAL'];
const SYSTEM_TYPES = ['ON_GRID', 'ON_GRID', 'ON_GRID', 'ON_GRID', 'HYBRID', 'OFF_GRID'];

const STAGE_DISTRIBUTION = [
  ...Array(40).fill('NEW'),
  ...Array(25).fill('CONTACTED'),
  ...Array(18).fill('QUALIFIED'),
  ...Array(12).fill('SURVEY_SCHEDULED'),
  ...Array(5).fill('LOST')
];

const LOST_REASONS = [
  'Customer opted to postpone installation to next financial year',
  'Severe shading from adjacent high-rise building',
  'Tenant occupied property; landlord refused NOC for rooftop installation',
  'Budget constraints; opting for local non-DCR panels without subsidy',
  'Awaiting sanctioned electrical load upgrade from DISCOM',
  'Customer selected competitor offering lower quotation'
];

const SOLAR_NOTES = [
  'Customer applied under PM Surya Ghar Muft Bijli Yojana for rooftop subsidy.',
  'Prefers Tier-1 Monocrystalline half-cut PV modules with 5kW Deye hybrid inverter.',
  'Three phase electricity connection already available with UGVCL/MGVCL.',
  'Interested in 0% interest EMI options with nationalized banks.',
  'Approx 900 sq ft RCC flat rooftop with zero south-facing shading.',
  'Commercial net metering inquiry for factory shed; looking for 20kW+ system.',
  'Referred by neighboring customer with existing SunPower 5kW installation.',
  'High power consumption due to multiple split ACs and heat pump water heater.',
  'Requires quick installation turnaround before upcoming DISCOM billing cycle.'
];

export async function seedInquiries(targetCount = 5000) {
  const count = Math.max(1, parseInt(targetCount, 10) || 5000);
  const CHUNK_SIZE = 1000;
  const startTime = Date.now();

  console.log('====================================================');
  console.log(`⚡ SunPower ERP: Seeding ${count.toLocaleString('en-IN')} Solar Inquiries`);
  console.log('====================================================');

  try {
    // 1. Fetch available engineers or admin for assignment
    const users = await prisma.users.findMany({
      select: { id: true, full_name: true },
      take: 10
    });
    const engineerIds = users.map((u) => u.id);

    // 2. Fetch current sequence value for lead_number_seq
    const seqRow = await prisma.$queryRaw`SELECT nextval('lead_number_seq') AS seq`;
    let currentSeq = parseInt(seqRow[0]?.seq || 1, 10);
    const year = new Date().getFullYear();

    console.log(`[Seed Inquiries]: Starting lead sequence from: ${currentSeq}`);

    let insertedCount = 0;
    const now = new Date();
    const phoneTracker = new Set();

    while (insertedCount < count) {
      const remaining = count - insertedCount;
      const batchSize = Math.min(remaining, CHUNK_SIZE);
      const batch = [];

      for (let i = 0; i < batchSize; i++) {
        const seqVal = currentSeq++;
        const leadNumber = `LEAD-${year}-${String(seqVal).padStart(5, '0')}`;

        // Select city & locality
        const cityData = GUJARAT_CITIES[Math.floor(Math.random() * GUJARAT_CITIES.length)];
        const area = cityData.areas[Math.floor(Math.random() * cityData.areas.length)];
        const pincode = `${cityData.pinPrefix}${String(Math.floor(Math.random() * 900) + 100).padStart(3, '0')}`;

        // Realistic Indian Person
        const firstName = fakerEN_IN.person.firstName();
        const lastName = fakerEN_IN.person.lastName();
        const fullName = `${firstName} ${lastName}`;

        // Unique E.164 phone number
        let phone;
        let attempts = 0;
        do {
          const prefix = ['98', '97', '99', '94', '93', '88', '87', '79'][Math.floor(Math.random() * 8)];
          const suffix = String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
          phone = `+91${prefix}${suffix}`;
          attempts++;
        } while (phoneTracker.has(phone) && attempts < 10);
        phoneTracker.add(phone);

        // Clean email
        const cleanName = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`.replace(/[^a-z.]/g, '');
        const email = `${cleanName}${Math.floor(Math.random() * 900) + 100}@gmail.com`;

        // Monthly bill & calculated solar capacity
        const isCommercial = Math.random() < 0.12;
        const monthlyBill = isCommercial
          ? Math.floor(Math.random() * 45000) + 15000 // ₹15k - ₹60k
          : Math.floor(Math.random() * 9500) + 1800;  // ₹1.8k - ₹11.3k

        let capacityKw;
        if (monthlyBill < 3500) {
          capacityKw = [2.0, 3.0, 3.3][Math.floor(Math.random() * 3)];
        } else if (monthlyBill < 7500) {
          capacityKw = [3.3, 4.0, 5.0, 6.0][Math.floor(Math.random() * 4)];
        } else if (monthlyBill < 15000) {
          capacityKw = [6.0, 7.5, 8.0, 10.0][Math.floor(Math.random() * 4)];
        } else {
          capacityKw = [10.0, 12.0, 15.0, 20.0, 25.0][Math.floor(Math.random() * 5)];
        }

        const stage = STAGE_DISTRIBUTION[Math.floor(Math.random() * STAGE_DISTRIBUTION.length)];
        const systemType = SYSTEM_TYPES[Math.floor(Math.random() * SYSTEM_TYPES.length)];
        const source = SOURCES[Math.floor(Math.random() * SOURCES.length)];

        // Random creation date in the last 180 days
        const daysAgo = Math.floor(Math.random() * 180);
        const createdAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000 - Math.floor(Math.random() * 86400000));

        // Lost reason
        const lostReason = stage === 'LOST' 
          ? LOST_REASONS[Math.floor(Math.random() * LOST_REASONS.length)]
          : null;

        // Notes
        const notes = SOLAR_NOTES[Math.floor(Math.random() * SOLAR_NOTES.length)];

        // Assigned user (optional)
        const assignedTo = (stage !== 'NEW' && engineerIds.length > 0)
          ? engineerIds[Math.floor(Math.random() * engineerIds.length)]
          : null;

        const streetNum = Math.floor(Math.random() * 120) + 1;
        const societyType = ['Residency', 'Society', 'Heights', 'Bungalows', 'Enclave', 'Apartments', 'Park'][Math.floor(Math.random() * 7)];
        const siteAddress = `${streetNum}, ${fakerEN_IN.person.lastName()} ${societyType}, Near ${area} Cross Roads`;

        batch.push({
          lead_number: leadNumber,
          source,
          stage,
          full_name: fullName,
          phone_e164: phone,
          email,
          site_address: siteAddress,
          city: cityData.city,
          state: 'Gujarat',
          pincode,
          monthly_electricity_bill: monthlyBill.toFixed(2),
          requested_capacity_kw: capacityKw.toFixed(2),
          system_type: systemType,
          lost_reason: lostReason,
          notes,
          assigned_to: assignedTo,
          created_at: createdAt,
          updated_at: createdAt
        });
      }

      // Fast Batch Insert
      await prisma.leads.createMany({
        data: batch,
        skipDuplicates: true
      });

      insertedCount += batch.length;
      const pct = ((insertedCount / count) * 100).toFixed(0);
      console.log(`[Seed Inquiries]: Inserted ${insertedCount.toLocaleString('en-IN')} / ${count.toLocaleString('en-IN')} (${pct}%)`);
    }

    // 3. Update sequence in DB to the highest sequence number used
    await prisma.$executeRawUnsafe(`SELECT setval('lead_number_seq', ${currentSeq});`);
    console.log(`[Seed Inquiries]: Synchronized 'lead_number_seq' to: ${currentSeq}`);

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('====================================================');
    console.log(`✨ Successfully generated and seeded ${insertedCount.toLocaleString('en-IN')} solar inquiries in ${durationSec}s!`);
    console.log('====================================================');
  } catch (err) {
    console.error('❌ [Seed Inquiries Error]:', err.message);
    throw err;
  }
}

// Direct CLI Execution
if (process.argv[1]?.endsWith('seed-inquiries.js') || process.argv[1]?.includes('seed-inquiries')) {
  const cliCount = process.argv[2] ? parseInt(process.argv[2], 10) : 5000;
  seedInquiries(cliCount)
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(async () => {
      await closeDatabase();
    });
}
