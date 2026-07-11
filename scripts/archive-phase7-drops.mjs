// Pre-drop archive for the Phase-7 cleanup: B2BInquiry tables, the legacy
// Product.tierPricing Json values, and Conversation.customerId/sellerId.
// Run with: node --env-file=.env scripts/archive-phase7-drops.mjs
import { Pool } from 'pg';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const archive = { archivedAt: new Date().toISOString(), tables: {} };

  archive.tables.B2BInquiry = (await pool.query('SELECT * FROM "B2BInquiry"')).rows;
  archive.tables.B2BInquiryReply = (
    await pool.query('SELECT * FROM "B2BInquiryReply"')
  ).rows;
  archive.tables.Product_tierPricing = (
    await pool.query(
      'SELECT id, "tierPricing" FROM "Product" WHERE "tierPricing" IS NOT NULL'
    )
  ).rows;
  archive.tables.Conversation_legacyCols = (
    await pool.query(
      'SELECT id, "customerId", "sellerId" FROM "Conversation" WHERE "customerId" IS NOT NULL OR "sellerId" IS NOT NULL'
    )
  ).rows;

  const dir = path.join(process.cwd(), 'backups');
  mkdirSync(dir, { recursive: true });
  const file = path.join(
    dir,
    `phase7-drops-${new Date().toISOString().slice(0, 10)}.json`
  );
  writeFileSync(file, JSON.stringify(archive, null, 2));
  for (const [name, rows] of Object.entries(archive.tables)) {
    console.log(`${name}: ${rows.length} rows archived`);
  }
  console.log(`Archive written to ${file}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
