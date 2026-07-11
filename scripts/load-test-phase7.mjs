// Phase-7 load probe: seeds a large product catalog under a throwaway
// supplier, measures the title-substring search plan (pg_trgm GIN vs seq
// scan) and browse-query latency, then cleans up after itself.
//
//   node --env-file=.env scripts/load-test-phase7.mjs [count]
//
// Default 100k products. All rows belong to supplier "Load Test Supplier"
// and are deleted at the end (pass KEEP=1 to keep them).
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const COUNT = Number(process.argv[2] ?? 100_000);
const BATCH = 5_000;

const ADJECTIVES = ['Industrial', 'Premium', 'Heavy', 'Compact', 'Smart', 'Eco', 'Ultra', 'Pro', 'Flex', 'Prime'];
const NOUNS = ['Valve', 'Pump', 'Cable', 'Bearing', 'Sensor', 'Panel', 'Motor', 'Filter', 'Gasket', 'Compressor'];

function title(i) {
  return `${ADJECTIVES[i % 10]} ${NOUNS[Math.floor(i / 10) % 10]} Model ${i}`;
}

async function timed(label, fn) {
  const start = process.hrtime.bigint();
  const result = await fn();
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  console.log(`${label}: ${ms.toFixed(1)} ms`);
  return result;
}

async function main() {
  // 1) Fixture supplier + category
  const { rows: catRows } = await pool.query('SELECT id FROM "Category" LIMIT 1');
  const categoryId = catRows[0].id;
  const { rows: userRows } = await pool.query(
    `INSERT INTO "User" (id, name, email, password, role, "accountType", "createdAt")
     VALUES ('loadtest-user', 'Load Test', 'loadtest@dubaipro.test', 'x', 'SUPPLIER', 'SUPPLIER', NOW())
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name RETURNING id`
  );
  const { rows: supRows } = await pool.query(
    `INSERT INTO "Supplier" (id, "userId", name, country, slug, "updatedAt")
     VALUES ('loadtest-supplier', $1, 'Load Test Supplier', 'AE', 'load-test-supplier', NOW())
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
    [userRows[0].id]
  );
  const supplierId = supRows[0].id;

  // 2) Bulk seed (multi-row VALUES, APPROVED+published so search paths hit them)
  console.log(`seeding ${COUNT} products…`);
  const seedStart = Date.now();
  for (let offset = 0; offset < COUNT; offset += BATCH) {
    const n = Math.min(BATCH, COUNT - offset);
    const values = [];
    const params = [];
    for (let i = 0; i < n; i++) {
      const idx = offset + i;
      const base = params.length;
      values.push(
        `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, 9.99, 'USD', 'APPROVED', true, true, NOW(), NOW())`
      );
      params.push(
        `loadtest-p${idx}`,
        supplierId,
        categoryId,
        title(idx),
        `loadtest-product-${idx}`
      );
    }
    await pool.query(
      `INSERT INTO "Product"
         (id, "supplierId", "categoryId", title, slug, price, currency, status, "isPublished", "isB2B", description, "createdAt", "updatedAt")
       SELECT v.id, v."supplierId", v."categoryId", v.title, v.slug, v.price, v.currency, v.status::"ProductStatus", v."isPublished", v."isB2B", 'load test row', v."createdAt", v."updatedAt"
       FROM (VALUES ${values.join(',')}) AS v(id, "supplierId", "categoryId", title, slug, price, currency, status, "isPublished", "isB2B", "createdAt", "updatedAt")
       ON CONFLICT (id) DO NOTHING`,
      params
    );
    if ((offset / BATCH) % 4 === 3) process.stdout.write(`  ${offset + n}/${COUNT}\r\n`);
  }
  console.log(`seeded in ${((Date.now() - seedStart) / 1000).toFixed(1)}s`);
  await pool.query('ANALYZE "Product"');

  // 3) Measurements
  const { rows: cnt } = await pool.query('SELECT COUNT(*)::int n FROM "Product"');
  console.log(`total products in table: ${cnt[0].n}`);

  await timed('substring search (ILIKE %Sensor Model 4%), APPROVED only', () =>
    pool.query(
      `SELECT id, title FROM "Product"
       WHERE status = 'APPROVED' AND "isPublished" = true AND title ILIKE '%Sensor Model 4%'
       ORDER BY "createdAt" DESC LIMIT 20`
    )
  );

  const { rows: plan } = await pool.query(
    `EXPLAIN (FORMAT TEXT) SELECT id FROM "Product" WHERE title ILIKE '%Sensor Model 4%' LIMIT 20`
  );
  const planText = plan.map((r) => r['QUERY PLAN']).join('\n');
  console.log(
    planText.includes('trgm') || planText.includes('Bitmap')
      ? 'plan: USES trgm/bitmap index ✔'
      : `plan: SEQ SCAN ✖\n${planText}`
  );

  await timed('browse page (status filter + createdAt keyset, 24 rows)', () =>
    pool.query(
      `SELECT id, title, price FROM "Product"
       WHERE status = 'APPROVED' AND "isPublished" = true
       ORDER BY "createdAt" DESC, id DESC LIMIT 24`
    )
  );

  await timed('supplier dashboard groupBy(status)', () =>
    pool.query(
      `SELECT status, COUNT(*) FROM "Product" WHERE "supplierId" = $1 GROUP BY status`,
      [supplierId]
    )
  );

  // 4) Cleanup
  if (process.env.KEEP !== '1') {
    const del = await timed('cleanup (delete seeded rows)', () =>
      pool.query(`DELETE FROM "Product" WHERE id LIKE 'loadtest-p%'`)
    );
    console.log(`deleted ${del.rowCount} rows`);
    await pool.query(`DELETE FROM "Supplier" WHERE id = 'loadtest-supplier'`);
    await pool.query(`DELETE FROM "User" WHERE id = 'loadtest-user'`);
  }
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
