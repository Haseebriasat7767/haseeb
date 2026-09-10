import { CLIENT, mailtoLink, whatsappLink } from '@/lib/constants/client';

/**
 * The ways to reach a human that do not depend on the form working.
 *
 * ## Why it is always on screen
 *
 * A form has more ways to fail than it has ways to succeed: a delivery
 * provider outage, an expired key, a mis-set variable, a visitor whose
 * network drops the POST. Every one of those loses an enquiry silently,
 * and at this price point one lost enquiry costs more than the whole site.
 * These channels bypass all of it — plain text a visitor can read, copy or
 * tap, whether or not any server is reachable.
 *
 * ## Why it can still be empty
 *
 * Each channel renders only when its variable is set. A WhatsApp button
 * pointing at a number nobody owns is worse than no button: it looks like
 * a working channel right up to the moment it swallows an enquiry. So an
 * unconfigured deployment shows the operator what to set instead of
 * showing a visitor something broken.
 */
export function DirectChannels() {
  const mailto = mailtoLink('Enquiry from the AURELIA site');
  const whatsapp = whatsappLink(
    'Hello — I saw the AURELIA site and would like to talk about a project.',
  );
  const { agent } = CLIENT;

  const hasAny = Boolean(mailto || whatsapp);

  return (
    <div className="border-alabaster/10 bg-alabaster/[0.03] flex flex-col gap-4 border p-6">
      <p className="text-eyebrow text-stone uppercase">Or reach us directly</p>

      {hasAny ? (
        <>
          <p className="text-mist text-sm leading-relaxed">
            If the form gives you any trouble, these reach us just as well.
          </p>
          <div className="flex flex-col gap-2.5">
            {agent.email ? (
              <a
                href={mailto ?? `mailto:${agent.email}`}
                data-cursor="link"
                className="text-alabaster hover:text-gold text-sm break-all transition-colors"
              >
                {agent.email}
              </a>
            ) : null}
            {whatsapp && agent.phone ? (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                data-cursor="link"
                className="text-alabaster hover:text-gold text-sm transition-colors"
              >
                WhatsApp {agent.phone}
              </a>
            ) : null}
          </div>
        </>
      ) : (
        /* Addressed to whoever deploys this, not to a visitor — and it is
           deliberately plain rather than styled as a channel, so nobody
           mistakes it for one. */
        <p className="text-stone text-sm leading-relaxed">
          No direct channel is published yet. Set <code>NEXT_PUBLIC_ENQUIRY_EMAIL</code> and{' '}
          <code>NEXT_PUBLIC_ENQUIRY_PHONE</code> to show an email address and a WhatsApp link here,
          so an enquiry can still reach you if the form ever fails.
        </p>
      )}
    </div>
  );
}

export default DirectChannels;
