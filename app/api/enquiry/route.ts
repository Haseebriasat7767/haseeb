import nodemailer, { type Transporter } from 'nodemailer';
import { NextResponse } from 'next/server';
import { validateEnquiry, type Enquiry } from '@/lib/contact/enquiry';

/**
 * Where a private-viewing enquiry actually goes.
 *
 * ## Why this exists
 *
 * It did not, and that was the single most expensive gap in the project. The
 * form validated, showed a sending state and a success state, and then handed
 * the visitor a `mailto:` link, because there was no server anywhere in the
 * app to hand it to. Every enquiry the site has ever taken was lost at the
 * last step, and it looked fine from the outside — which is exactly why it
 * survived this long.
 *
 * ## What it does not do
 *
 * It does not pretend. With no credentials configured the route says so, in
 * a status the client can act on, and the form falls back to the mail draft
 * it always had. A route that returned 200 without sending anything would be
 * worse than no route at all: it would turn a visible gap into a silent one.
 *
 * ## How it sends
 *
 * Plain SMTP, through whatever mailbox the operator already owns — a Google
 * Workspace account, Microsoft 365, or the mail server that comes with the
 * hosting. There is no email vendor in this file and no account to sign up
 * for: the five `SMTP_*` variables below are the same ones any mail client
 * asks for.
 *
 * Nothing here is a client secret. The password is read on the server only
 * and never crosses the wire to the browser.
 */

// Node rather than edge: the rate limiter below keeps state in module memory,
// and nodemailer opens a real TCP connection, which the edge runtime has no
// way to do.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Shortest a human takes to fill this form in.
 *
 * A bot posts the instant it parses the page. This is the cheapest filter
 * there is and it costs a legitimate visitor nothing, because nobody types a
 * name, an email and a paragraph in under three seconds.
 */
const MIN_ELAPSED_MS = 3000;

/** Enquiries per address per window, and the window. */
const RATE_LIMIT = 4;
const RATE_WINDOW_MS = 10 * 60 * 1000;

/**
 * A rate limiter in module memory.
 *
 * Worth being straight about what this is: on a serverless host each instance
 * has its own memory, so a determined flood spread across cold starts gets
 * more than four through. It is a speed bump for the ordinary case — a stuck
 * retry loop, someone leaning on the button — not a guarantee. A real one
 * needs shared storage, and that is a dependency this route does not yet
 * justify.
 */
const seen = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const hits = (seen.get(key) ?? []).filter((at) => now - at < RATE_WINDOW_MS);
  hits.push(now);
  seen.set(key, hits);

  // Keep the map from growing without bound on a long-lived instance.
  if (seen.size > 500) {
    for (const [k, v] of seen) {
      if (v.every((at) => now - at >= RATE_WINDOW_MS)) seen.delete(k);
    }
  }
  return hits.length > RATE_LIMIT;
}

/** Escapes text bound for an HTML mail body. */
function escape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  to: string;
  from: string;
};

/**
 * Reads the mail settings, or returns null if any of them is missing.
 *
 * All six together or none: a half-configured deployment is the case that
 * produces a silent failure, so it is treated exactly like no configuration
 * at all rather than being allowed to fail later at send time.
 */
function readSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  const to = process.env.ENQUIRY_TO;
  const from = process.env.ENQUIRY_FROM;

  // 587 with STARTTLS is what virtually every provider wants; 465 is implicit
  // TLS and is the other one worth supporting. Anything else has to be named.
  const port = Number(process.env.SMTP_PORT ?? 587);

  if (!host || !user || !password || !to || !from || !Number.isFinite(port)) return null;
  return { host, port, user, password, to, from };
}

/**
 * One transport per warm instance.
 *
 * nodemailer pools connections, so re-creating it per request would open a
 * fresh TCP and TLS handshake for every enquiry — and some providers count
 * that as a login attempt and start refusing them.
 */
let transport: Transporter | null = null;

function getTransport(config: SmtpConfig): Transporter {
  transport ??= nodemailer.createTransport({
    host: config.host,
    port: config.port,
    // Implicit TLS on 465; STARTTLS on everything else. Never plaintext:
    // `requireTLS` makes the connection fail rather than quietly downgrade
    // and send a visitor's name, address and message in the clear.
    secure: config.port === 465,
    requireTLS: config.port !== 465,
    auth: { user: config.user, pass: config.password },
    pool: true,
    maxConnections: 2,
  });
  return transport;
}

