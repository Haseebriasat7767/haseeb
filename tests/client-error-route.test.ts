import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/client-error/route';
import { resetRateLimit } from '@/lib/server/rate-limit';

/**
 * Browser errors reaching the log.
 *
 * Server failures were already recorded; browser failures were recorded
 * nowhere, so a scene that failed to build on a device nobody tested was
 * invisible and the only person who found out was the visitor who left.
 */

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/client-error', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

let logged: string[][];

beforeEach(() => {
  resetRateLimit('client-error');
  logged = [];
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    logged.push(args.map(String));
  });
});

describe('recording', () => {
  it('writes the error to the log and answers with no content', async () => {
    const response = await POST(
      post(
        { message: 'Cannot read properties of null', stack: 'at Scene', page: '/tower' },
        { 'user-agent': 'Mozilla/5.0 (TestDevice)' },
      ),
    );

    expect(response.status).toBe(204);
    const entry = JSON.parse(logged[0]?.[1] ?? '{}');
    expect(entry.message).toBe('Cannot read properties of null');
    expect(entry.page).toBe('/tower');
    expect(entry.userAgent).toContain('TestDevice');
    expect(entry.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('records what kind of failure it was', async () => {
    await POST(post({ message: 'boom', kind: 'unhandledrejection' }));
    expect(JSON.parse(logged[0]?.[1] ?? '{}').kind).toBe('unhandledrejection');
  });

  it('defaults the kind when none is given', async () => {
    await POST(post({ message: 'boom' }));
    expect(JSON.parse(logged[0]?.[1] ?? '{}').kind).toBe('error');
  });
});

describe('what it refuses', () => {
  it('rejects a body with no message', async () => {
    expect((await POST(post({ stack: 'at nowhere' }))).status).toBe(400);
    expect(logged).toHaveLength(0);
  });

  it('rejects a blank message', async () => {
    expect((await POST(post({ message: '   ' }))).status).toBe(400);
  });

  it('rejects a malformed body without throwing', async () => {
    expect((await POST(post('not json'))).status).toBe(400);
  });

  it('caps each field so a report cannot become a payload', async () => {
    await POST(post({ message: 'x'.repeat(20_000), stack: 'y'.repeat(20_000) }));

    const entry = JSON.parse(logged[0]?.[1] ?? '{}');
    expect(entry.message.length).toBe(4000);
    expect(entry.stack.length).toBe(4000);
  });

  it('stops a page stuck in a throwing loop from filling the log', async () => {
    const from = { 'x-forwarded-for': '203.0.113.9' };
    for (let attempt = 0; attempt < 20; attempt += 1) {
      expect((await POST(post({ message: 'again' }, from))).status).toBe(204);
    }

    // Still 204, because the browser cannot act on this and must not retry —
    // but no longer written down.
    const over = await POST(post({ message: 'again' }, from));
    expect(over.status).toBe(204);
    expect(logged).toHaveLength(20);
  });

  it('does not let one visitor silence another', async () => {
    const noisy = { 'x-forwarded-for': '203.0.113.9' };
    for (let attempt = 0; attempt < 25; attempt += 1) await POST(post({ message: 'again' }, noisy));

    const before = logged.length;
    await POST(post({ message: 'first time' }, { 'x-forwarded-for': '198.51.100.4' }));
    expect(logged.length).toBe(before + 1);
  });
});
