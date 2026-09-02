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
 * Where enquiries are posted. Left unset in this repository — the project
 * has no backend, and inventing one would be worse than saying so. Set
 * `NEXT_PUBLIC_ENQUIRY_ENDPOINT` to a URL that accepts a JSON POST and the
 * form below starts using it with no other change.
 *
 * It is deliberately a public variable: it is a form action URL, not a
 * secret, and no key of any kind is read on the client.
 */
const ENDPOINT = process.env.NEXT_PUBLIC_ENQUIRY_ENDPOINT ?? '';

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
  /** No endpoint is configured, so the enquiry is handed to the mail client. */
  | { status: 'unconfigured'; mailto: string };

function composeMailto(enquiry: Enquiry, to: string): string {
  const lines = [
    `Name: ${enquiry.name}`,
    `Email: ${enquiry.email}`,
    enquiry.phone ? `Telephone: ${enquiry.phone}` : null,
    enquiry.preferredDate ? `Preferred viewing: ${enquiry.preferredDate}` : null,
    '',
    enquiry.message,
  ].filter((line): line is string => line !== null);

  return `mailto:${to}?subject=${encodeURIComponent('Private viewing enquiry')}&body=${encodeURIComponent(lines.join('\n'))}`;
}

/**
 * Submits an enquiry. With an endpoint configured this is a plain JSON
 * POST; without one it returns the composed mail draft instead of
 * pretending a message was delivered.
 */
export async function submitEnquiry(enquiry: Enquiry, fallbackTo: string): Promise<EnquiryResult> {
  if (!ENDPOINT) {
    return { status: 'unconfigured', mailto: composeMailto(enquiry, fallbackTo) };
  }

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(enquiry),
  });

  if (!response.ok) throw new Error(`Enquiry failed with status ${response.status}`);
  return { status: 'sent' };
}
