import { TokenBucketLimiter } from '@/lib/media/rate-limit';

/**
 * RFQ creation limiter — anti-spam for the public marketplace.
 *
 * Keyed by user id. Allows a small burst (5) then refills at ~10/hour,
 * so a legitimate buyer is never blocked while a scripted flood is.
 *
 * NOTE: in-memory + per-instance (same caveat as the media limiter).
 * For multi-instance deployments, back this with Redis.
 */
export const rfqCreateLimiter = new TokenBucketLimiter({
  capacity: 5,
  refillRate: 10 / 3600, // 10 per hour
});
