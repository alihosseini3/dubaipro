// Seed the three launch plans and auto-subscribe every supplier without an
// active subscription to FREE. Idempotent and re-runnable.
// Run with: node --env-file=.env scripts/seed-subscription-plans.mjs
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function cuidLike() {
  return (
    'c' +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 12) +
    Math.random().toString(36).slice(2, 8)
  );
}

const PLANS = [
  {
    code: 'FREE',
    names: { en: 'Free', fa: 'رایگان', ar: 'مجاني', ur: 'مفت' },
    price: 0,
    currency: 'USD',
    intervalMonths: 12,
    maxProducts: 10,
    maxEmployees: 2,
    maxImagesPerProduct: 5,
    features: { badge: null, prioritySearch: false },
    sortOrder: 0
  },
  {
    code: 'VERIFIED_PLUS',
    names: {
      en: 'Verified Plus',
      fa: 'تایید‌شده پلاس',
      ar: 'موثّق بلس',
      ur: 'ویریفائیڈ پلس'
    },
    price: 299,
    currency: 'USD',
    intervalMonths: 12,
    maxProducts: 100,
    maxEmployees: 5,
    maxImagesPerProduct: 15,
    features: { badge: 'VERIFIED', prioritySearch: true },
    sortOrder: 1
  },
  {
    code: 'GOLD',
    names: { en: 'Gold', fa: 'طلایی', ar: 'ذهبي', ur: 'گولڈ' },
    price: 999,
    currency: 'USD',
    intervalMonths: 12,
    maxProducts: null,
    maxEmployees: 20,
    maxImagesPerProduct: 30,
    features: { badge: 'GOLD', prioritySearch: true },
    sortOrder: 2
  }
];

async function main() {
  // 1) Upsert plans by code (limits/prices refresh on re-run; names too).
  for (const plan of PLANS) {
    await pool.query(
      `INSERT INTO "SubscriptionPlan"
         (id, code, "nameTranslations", price, currency, "intervalMonths",
          "maxProducts", "maxEmployees", "maxImagesPerProduct", features,
          "isActive", "sortOrder", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, $11, NOW(), NOW())
       ON CONFLICT (code) DO UPDATE SET
         "nameTranslations" = EXCLUDED."nameTranslations",
         price = EXCLUDED.price,
         currency = EXCLUDED.currency,
         "intervalMonths" = EXCLUDED."intervalMonths",
         "maxProducts" = EXCLUDED."maxProducts",
         "maxEmployees" = EXCLUDED."maxEmployees",
         "maxImagesPerProduct" = EXCLUDED."maxImagesPerProduct",
         features = EXCLUDED.features,
         "sortOrder" = EXCLUDED."sortOrder",
         "updatedAt" = NOW()`,
      [
        cuidLike(),
        plan.code,
        JSON.stringify(plan.names),
        plan.price,
        plan.currency,
        plan.intervalMonths,
        plan.maxProducts,
        plan.maxEmployees,
        plan.maxImagesPerProduct,
        JSON.stringify(plan.features),
        plan.sortOrder
      ]
    );
    console.log(`plan ${plan.code}: upserted`);
  }

  // 2) Auto-subscribe suppliers without an ACTIVE/TRIAL subscription to FREE.
  const { rows: missing } = await pool.query(`
    SELECT s.id FROM "Supplier" s
    WHERE NOT EXISTS (
      SELECT 1 FROM "SupplierSubscription" ss
      WHERE ss."supplierId" = s.id AND ss.status IN ('ACTIVE', 'TRIAL')
    )
  `);
  const { rows: freeRows } = await pool.query(
    `SELECT id FROM "SubscriptionPlan" WHERE code = 'FREE'`
  );
  const freeId = freeRows[0].id;
  for (const row of missing) {
    await pool.query(
      `INSERT INTO "SupplierSubscription"
         (id, "supplierId", "planId", status, "startedAt", "currentPeriodEnd",
          "cancelAtPeriodEnd", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'ACTIVE', NOW(), NULL, false, NOW(), NOW())`,
      [cuidLike(), row.id, freeId]
    );
  }
  console.log(`auto-subscribed to FREE: ${missing.length}`);

  // 3) Reconciliation: every supplier must have EXACTLY ONE active sub.
  const { rows: bad } = await pool.query(`
    SELECT s.id, COUNT(ss.id)::int AS n
    FROM "Supplier" s
    LEFT JOIN "SupplierSubscription" ss
      ON ss."supplierId" = s.id AND ss.status IN ('ACTIVE', 'TRIAL')
    GROUP BY s.id
    HAVING COUNT(ss.id) <> 1
  `);
  if (bad.length > 0) {
    console.error(
      `VERIFICATION FAILED — suppliers without exactly one active subscription: ${bad
        .map((b) => `${b.id}(${b.n})`)
        .join(', ')}`
    );
    process.exit(1);
  }
  console.log('Verification passed: every supplier has exactly one active subscription.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
