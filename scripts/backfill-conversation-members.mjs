// Backfill: create ConversationMember rows for legacy 2-party conversations
// (customerId/sellerId) and seed lastMessageAt/lastMessagePreview from the
// newest message. Idempotent — existing member rows are kept (unreadCount is
// deliberately NOT reset on re-runs).
//
// Known trade-off (documented in the plan): unread counters start at 0 for
// backfilled rows.
//
// Run with: node --env-file=.env scripts/backfill-conversation-members.mjs
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

async function main() {
  const { rows: conversations } = await pool.query(`
    SELECT c.id, c."customerId", c."sellerId", c.type
    FROM "Conversation" c
    WHERE c."customerId" IS NOT NULL OR c."sellerId" IS NOT NULL
  `);

  let created = 0;
  for (const convo of conversations) {
    const pairs = [
      convo.customerId ? { userId: convo.customerId, role: 'BUYER' } : null,
      convo.sellerId ? { userId: convo.sellerId, role: 'SUPPLIER' } : null
    ].filter(Boolean);
    for (const pair of pairs) {
      const { rowCount } = await pool.query(
        `INSERT INTO "ConversationMember"
           (id, "conversationId", "userId", "memberRole", "unreadCount", "isArchived", "isMuted", "joinedAt")
         VALUES ($1, $2, $3, $4, 0, false, false, NOW())
         ON CONFLICT ("conversationId", "userId") DO NOTHING`,
        [cuidLike(), convo.id, pair.userId, pair.role]
      );
      created += rowCount;
    }
  }

  // Seed lastMessageAt/preview from the newest message of each conversation.
  await pool.query(`
    UPDATE "Conversation" c
    SET "lastMessageAt" = m."createdAt",
        "lastMessagePreview" = left(m.content, 200)
    FROM (
      SELECT DISTINCT ON ("conversationId") "conversationId", content, "createdAt"
      FROM "Message"
      ORDER BY "conversationId", "createdAt" DESC
    ) m
    WHERE m."conversationId" = c.id
  `);

  // Verification: no legacy conversation may end up with fewer members than
  // legacy participants.
  const { rows: broken } = await pool.query(`
    SELECT c.id FROM "Conversation" c
    WHERE (c."customerId" IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM "ConversationMember" m WHERE m."conversationId" = c.id AND m."userId" = c."customerId"))
       OR (c."sellerId" IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM "ConversationMember" m WHERE m."conversationId" = c.id AND m."userId" = c."sellerId"))
  `);

  console.log(`legacy conversations: ${conversations.length}, member rows created: ${created}`);
  if (broken.length > 0) {
    console.error(`VERIFICATION FAILED for: ${broken.map((b) => b.id).join(', ')}`);
    process.exit(1);
  }
  console.log('Verification passed: every legacy participant has a member row.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
