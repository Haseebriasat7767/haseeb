import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/LegalPage';
import { SITE } from '@/lib/constants/site';

export const metadata: Metadata = {
  alternates: { canonical: '/accessibility' },
  title: 'Accessibility',
  description:
    'What has been tested on this site, what conforms, and what is known not to — including the limits of the 3D walkthrough.',
};

/**
 * An accessibility statement is only worth publishing if it is accurate, so
 * this one says what was actually measured and names what is still missing.
 * Every conformance claim below is backed by an axe-core run against the
 * production build; anything not covered by that run is listed as untested
 * rather than quietly folded into the claim.
 */
export default function AccessibilityPage() {
  return (
    <LegalPage
      eyebrow="Accessibility"
      title="Accessibility statement"
      lede="This page records what has been tested on this site, what currently
        conforms, and — just as importantly — what does not."
      updated="September 2026"
    >
      <h2>The standard we are working to</h2>
      <p>
        The target is <strong>WCAG 2.2 Level AA</strong>. That is also the standard the European
        Accessibility Act has required of consumer-facing services since 28 June 2025.
      </p>

      <h2>What has been tested</h2>
      <p>
        Every page listed below was audited with axe-core against a production build, using the
        combined <em>wcag2a</em>, <em>wcag2aa</em>, <em>wcag21a</em>, <em>wcag21aa</em> and{' '}
        <em>wcag22aa</em> rule sets. All nine pages currently return{' '}
        <strong>zero violations</strong>:
      </p>
      <ul>
        <li>Home, Tower, Experience, Residence</li>
        <li>Floor plan, Gallery, Contact</li>
        <li>Privacy, Terms</li>
      </ul>
      <p>
        Alongside that, the following hold by construction and were checked by hand in the source:
        colour pairs are chosen against a measured contrast ratio rather than by eye; motion —
        parallax, camera drift and the scroll-driven reveals — is disabled when the operating system
        reports <em>prefers-reduced-motion</em>; and the 3D views fall back to a described notice
        rather than a blank rectangle when WebGL is unavailable.
      </p>

      <h2>What has not been tested</h2>
      <p>
        Automated tools detect only a portion of the WCAG success criteria — roughly a third, on the
        most generous published estimates. A clean axe run is therefore a floor, not a certificate.
        Specifically, none of the following has been carried out:
      </p>
      <ul>
        <li>Manual testing with a screen reader (NVDA, JAWS or VoiceOver).</li>
        <li>Testing with speech input, screen magnification or a switch device.</li>
        <li>Testing with people who have disabilities.</li>
        <li>An independent third-party audit.</li>
      </ul>
      <p>
        Until those are done, this site should be described as{' '}
        <em>substantially conforming on automated criteria</em>, and not as fully WCAG 2.2 AA
        conformant.
      </p>

      <h2>Known limitations</h2>
      <ul>
        <li>
          <strong>The walkthrough is not operable by screen reader.</strong> Walk mode can now be
          driven three ways — the movement keys, with <em>Q</em>, <em>E</em>, <em>R</em> and{' '}
          <em>F</em> to turn and look; a mouse; or two thumb sticks on a touch screen — so it no
          longer requires a pointer and no longer excludes phones and tablets. What it still cannot
          do is describe itself: a visitor using a screen reader is told the frame&rsquo;s subject
          and nothing about what is in it.
        </li>
        <li>
          <strong>The thumb sticks are pointer-only.</strong> They mirror controls that already
          exist on the keyboard, so they are hidden from assistive technology rather than exposed as
          two unlabelled drag targets a screen reader could not operate.
        </li>
        <li>
          <strong>The 3D views are announced, not transcribed.</strong> Each rendered frame carries
          a text label describing the view, but the scene itself is not navigable by assistive
          technology. The floor plan page presents the same layout as structured, labelled drawings,
          and is the accessible route to that information.
        </li>
        <li>
          <strong>The walkthrough is demanding on hardware.</strong> Quality is reduced
          automatically on weaker devices, but on older hardware the experience may still be slow.
        </li>
      </ul>

      <h2>Feedback</h2>
      {SITE.contact.email ? (
        <p>
          If you meet a barrier on this site, please write to{' '}
          <a href={`mailto:${SITE.contact.email}`}>{SITE.contact.email}</a> and describe what
          happened and what you were using. Reports of accessibility barriers are treated as faults,
          not as feature requests.
        </p>
      ) : (
        <p>
          <strong>This section is not yet complete.</strong> An accessibility statement must give a
          monitored contact route for reporting barriers, and no contact address has been configured
          for this deployment. Before this site is published, the operator must set one and name it
          here, together with the response time they undertake to meet. Until then the{' '}
          <a href="/contact">enquiry form</a> is the only route available.
        </p>
      )}
    </LegalPage>
  );
}
