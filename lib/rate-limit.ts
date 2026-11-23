// Best-effort in-memory rate limiter (fixed window).
//
// NOTE: serverless instances don't share memory, so this limits per-instance,
// not globally. It meaningfully blunts bursts and accidental loops, but for
// strong, global protection in production use a shared store (e.g. Upstash
// Redis / Vercel KV) plus a hard spend cap on the Anthropic account.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function checkRateLimit(
  key: string,
  max = 5,
  windowMs = 60_000
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1, retryAfterMs: 0 };
  }

  if (bucket.count >= max) {
    return { allowed: false, remaining: 0, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count += 1;
  // Opportunistic cleanup so the map doesn't grow unbounded.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (now > v.resetAt) buckets.delete(k);
  }
  return { allowed: true, remaining: max - bucket.count, retryAfterMs: 0 };
}
