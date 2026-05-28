/**
 * In-memory token-bucket rate limiter for media API endpoints.
 *
 * Each "key" (IP address or user ID) gets a bucket with:
 *   - capacity   : max tokens
 *   - refillRate : tokens added per second
 *
 * Edge cases handled:
 *   - Buckets GC'd after inactivity to prevent memory leak
 *   - Safe for serverless with module-level Map (per-instance, not global)
 *
 * For multi-instance deployments, replace with Redis INCR+TTL.
 */

interface Bucket {
  tokens:   number;
  lastTime: number;  // ms timestamp
}

interface LimiterConfig {
  capacity:   number;  // max burst
  refillRate: number;  // tokens / second
  ttlMs?:     number;  // GC buckets idle longer than this (default 5 min)
}

export class TokenBucketLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly capacity:   number;
  private readonly refillRate: number;
  private readonly ttlMs:      number;
  private gcTimer: ReturnType<typeof setInterval> | null = null;

  constructor({ capacity, refillRate, ttlMs = 5 * 60_000 }: LimiterConfig) {
    this.capacity   = capacity;
    this.refillRate = refillRate;
    this.ttlMs      = ttlMs;
  }

  /** Returns true if the request is allowed (consumes 1 token). */
  allow(key: string): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = { tokens: this.capacity, lastTime: now };
      this.buckets.set(key, bucket);
      this.scheduleGc();
    } else {
      /* Refill tokens based on elapsed time */
      const elapsed = (now - bucket.lastTime) / 1000;
      bucket.tokens = Math.min(this.capacity, bucket.tokens + elapsed * this.refillRate);
      bucket.lastTime = now;
    }

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }
    return false;
  }

  /** Remaining tokens for a key (informational). */
  remaining(key: string): number {
    const b = this.buckets.get(key);
    if (!b) return this.capacity;
    const elapsed = (Date.now() - b.lastTime) / 1000;
    return Math.min(this.capacity, b.tokens + elapsed * this.refillRate);
  }

  private scheduleGc() {
    if (this.gcTimer !== null) return;
    this.gcTimer = setInterval(() => this.gc(), this.ttlMs);
    /* Allow process to exit even if timer is running */
    if (typeof this.gcTimer === 'object' && this.gcTimer !== null && 'unref' in this.gcTimer) {
      (this.gcTimer as { unref(): void }).unref();
    }
  }

  private gc() {
    const staleThreshold = Date.now() - this.ttlMs;
    for (const [key, bucket] of this.buckets) {
      if (bucket.lastTime < staleThreshold) this.buckets.delete(key);
    }
    if (this.buckets.size === 0) {
      clearInterval(this.gcTimer!);
      this.gcTimer = null;
    }
  }
}

/* ── Shared limiters (module-level singletons) ── */

/** Upload endpoint: 20 uploads/minute burst, steady 1/3s */
export const uploadLimiter = new TokenBucketLimiter({
  capacity:   20,
  refillRate: 20 / 60,  // 20 per minute
});

/** Replace endpoint: 10 replacements/minute */
export const replaceLimiter = new TokenBucketLimiter({
  capacity:   10,
  refillRate: 10 / 60,
});

/** Alt-suggest: 30 requests/minute */
export const altSuggestLimiter = new TokenBucketLimiter({
  capacity:   30,
  refillRate: 30 / 60,
});

/** Extract the best available client key from a request. */
export function clientKey(request: Request): string {
  /* Vercel / CF-Connecting-IP / X-Forwarded-For / fallback */
  return (
    request.headers.get('x-vercel-forwarded-for') ??
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}
