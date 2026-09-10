import { NextResponse } from 'next/server';
import { rateLimited } from '@/lib/server/rate-limit';

/**
 * Where a browser error goes.
 *
 * ## Why this exists
 *
 * The server's errors are already captured — the host records anything
 * written to stderr, and they can be read back and alerted on. The browser's
 * were not recorded anywhere at all. A scene that fails to build, a chunk
 * that will not load, a component that throws on a device nobody tested:
 * every one of those was invisible, and the only person who ever found out
 * was the visitor who left.
 *
 * So this takes the error and writes it to the same stream, where it joins
 * everything else and can be alerted on by whatever the host is configured
 * to drain logs into. There is no third-party monitoring service here and no
 * account to hold: this is the log the platform already keeps.
 *
 * ## What it deliberately does not collect
 *
 * Nothing about the person. The message, the stack, the page it happened on
 * and the browser's user-agent string — the four things needed to reproduce
 * a fault, and nothing that identifies who hit it.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Generous, because a single broken render can throw on every frame.
 *
 * The limit is per client per window: enough to see a fault repeating,
 * little enough that a page stuck in a throwing loop cannot fill the log.
 */
const LIMIT = { limit: 20, windowMs: 5 * 60 * 1000 };

/** Long enough for a real stack, short enough not to be a payload. */
const MAX_FIELD = 4000;

function clip(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, MAX_FIELD) : '';
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: 'invalid' }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const message = clip(payload.message);
  if (message.trim() === '') return NextResponse.json({ status: 'invalid' }, { status: 400 });

  // Keyed by the forwarded address where the host sets one. It is used to
  // group a burst of errors and is not stored.
  const key =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  if (rateLimited('client-error', key, LIMIT)) {
    // 204, not 429: the browser cannot act on this and should not retry.
    return new NextResponse(null, { status: 204 });
  }

  console.error(
    '[client-error]',
    JSON.stringify({
      message,
      stack: clip(payload.stack),
      page: clip(payload.page),
      digest: clip(payload.digest),
      kind: clip(payload.kind) || 'error',
      userAgent: (request.headers.get('user-agent') ?? '').slice(0, 300),
      at: new Date().toISOString(),
    }),
  );

  return new NextResponse(null, { status: 204 });
}
