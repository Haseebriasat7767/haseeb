/**
 * A rate limiter in module memory.
 *
 * Worth being straight about what this is: on a serverless host each instance
 * has its own memory, so a flood spread across cold starts gets more through
 * than the limit suggests. It is a speed bump for the ordinary case — a stuck
 * retry loop, someone leaning on a button — not a guarantee. A real one needs
 * shared storage, and that is a dependency neither caller yet justifies.
 */

const buckets = new Map<string, Map<string, number[]>>();

/** Keeps one long-lived instance from growing a bucket without bound. */
const MAX_KEYS = 500;

export type RateLimit = {
  /** How many are allowed inside the window. */
  limit: number;
  /** The window, in milliseconds. */
  windowMs: number;
};

/**
 * Records a hit and says whether it is over the limit.
 *
 * `name` separates callers so one route's traffic cannot exhaust another's.
 */
export function rateLimited(name: string, key: string, { limit, windowMs }: RateLimit): boolean {
  const now = Date.now();
  let bucket = buckets.get(name);
  if (!bucket) {
    bucket = new Map();
    buckets.set(name, bucket);
  }

  const hits = (bucket.get(key) ?? []).filter((at) => now - at < windowMs);
  hits.push(now);
  bucket.set(key, hits);

  if (bucket.size > MAX_KEYS) {
    for (const [existing, times] of bucket) {
      if (times.every((at) => now - at >= windowMs)) bucket.delete(existing);
    }
  }

  return hits.length > limit;
}

/** Clears a bucket. Tests only — nothing in the app resets a limiter. */
export function resetRateLimit(name?: string): void {
  if (name) buckets.delete(name);
  else buckets.clear();
}
