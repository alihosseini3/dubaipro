import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { randomBytes, scrypt as scryptCb } from 'node:crypto';
import { promisify } from 'node:util';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const scrypt = promisify(scryptCb);

/**
 * Inline copy of lib/auth/password.ts so this seed script stays
 * runnable with plain Node (no TS / path aliases). Format identical to
 * what verifyPassword expects: `scrypt$<version>$<saltHex>$<hashHex>`.
 */
async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `scrypt$1$${salt.toString('hex')}$${derived.toString('hex')}`;
}

async function main() {
  console.log('Seeding database...');

  // Default admin credentials — the single canonical login for bootstrapped
  // environments. Idempotent: re-running the seed refreshes the password
  // hash and role but never changes the primary key / email.
  const ADMIN_EMAIL = 'admin@dubaipro.com';
  const ADMIN_PASSWORD = 'Admin123!';
  const DEMO_PASSWORD = 'ChangeMe123!';

  const adminHash = await hashPassword(ADMIN_PASSWORD);
  const demoHash = await hashPassword(DEMO_PASSWORD);

  // Canonical admin account.
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { password: adminHash, role: 'ADMIN' },
    create: {
      name: 'Admin',
      email: ADMIN_EMAIL,
      password: adminHash,
      role: 'ADMIN'
    }
  });

  // Demo seller — independent buyer persona, no supplier profile required.
  const sellerUser = await prisma.user.upsert({
    where: { email: 'seller@dubaipro.test' },
    update: { password: demoHash, role: 'SELLER' },
    create: {
      name: 'Demo Seller',
      email: 'seller@dubaipro.test',
      password: demoHash,
      role: 'SELLER'
    }
  });

  // Demo supplier user + supplier profile
  const supplierUser = await prisma.user.upsert({
    where: { email: 'supplier@dubaipro.test' },
    update: { password: demoHash },
    create: {
      name: 'Demo Supplier',
      email: 'supplier@dubaipro.test',
      password: demoHash,
      role: 'SUPPLIER'
    }
  });

  const supplier = await prisma.supplier.upsert({
    where: { userId: supplierUser.id },
    update: {},
    create: {
      userId: supplierUser.id,
      name: 'Dubai Trading LLC',
      country: 'AE',
      verified: true
    }
  });

  // OWNER team membership — access to /supplier resolves through this row.
  await prisma.supplierMember.upsert({
    where: { userId: supplierUser.id },
    update: {},
    create: {
      supplierId: supplier.id,
      userId: supplierUser.id,
      role: 'OWNER'
    }
  });

  // Categories
  const categoriesData = [
    { name: 'Electronics', slug: 'electronics' },
    { name: 'Home & Kitchen', slug: 'home-kitchen' },
    { name: 'Industrial', slug: 'industrial' }
  ];

  const categories = [];
  for (const c of categoriesData) {
    const cat = await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: c
    });
    categories.push(cat);
  }

  // Brand
  const brand = await prisma.brand.upsert({
    where: { slug: 'generic' },
    update: {},
    create: { name: 'Generic', slug: 'generic' }
  });

  console.log('\nSeed complete. Use these IDs for testing:');
  console.log('-------------------------------------------');
  console.log('adminId       :', admin.id);
  console.log('sellerUserId  :', sellerUser.id);
  console.log('supplierUserId:', supplierUser.id);
  console.log('supplierId    :', supplier.id);
  console.log('brandId       :', brand.id);
  for (const c of categories) {
    console.log(`category[${c.slug.padEnd(12)}]:`, c.id);
  }
  console.log('-------------------------------------------');
  console.log('\nDemo credentials:');
  console.log(`  Admin    : ${ADMIN_EMAIL}    / ${ADMIN_PASSWORD}`);
  console.log(`  Seller   : seller@dubaipro.test   / ${DEMO_PASSWORD}`);
  console.log(`  Supplier : supplier@dubaipro.test / ${DEMO_PASSWORD}`);
  console.log('-------------------------------------------');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
