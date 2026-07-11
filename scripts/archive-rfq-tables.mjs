// One-off archive of orphaned RFQ data before the drop_orphaned_rfq_tables migration.
// Writes a full JSON snapshot of every Rfq* table plus the rows that reference
// removed enum values, so the drop migration is recoverable.
import { Pool } from 'pg';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const RFQ_TABLES = [
  'RFQ',
  'RfqAttachment',
  'RfqAuditLog',
  'RfqEventOutbox',
  'RfqMessage',
  'RfqQuote',
  'RfqRequest',
  'RfqSupplierInvite',
];

async function main() {
  const archive = { archivedAt: new Date().toISOString(), tables: {} };

  for (const table of RFQ_TABLES) {
    const { rows } = await pool.query(`SELECT * FROM "${table}"`);
    archive.tables[table] = rows;
  }

  archive.tables.AutomationLog_rfqRows = (
    await pool.query(
      `SELECT * FROM "AutomationLog" WHERE "eventType"::text LIKE 'RFQ%'`
    )
  ).rows;
  archive.tables.AutomationRule_rfqRows = (
    await pool.query(
      `SELECT * FROM "AutomationRule" WHERE "eventType"::text LIKE 'RFQ%'`
    )
  ).rows;
  archive.tables.HomepageSection_rfqRows = (
    await pool.query(`SELECT * FROM "HomepageSection" WHERE "type"::text = 'RFQ'`)
  ).rows;

  const dir = path.join(process.cwd(), 'backups');
  mkdirSync(dir, { recursive: true });
  const file = path.join(
    dir,
    `rfq-archive-${new Date().toISOString().slice(0, 10)}.json`
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
