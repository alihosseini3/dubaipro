// Backfill: create an OWNER SupplierMember row for every Supplier that does
// not have one yet, using the legacy `Supplier.userId` owner pointer.
// Idempotent and re-runnable (skipDuplicates + per-run verification query).
// Run with: node --env-file=.env scripts/backfill-supplier-owners.mjs
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function cuidLike() {
  // Prisma-independent id in the same shape as @default(cuid()).
  return (
    'c' +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 12) +
    Math.random().toString(36).slice(2, 8)
  );
}

async function main() {
  const { rows: missing } = await pool.query(`
    SELECT s.id AS supplier_id, s."userId" AS user_id
    FROM "Supplier" s
    LEFT JOIN "SupplierMember" m ON m."supplierId" = s.id AND m."userId" = s."userId"
    WHERE m.id IS NULL
  `);

  console.log(`Suppliers without an OWNER membership: ${missing.length}`);

  let created = 0;
  for (const row of missing) {
    // A user can belong to only one org (unique userId). If the owner user
    // already belongs to a DIFFERENT org, log and skip — needs manual review.
    const { rows: conflict } = await pool.query(
      `SELECT "supplierId" FROM "SupplierMember" WHERE "userId" = $1`,
      [row.user_id]
    );
    if (conflict.length > 0) {
      console.warn(
        `SKIP supplier ${row.supplier_id}: owner user ${row.user_id} already belongs to org ${conflict[0].supplierId}`
      );
      continue;
    }
    await pool.query(
      `INSERT INTO "SupplierMember" (id, "supplierId", "userId", role, "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'OWNER', true, NOW(), NOW())
       ON CONFLICT ("userId") DO NOTHING`,
      [cuidLike(), row.supplier_id, row.user_id]
    );
    created += 1;
  }

  // Verification: every supplier must now have at least one active member.
  const { rows: orphans } = await pool.query(`
    SELECT s.id FROM "Supplier" s
    LEFT JOIN "SupplierMember" m ON m."supplierId" = s.id AND m."isActive" = true
    WHERE m.id IS NULL
  `);

  console.log(`Created: ${created}`);
  if (orphans.length > 0) {
    console.error(
      `VERIFICATION FAILED — suppliers still without an active member: ${orphans
        .map((o) => o.id)
        .join(', ')}`
    );
    process.exit(1);
  }
  console.log('Verification passed: every supplier has an active member.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
