/** A private-viewing enquiry, as captured by the contact form. */
export type Enquiry = {
  name: string;
  email: string;
  phone: string;
  preferredDate: string;
  message: string;
};

export type EnquiryErrors = Partial<Record<keyof Enquiry, string>>;

/**
 * Where enquiries are posted.
 *
 * The project's own route by default — `app/api/enquiry/route.ts`, which
 * validates, rate-limits and delivers. `NEXT_PUBLIC_ENQUIRY_ENDPOINT`
 * overrides it for a client who already has a forms provider or a CRM
 * webhook they would rather use.
 *
 * Deliberately a public variable: it is a form action URL, not a secret. The
 * mail credentials live on the server and are never read on the client.
 */
const ENDPOINT = process.env.NEXT_PUBLIC_ENQUIRY_ENDPOINT || '/api/enquiry';

/**
 * Shortest a human takes to fill this form in, matching the route's own
 * threshold. Used as the default when a caller supplies no timing.
 */
export const MIN_HUMAN_MS = 3000;

/** Pragmatic address check: shape only, since the real test is delivery. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEnquiry(enquiry: Enquiry): EnquiryErrors {
  const errors: EnquiryErrors = {};

  if (enquiry.name.trim().length < 2) errors.name = 'Please enter your name.';
  if (!EMAIL.test(enquiry.email.trim())) errors.email = 'Please enter a valid email address.';
  if (enquiry.message.trim().length < 10) {
    errors.message = 'Please tell us a little about your enquiry.';
  }

  return errors;
}

export type EnquiryResult =
  | { status: 'sent' }
  /** Too many enquiries from this address in a short window. */
  | { status: 'rateLimited' }
  /** No endpoint is configured, so the enquiry is handed to the mail client. */
  | { status: 'unconfigured'; mailto: string }
  /**
   * Neither an endpoint nor an enquiry address is set, so there is nowhere
   * to send to. The composed message is returned anyway: a visitor who has
   * filled in a form should never be left holding nothing.
   */
  | { status: 'undeliverable'; body: string };

function composeBody(enquiry: Enquiry): string {
  return [
    `Name: ${enquiry.name}`,
    `Email: ${enquiry.email}`,
    enquiry.phone ? `Telephone: ${enquiry.phone}` : null,
    enquiry.preferredDate ? `Preferred viewing: ${enquiry.preferredDate}` : null,
    '',
    enquiry.message,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
}

function composeMailto(enquiry: Enquiry, to: string): string {
  return `mailto:${to}?subject=${encodeURIComponent('Private viewing enquiry')}&body=${encodeURIComponent(composeBody(enquiry))}`;
}

/**
 * Submits an enquiry.
 *
 * A JSON POST to the route, which answers with a status rather than a bare
 * code so the form can tell apart the three things a visitor needs told
 * differently: it went, it is not set up yet, or you have sent enough for now.
 *
 * A 503 means the server has no mail credentials. That is not a failure to
 * hide — the enquiry still exists and the visitor still wants to send it — so
 * it falls back to the mail draft rather than reporting a delivery that did
 * not happen.
 */
export async function submitEnquiry(
  enquiry: Enquiry,
  fallbackTo: string | null,
  /** Anti-spam signals, gathered by the form. */
  guard: { company: string; elapsed: number } = { company: '', elapsed: MIN_HUMAN_MS },
): Promise<EnquiryResult> {
  const unsent = (): EnquiryResult =>
    fallbackTo
      ? { status: 'unconfigured', mailto: composeMailto(enquiry, fallbackTo) }
      : { status: 'undeliverable', body: composeBody(enquiry) };

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...enquiry, ...guard }),
  });

  if (response.status === 503) return unsent();
  if (response.status === 429) return { status: 'rateLimited' };
  if (!response.ok) throw new Error(`Enquiry failed with status ${response.status}`);
  return { status: 'sent' };
}
