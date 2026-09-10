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
        them. It is not a profile, and it cannot be turned into one.
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
        collects anything about you.
      </p>

      <h2>Where it goes</h2>
      <p>
        Enquiries are sent straight to our own mailbox over SMTP and are then held in that mailbox.
        There is no third-party form service or email marketing platform in between — nobody
        processes your enquiry but us and the provider that hosts that mailbox. This site is hosted
        by <a href="https://vercel.com">Vercel</a>, which processes the ordinary technical logs any
        web host keeps in order to serve a page.
      </p>
      <p>
        <strong>This section is not yet complete.</strong> The company that hosts our mailbox is a
        processor of your enquiry and has to be named here — as does its country, if it is outside
        the UK and the EU. No mail provider has been configured for this deployment, so there is
        nothing accurate to name. The operator must complete this before the site is published.
      </p>

      <h2>How long it is kept</h2>
      <p>
        Enquiries are kept for as long as the conversation they belong to is live, and then no
        longer. Analytics figures are aggregate counts with nothing in them that identifies anybody.
      </p>

      <h2>Your rights</h2>
      <p>
        If you are in the UK or the EU you may ask for a copy of what we hold about you, ask for it
        to be corrected, or ask for it to be deleted. In practice that means the enquiry you sent,
        because it is the only thing there is. Write to us and we will do it.
      </p>

      <h2>Who to write to</h2>
      {SITE.contact.email ? (
        <p>
          <a href={`mailto:${SITE.contact.email}`}>{SITE.contact.email}</a>
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
    </LegalPage>
  );
}
