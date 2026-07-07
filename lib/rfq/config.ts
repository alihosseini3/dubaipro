/**
 * RFQ ecosystem runtime configuration.
 *
 * Moderation gate: when enabled (the default), newly created buyer RFQs
 * enter `PENDING_REVIEW` and must be approved by an admin before they
 * appear on the public marketplace. Admin-created RFQs always bypass
 * review. Set `RFQ_REQUIRE_MODERATION=false` to auto-publish every RFQ
 * (legacy behaviour) — useful for trusted/internal deployments.
 */
export function rfqRequiresModeration(): boolean {
  return process.env.RFQ_REQUIRE_MODERATION !== 'false';
}
