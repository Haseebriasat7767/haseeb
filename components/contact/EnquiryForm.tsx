'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { BrochureButton } from '@/components/property/BrochureButton';
import { SITE } from '@/lib/constants/site';
import {
  MAX_MESSAGE_LENGTH,
  submitEnquiry,
  validateEnquiry,
  type Enquiry,
  type EnquiryErrors,
  type EnquiryKind,
} from '@/lib/contact/enquiry';
import { takeLeadContext, type LeadContext } from '@/lib/contact/lead-context';
import {
  trackEnquirySubmitted,
  trackEnquiryStarted,
  trackCommercialDemoStarted,
  trackCommercialDemoSubmitted,
  trackPrivateViewingStarted,
  trackPrivateViewingSubmitted,
} from '@/lib/analytics/events';
import { Field } from './Field';

function empty(kind: EnquiryKind): Enquiry {
  return { kind, name: '', email: '', phone: '', organisation: '', preferredDate: '', message: '' };
}

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent' }
  | { kind: 'unconfigured'; mailto: string }
  | { kind: 'undeliverable'; body: string }
  | { kind: 'rateLimited' }
  | { kind: 'failed'; message?: string };

/**
 * The enquiry form.
 *
 * Delivery is real: it posts to `app/api/enquiry`, which validates again,
 * rate-limits, sends the enquiry and acknowledges it to the sender. A build
 * with no mail credentials configured still refuses to pretend — the route
 * answers 503 and the form falls back to handing the completed enquiry to
 * the visitor's mail client, which is what it always did.
 *
 * Two of the fields below are not for the visitor. `company` is a honeypot,
 * hidden from sight and from the tab order, and the mount time is compared
 * against the submit time. Between them they cost a real person nothing and
 * stop the traffic that finds a public form within a day of it going up.
 */
