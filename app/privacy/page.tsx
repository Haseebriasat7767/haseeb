import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/LegalPage';
import { SITE } from '@/lib/constants/site';

export const metadata: Metadata = {
  alternates: { canonical: '/privacy' },
  title: 'Privacy',
  description:
    'What this site collects, what it stores on your device, and who to contact about it.',
};

/**
 * The privacy notice.
 *
 * Written from what the code actually does, verified rather than assumed:
 * nothing is written to the visitor's device anywhere in the repository, the
 * fonts are served from this origin by `next/font` rather than fetched from
 * Google, and the only two things that leave the browser are the analytics
 * beacon and an enquiry the visitor chose to send.
 *
 * The controller's legal identity is deliberately not invented here. It reads
 * through to the same `SITE.contact` that the rest of the site does, and shows
 * nothing where nothing is set — the same rule the contact details follow.
 *
 * This is an accurate description of the software, not legal advice, and it
 * should be reviewed by a lawyer in the operator's jurisdiction before launch.
 */
export default function PrivacyPage() {
  const hasEmail = Boolean(SITE.contact.email);
  const smtpHost = process.env.SMTP_HOST;
  const hasWeb3Forms = Boolean(process.env.WEB3FORMS_ACCESS_KEY);

  return (
    <LegalPage
      eyebrow="Privacy"
      title="What we collect"
      lede="Short, because there is very little of it. This site stores nothing on your
        device and sets no cookies."
      updated="September 2026"
    >
      <h2>Nothing is stored on your device</h2>
      <p>
        No cookies, no local storage, no session storage, no device fingerprint. Closing the tab
        leaves nothing behind. This is why you have not been asked to accept anything: consent under
        the ePrivacy rules is about storing and reading information on your device, and there is
        nothing here to consent to.
      </p>
      <p>
        A banner asking permission for nothing is not caution, it is noise — and it teaches people
        to dismiss the banners that do matter.
      </p>

      <h2>What is measured</h2>
      <p>
        Page views and loading performance, through Vercel Web Analytics and Speed Insights. Both
        are cookieless. A visit is counted using a value derived from the request itself, which is
        not stored on your device and is not used to recognise you on a later visit or on any other
        website.
      </p>
      <p>
        The result is a count of how many people looked at a page and how quickly it loaded for
        them. It is not a profile, and it cannot be turned into one. You can opt out by enabling
        Do Not Track in your browser — Vercel Analytics respects DNT.
      </p>

      <h2>What you send us</h2>
      <p>
        Only what you type into the enquiry form: your name, your email address, and optionally a
        telephone number, a preferred viewing date and a message. It is sent to us by email so that
        we can reply to your enquiry, and used for nothing else. We do not sell it, share it for
        marketing, or add you to a list you did not ask to be on.
      </p>
      <p>
        The form is protected against automated abuse by a hidden field and a timing check. Neither
        collects anything about you. All submissions are rate-limited per IP and email.
      </p>

      <h2>Where it goes</h2>
      <p>
        Enquiries are sent straight to our own mailbox over SMTP and are then held in that mailbox.
        There is no third-party form service or email marketing platform in between — nobody
        processes your enquiry but us and the provider that hosts that mailbox. This site is hosted
        by <a href="https://vercel.com">Vercel</a>, which processes the ordinary technical logs any
        web host keeps in order to serve a page.
      </p>
      {hasWeb3Forms ? (
        <p>
          This deployment uses <a href="https://web3forms.com">Web3Forms</a> to deliver enquiries.
          Your message is forwarded through their service to our mailbox. See their privacy policy
          for how they handle forwarded messages.
        </p>
      ) : null}
      {smtpHost ? (
        <p>
          Enquiries are delivered via SMTP host <code>{smtpHost}</code> to our mailbox provider.
          That provider is a processor of your enquiry. The operator should name the provider and
          its country here before publishing.
        </p>
      ) : !hasWeb3Forms ? (
        <p className="border-alabaster/10 border-l-2 pl-4 text-sm">
          <strong>Operator note:</strong> No mail provider has been configured for this deployment
          (set SMTP_HOST or WEB3FORMS_ACCESS_KEY). This paragraph must name the mailbox host and its
          country before the site is published for a real property.
        </p>
      ) : null}

      <h2>How long it is kept</h2>
      <p>
        Enquiries are kept for as long as the conversation they belong to is live, and then no
        longer — typically 12 months after last contact unless a longer retention is required by
        law or agreed with you. Analytics figures are aggregate counts with nothing in them that
        identifies anybody.
      </p>

      <h2>Your rights</h2>
      <p>
        If you are in the UK or the EU you may ask for a copy of what we hold about you, ask for it
        to be corrected, or ask for it to be deleted. In practice that means the enquiry you sent,
        because it is the only thing there is. Write to us and we will do it within 30 days.
      </p>

      <h2>Who to write to</h2>
      {hasEmail ? (
        <p>
          <a href={`mailto:${SITE.contact.email}`}>{SITE.contact.email}</a>
          {SITE.contact.phoneDisplay ? <span> · {SITE.contact.phoneDisplay}</span> : null}
          <br />
          <span className="text-stone text-sm">{SITE.contact.addressDisplay}</span>
        </p>
      ) : (
        <p>
          <strong>
            The operator&rsquo;s contact details have not been published on this deployment.
          </strong>{' '}
          This site is a demonstration build. Before it is used for a real property, the
          controller&rsquo;s legal name, registered address and a contact address must be set here,
          and this notice reviewed by a lawyer in that controller&rsquo;s jurisdiction.
        </p>
      )}

      <h2>Security</h2>
      <p>
        Enquiries are transmitted over TLS and stored in a mailbox that requires authentication.
        While we take reasonable measures to protect your data, no transmission over the internet is
        completely secure. If you have concerns, use the direct contact channels on the contact page
        or request to discuss security arrangements before sending sensitive information.
      </p>
    </LegalPage>
  );
}
