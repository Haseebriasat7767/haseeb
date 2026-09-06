'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { SITE } from '@/lib/constants/site';
import {
  submitEnquiry,
  validateEnquiry,
  type Enquiry,
  type EnquiryErrors,
} from '@/lib/contact/enquiry';
import { Field } from './Field';

const EMPTY: Enquiry = { name: '', email: '', phone: '', preferredDate: '', message: '' };

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent' }
  | { kind: 'unconfigured'; mailto: string }
  | { kind: 'undeliverable'; body: string }
  | { kind: 'failed' };

/**
 * The enquiry form. Validation, error, loading, and success states are all
 * real; delivery is the one thing this repository cannot do on its own,
 * because it has no backend. Rather than fake a submission, an unconfigured
 * build hands the completed enquiry to the visitor's mail client and says
 * so — see `lib/contact/enquiry.ts` for the single integration point.
 */
export function EnquiryForm() {
  const [values, setValues] = useState<Enquiry>(EMPTY);
  const [errors, setErrors] = useState<EnquiryErrors>({});
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const set = (key: keyof Enquiry) => (event: { target: { value: string } }) => {
    setValues((current) => ({ ...current, [key]: event.target.value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const found = validateEnquiry(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setStatus({ kind: 'sending' });

    try {
      const result = await submitEnquiry(values, SITE.contact.email);
      setStatus(
        result.status === 'sent'
          ? { kind: 'sent' }
          : result.status === 'unconfigured'
            ? { kind: 'unconfigured', mailto: result.mailto }
            : { kind: 'undeliverable', body: result.body },
      );
    } catch {
      setStatus({ kind: 'failed' });
    }
  }

  if (status.kind === 'sent') {
    return (
      <div role="status" className="border-alabaster/10 flex flex-col gap-4 border p-8">
        <p className="text-eyebrow text-gold uppercase">Enquiry received</p>
        <p className="font-display text-alabaster text-2xl font-light">Thank you.</p>
        <p className="text-mist text-sm leading-relaxed">
          A member of the team will respond with the full architectural dossier and a proposed
          viewing time.
        </p>
      </div>
    );
  }

  if (status.kind === 'unconfigured') {
    return (
      <div role="status" className="border-alabaster/10 flex flex-col gap-5 border p-8">
        <p className="text-eyebrow text-gold uppercase">Ready to send</p>
        <p className="font-display text-alabaster text-2xl font-light">Your enquiry is composed.</p>
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
    // Neither an endpoint nor an enquiry address is configured. Saying so
    // plainly and handing the visitor their own composed message is the
    // only honest ending: a "thank you" here would be a message that was
    // never going anywhere, which is the one failure a buyer never forgives.
    return (
      <div role="status" className="border-alabaster/10 flex flex-col gap-5 border p-8">
        <p className="text-eyebrow text-gold uppercase">Enquiry ready</p>
        <p className="font-display text-alabaster text-2xl font-light">
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
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-8">
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
          optional
        />
        <Field
          label="Preferred viewing"
          name="preferredDate"
          type="date"
          value={values.preferredDate}
          onChange={set('preferredDate')}
          optional
        />
      </div>

      <Field
        label="Message"
        name="message"
        multiline
        value={values.message}
        onChange={set('message')}
        error={errors.message}
        required
      />

      {status.kind === 'failed' ? (
        <p role="alert" className="text-sm text-red-400">
          The enquiry could not be sent. Please try again
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
          {status.kind === 'sending' ? 'Sending…' : 'Request private viewing'}
        </Button>
        <p aria-live="polite" className="text-stone text-xs">
          {status.kind === 'sending' ? 'Submitting your enquiry…' : ''}
        </p>
      </div>
    </form>
  );
}

export default EnquiryForm;
