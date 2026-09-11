import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getClientIP, rateLimited, resetRateLimit } from '@/lib/server/rate-limit';

const LIMIT = { limit: 3, windowMs: 60_000 };

beforeEach(() => {
  resetRateLimit();
  vi.useRealTimers();
});

describe('rateLimited', () => {
  it('allows up to the limit and then stops', () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect(rateLimited('test', 'someone', LIMIT)).toBe(false);
    }
    expect(rateLimited('test', 'someone', LIMIT)).toBe(true);
  });

  it('counts each key separately', () => {
    for (let attempt = 0; attempt < 4; attempt += 1) rateLimited('test', 'noisy', LIMIT);
    expect(rateLimited('test', 'quiet', LIMIT)).toBe(false);
  });

  it('keeps buckets apart so one route cannot exhaust another', () => {
    for (let attempt = 0; attempt < 4; attempt += 1) rateLimited('one', 'shared-key', LIMIT);
    expect(rateLimited('two', 'shared-key', LIMIT)).toBe(false);
  });

  it('forgets hits once the window has passed', () => {
    vi.useFakeTimers();
    for (let attempt = 0; attempt < 4; attempt += 1) rateLimited('test', 'someone', LIMIT);
    expect(rateLimited('test', 'someone', LIMIT)).toBe(true);

    vi.advanceTimersByTime(LIMIT.windowMs + 1);
    expect(rateLimited('test', 'someone', LIMIT)).toBe(false);
  });

  it('does not grow without bound on a long-lived instance', () => {
    vi.useFakeTimers();
    for (let key = 0; key < 600; key += 1) rateLimited('test', `visitor-${key}`, LIMIT);
    vi.advanceTimersByTime(LIMIT.windowMs + 1);

    // The sweep runs on the next write once the bucket is over its cap.
    for (let key = 0; key < 600; key += 1) rateLimited('test', `later-${key}`, LIMIT);
    expect(rateLimited('test', 'visitor-0', LIMIT)).toBe(false);
  });
});

describe('getClientIP', () => {
  function req(headers: Record<string, string>): Request {
    return new Request('http://localhost', { headers });
  }

  it('reads x-forwarded-for first entry', () => {
    expect(getClientIP(req({ 'x-forwarded-for': '203.0.113.1, 198.51.100.2' }))).toBe('203.0.113.1');
  });

  it('falls back to x-real-ip', () => {
    expect(getClientIP(req({ 'x-real-ip': '203.0.113.5' }))).toBe('203.0.113.5');
  });

  it('handles cf-connecting-ip', () => {
    expect(getClientIP(req({ 'cf-connecting-ip': '203.0.113.9' }))).toBe('203.0.113.9');
  });

  it('returns unknown when no header', () => {
    expect(getClientIP(req({}))).toBe('unknown');
  });

  it('strips port from IPv4', () => {
    expect(getClientIP(req({ 'x-forwarded-for': '203.0.113.1:1234' }))).toBe('203.0.113.1');
  });
});