function row(label: string, value: string): string {
  return `<tr><td style="padding:6px 18px 6px 0;color:#6c757f;font:400 13px system-ui">${label}</td><td style="padding:6px 0;color:#1b1f25;font:400 15px system-ui">${escape(value)}</td></tr>`;
}

export async function POST(request: Request) {
  const smtp = readSmtpConfig();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: 'invalid' }, { status: 400 });
  }

  const payload = body as Partial<Enquiry> & { company?: string; elapsed?: number };

  // The honeypot. A field no visitor can see and no visitor can tab to, so
  // anything in it came from something reading the markup. Answered with 200
  // on purpose: a bot told it failed simply tries again differently.
  if (typeof payload.company === 'string' && payload.company.trim() !== '') {
    return NextResponse.json({ status: 'sent' });
  }
  if (typeof payload.elapsed === 'number' && payload.elapsed < MIN_ELAPSED_MS) {
    return NextResponse.json({ status: 'sent' });
  }

  const enquiry: Enquiry = {
    name: String(payload.name ?? '').slice(0, 200),
    email: String(payload.email ?? '').slice(0, 320),
    phone: String(payload.phone ?? '').slice(0, 60),
    preferredDate: String(payload.preferredDate ?? '').slice(0, 60),
    message: String(payload.message ?? '').slice(0, 4000),
  };

  // Validated again here. The browser already did it, and the browser is not
  // the thing posting to this route in the case that matters.
  const errors = validateEnquiry(enquiry);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ status: 'invalid', errors }, { status: 400 });
  }

  // No credentials: say so rather than report a success that did not happen.
  //
  // Checked BEFORE the rate limit on purpose. The other way round, an
  // unconfigured deployment answers a visitor's fifth attempt with "we
  // already have your enquiry" when it has never had one — which is the
  // exact dishonesty this route exists to avoid, arrived at from the other
  // direction. There is also nothing to protect: the route sends nothing.
  if (!smtp) {
    return NextResponse.json({ status: 'unconfigured' }, { status: 503 });
  }

  if (rateLimited(enquiry.email.trim().toLowerCase())) {
    return NextResponse.json({ status: 'rateLimited' }, { status: 429 });
  }

  const table = [
    row('Name', enquiry.name),
    row('Email', enquiry.email),
    enquiry.phone ? row('Telephone', enquiry.phone) : '',
    enquiry.preferredDate ? row('Preferred viewing', enquiry.preferredDate) : '',
  ].join('');

  const mailer = getTransport(smtp);

  try {
    await mailer.sendMail({
      from: smtp.from,
      to: smtp.to,
      subject: `Private viewing enquiry — ${enquiry.name}`,
      // `reply_to` is the enquirer, so answering is one keystroke rather than
      // copying an address out of the body.
      replyTo: enquiry.email,
      html: `<div style="font:400 15px/1.6 system-ui;color:#1b1f25">
<p style="font:500 12px system-ui;letter-spacing:.14em;text-transform:uppercase;color:#96733d;margin:0 0 18px">Private viewing enquiry</p>
<table style="border-collapse:collapse;margin-bottom:22px">${table}</table>
<div style="border-left:3px solid #96733d;padding-left:16px;white-space:pre-wrap">${escape(enquiry.message)}</div>
</div>`,
    });
  } catch (error) {
    console.error('[enquiry] delivery failed', error);
    return NextResponse.json({ status: 'failed' }, { status: 502 });
  }

  // The acknowledgement. Sent after the enquiry itself and deliberately not
  // allowed to fail the request: the lead is already safely delivered, and
  // telling the visitor their enquiry failed because a courtesy email bounced
  // would be false.
  try {
    await mailer.sendMail({
      from: smtp.from,
      to: enquiry.email,
      replyTo: smtp.to,
      subject: 'Your enquiry — AURELIA',
      html: `<div style="font:400 15px/1.6 system-ui;color:#1b1f25">
<p style="font:500 12px system-ui;letter-spacing:.14em;text-transform:uppercase;color:#96733d;margin:0 0 18px">AURELIA</p>
<p>Thank you — your enquiry has reached us and a member of the team will be in touch to arrange a viewing.</p>
<p style="color:#6c757f">For reference, this is what you sent:</p>
<div style="border-left:3px solid #dee2e7;padding-left:16px;color:#3c434c;white-space:pre-wrap">${escape(enquiry.message)}</div>
</div>`,
    });
  } catch (error) {
    console.error('[enquiry] acknowledgement failed', error);
  }

  return NextResponse.json({ status: 'sent' });
}
