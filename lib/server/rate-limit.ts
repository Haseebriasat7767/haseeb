/**
 * A rate limiter in module memory.
 *
 * Worth being straight about what this is: on a serverless host each instance
 * has its own memory, so a flood spread across cold starts gets more through
 * than the limit suggests. It is a speed bump for the ordinary case — a stuck
 * retry loop, someone leaning on a button — not a guarantee. A real one needs
 * shared storage, and that is a dependency neither caller yet justifies.
 *
 * Improvements in this revision:
 * - Proper client IP extraction (handles x-forwarded-for chain, Vercel)
 * - Periodic cleanup to prevent unbounded growth
 * - IPv6 normalization
 */

const buckets = new Map<string, Map<string, number[]>>();

/** Keeps one long-lived instance from growing a bucket without bound. */
const MAX_KEYS = 500;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

export type RateLimit = {
  /** How many are allowed inside the window. */
  limit: number;
  /** The window, in milliseconds. */
  windowMs: number;
};

/**
 * Extracts real client IP from request headers.
 * Handles Vercel, Cloudflare, and generic proxies.
 * Returns 'unknown' if no IP found.
 */
export function getClientIP(request: Request): string {
  // Vercel / standard forwarded header — first entry is original client
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first && first.length > 0) return normalizeIP(first);
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) return normalizeIP(realIP.trim());

  // Cloudflare
  const cfIP = request.headers.get('cf-connecting-ip');
  if (cfIP) return normalizeIP(cfIP.trim());

  return 'unknown';
}

function normalizeIP(ip: string): string {
  // Strip port if present, handle IPv6 brackets
  if (ip.startsWith('[')) {
    const end = ip.indexOf(']');
    if (end !== -1) return ip.slice(1, end);
  }
  // IPv4 with port: 1.2.3.4:1234
  const colonIdx = ip.lastIndexOf(':');
  if (colonIdx !== -1 && ip.indexOf(':') === colonIdx) {
    // Single colon, could be port — check if after colon is numeric and ip before is IPv4
    const after = ip.slice(colonIdx + 1);
    if (/^\d+$/.test(after) && ip.slice(0, colonIdx).includes('.')) {
      return ip.slice(0, colonIdx);
    }
  }
  return ip;
}

function maybeCleanup(now: number): void {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  for (const [name, bucket] of buckets) {
    for (const [key, times] of bucket) {
      if (times.every((at) => now - at >= 10 * 60 * 1000)) {
        bucket.delete(key);
      }
    }
    if (bucket.size === 0) buckets.delete(name);
  }
}

/**
 * Records a hit and says whether it is over the limit.
 *
 * `name` separates callers so one route's traffic cannot exhaust another's.
 */
export function rateLimited(name: string, key: string, { limit, windowMs }: RateLimit): boolean {
  const now = Date.now();
  maybeCleanup(now);

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