export function EnquiryForm({
  /**
   * Which conversation this is. A viewing by default, so every existing
   * mount of this component keeps the behaviour it had.
   */
  kind = 'viewing',
}: {
  kind?: EnquiryKind;
} = {}) {
  const commercial = kind === 'commercial';
  const [values, setValues] = useState<Enquiry>(() => empty(kind));
  const [errors, setErrors] = useState<EnquiryErrors>({});
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [company, setCompany] = useState('');
  const openedAt = useRef(Date.now());
  const started = useRef(false);
  /**
   * Guards a second delivery.
   *
   * `disabled` on the button stops the obvious double-click, but not a
   * return keypress landing while React is mid-render, and not a
   * resubmission from a form control that never blurred. A ref is checked
   * and set synchronously inside the handler, before any await, which is
   * the only place a duplicate can actually be caught.
   */
  const inFlight = useRef(false);
  const [context, setContext] = useState<LeadContext>({});

  // Read once on mount, on the client only: the CTA that sent the visitor
  // here stashed it, and it describes the page they came from, not this one.
  useEffect(() => {
    setContext(takeLeadContext());
  }, []);

  const set = (key: keyof Enquiry) => (event: { target: { value: string } }) => {
    if (!started.current) {
      started.current = true;
      trackEnquiryStarted();
      if (commercial) trackCommercialDemoStarted();
      else trackPrivateViewingStarted();
    }
    setValues((current) => ({ ...current, [key]: event.target.value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (inFlight.current) return;

    const found = validateEnquiry(values);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      // Focus the first field that failed *as the form is laid out*, not the
      // first key the validator happened to add. Those differ: the commercial
      // rule runs first, so keying off the object put focus on the company
      // field while the empty name above it was the one to fix.
      const fields = Array.from(
        event.currentTarget.querySelectorAll<HTMLElement>('input[name], textarea[name]'),
      );
      const firstInvalid = fields.find((field) => {
        const name = field.getAttribute('name');
        return name !== null && name in found && found[name as keyof EnquiryErrors] !== undefined;
      });
      firstInvalid?.focus();
      return;
    }

    inFlight.current = true;
    setStatus({ kind: 'sending' });

    try {
      const result = await submitEnquiry({ ...values, context }, SITE.contact.email, {
        company,
        elapsed: Date.now() - openedAt.current,
      });
      setStatus(
        result.status === 'sent'
          ? { kind: 'sent' }
          : result.status === 'rateLimited'
            ? { kind: 'rateLimited' }
            : result.status === 'unconfigured'
              ? { kind: 'unconfigured', mailto: result.mailto }
              : { kind: 'undeliverable', body: result.body },
      );
      trackEnquirySubmitted(result.status);
      if (result.status === 'sent') {
        if (commercial) trackCommercialDemoSubmitted();
        else trackPrivateViewingSubmitted();
      }
      // Only a delivered enquiry closes the form. Every other outcome puts
      // the visitor back in front of their own typing with a way onward.
      if (result.status !== 'sent') inFlight.current = false;
    } catch (error) {
      const message = error instanceof Error ? error.message : undefined;
      setStatus({ kind: 'failed', message });
      trackEnquirySubmitted('failed');
      inFlight.current = false;
    }
  }

  if (status.kind === 'sent') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="border-alabaster/10 flex flex-col gap-5 border p-8"
      >
        <p className="text-eyebrow text-gold uppercase">
          {commercial ? 'Enquiry received' : 'Private viewing request received'}
        </p>
        <p className="font-display text-alabaster text-2xl font-semibold">
          Thank you. Your request has been received.
        </p>
        <p className="text-mist text-sm leading-relaxed">
          A member of the project team will contact you shortly.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button href="/" variant="outline" magnetic>
            Return to experience
          </Button>
          <BrochureButton variant="primary" magnetic />
        </div>
      </div>
    );
  }

  if (status.kind === 'rateLimited') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="border-alabaster/10 flex flex-col gap-4 border p-8"
      >
        <p className="text-eyebrow text-gold uppercase">Already received</p>
        <p className="text-mist text-sm leading-relaxed">
          We have your enquiry — several, in fact. There is no need to send another; the team will
          be in touch shortly.
          {SITE.contact.email ? (
            <>
              {' '}
              If it is urgent, write to{' '}
              <a href={`mailto:${SITE.contact.email}`} className="text-gold underline">
                {SITE.contact.email}
              </a>
              .
            </>
          ) : null}
        </p>
      </div>
    );
  }

  if (status.kind === 'unconfigured') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="border-alabaster/10 flex flex-col gap-5 border p-8"
      >
        <p className="text-eyebrow text-gold uppercase">Ready to send</p>
        <p className="font-display text-alabaster text-2xl font-semibold">
          Your enquiry is composed.
        </p>
        <p className="text-mist text-sm leading-relaxed">
          Nothing has been sent yet. Open the message to send it from your own mail client, and the
          private client team will reply with a proposed viewing time.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button href={status.mailto} magnetic>
            Open the message
          </Button>
          <Button variant="outline" onClick={() => setStatus({ kind: 'idle' })}>
            Edit details
          </Button>
        </div>
      </div>
    );
  }

  if (status.kind === 'undeliverable') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="border-alabaster/10 flex flex-col gap-5 border p-8"
      >
        <p className="text-eyebrow text-gold uppercase">Enquiry ready</p>
        <p className="font-display text-alabaster text-2xl font-semibold">
          Your details are ready to send.
        </p>
        <p className="text-mist text-sm leading-relaxed">
          A viewing address has not been published for this presentation, so nothing has been
          transmitted. Your enquiry is below — send it to the contact you were given for Aurelia.
        </p>
        <pre className="border-alabaster/10 text-mist overflow-x-auto border p-5 font-sans text-xs leading-relaxed whitespace-pre-wrap">
          {status.body}
        </pre>
        <div>
          <Button variant="outline" onClick={() => setStatus({ kind: 'idle' })}>
            Edit details
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-8"
      aria-label={commercial ? 'Property experience enquiry' : 'Private viewing enquiry'}
    >
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="company-ref">Company</label>
        <input
          id="company-ref"
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={company}
          onChange={(event) => setCompany(event.target.value)}
        />
      </div>
      <div className="grid gap-8 sm:grid-cols-2">
        <Field
          label="Name"
          name="name"
          autoComplete="name"
          value={values.name}
          onChange={set('name')}
          error={errors.name}
          required
        />
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={set('email')}
          error={errors.email}
          required
        />
        <Field
          label="Telephone"
          name="phone"
          type="tel"
          autoComplete="tel"
          value={values.phone}
          onChange={set('phone')}
          error={errors.phone}
          optional
        />
        <Field
          label={commercial ? 'Company or agency' : 'Company or agency'}
          name="organisation"
          autoComplete="organization"
          value={values.organisation}
          onChange={set('organisation')}
          error={errors.organisation}
          required={commercial}
          optional={!commercial}
        />
        {/* A viewing date means nothing on a commercial enquiry — that
            conversation starts with a call, not a slot. */}
        {commercial ? null : (
          <Field
            label="Preferred viewing"
            name="preferredDate"
            type="date"
            value={values.preferredDate}
            onChange={set('preferredDate')}
            optional
          />
        )}
      </div>

      <Field
        label="Message"
        name="message"
        multiline
        value={values.message}
        onChange={set('message')}
        error={errors.message}
        required
        hint={`${values.message.length}/${MAX_MESSAGE_LENGTH} characters`}
      />

      {status.kind === 'failed' ? (
        <p role="alert" className="text-sm text-red-400">
          {status.message ?? "We couldn't send your request. Please try again"}
          {SITE.contact.email ? (
            <>
              , or email{' '}
              <a href={`mailto:${SITE.contact.email}`} className="text-gold underline">
                {SITE.contact.email}
              </a>
            </>
          ) : null}
          .
        </p>
      ) : null}

      <div className="flex items-center gap-5">
        <Button type="submit" disabled={status.kind === 'sending'} magnetic>
          {status.kind === 'sending'
            ? 'Sending…'
            : commercial
              ? 'Request a private demo'
              : 'Request private viewing'}
        </Button>
        <p role="status" aria-live="polite" className="text-stone text-xs">
          {status.kind === 'sending' ? 'Submitting your enquiry…' : 'Secure enquiry — no spam'}
        </p>
      </div>
    </form>
  );
}

export default EnquiryForm;
