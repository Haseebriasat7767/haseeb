import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/LegalPage';
import { SITE } from '@/lib/constants/site';

export const metadata: Metadata = {
  alternates: { canonical: '/terms' },
  title: 'Terms',
  description:
    'The terms on which this site is provided, and what its imagery does and does not represent.',
};

/**
 * Terms of use.
 *
 * The clause that matters here is the one about the imagery. Every render on
 * this site is generated from a model rather than photographed, and the
 * project has been careful to say so throughout — this is the same statement
 * in the place a buyer's solicitor would look for it. A property site whose
 * pictures are computer-generated and does not say so is making a
 * representation it cannot support.
 */
export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Terms"
      title="Terms of use"
      lede="The basis on which this site is provided, and what its imagery is."
      updated="September 2026"
    >
      <h2>The imagery is generated, not photographed</h2>
      <p>
        Every view on this site is rendered in real time from a three-dimensional model. Nothing
        here is a photograph of a completed building. Materials, light, planting and furniture are
        an artistic impression of an intended finish, and the finish actually delivered may differ.
      </p>
      <p>
        Dimensions, layouts and areas shown are indicative and are not a substitute for a measured
        survey, a floor plan issued by the seller, or any contract document.
      </p>

      <h2>Nothing here is an offer</h2>
      <p>
        The material on this site is provided for information. It does not form part of any
        contract, and it is not an offer, an invitation to treat, or a representation on which any
        person should rely when deciding to buy. Any transaction proceeds on the terms of its own
        contract and on the buyer&rsquo;s own enquiries, survey and legal advice.
      </p>

      <h2>Availability</h2>
      <p>
        We try to keep the site available and correct, and cannot guarantee either. It may be
        unavailable while it is maintained, and details may change without notice.
      </p>

      <h2>The site itself</h2>
      <p>
        The design, the code, the three-dimensional model and all imagery on this site are original
        works and remain the property of their owner. You are welcome to look at them, link to them
        and share them. You may not copy, redistribute or reuse them commercially without written
        permission.
      </p>

      <h2>Third-party links</h2>
      <p>
        Where this site links elsewhere, we are not responsible for what is on the other end of the
        link.
      </p>

      <h2>Contact</h2>
      {SITE.contact.email ? (
        <p>
          <a href={`mailto:${SITE.contact.email}`}>{SITE.contact.email}</a>
        </p>
      ) : (
        <p>
          <strong>
            The operator&rsquo;s contact details have not been published on this deployment.
          </strong>{' '}
          This is a demonstration build. Governing law, the operator&rsquo;s legal name and a
          contact address must be set here before the site is used for a real property, and these
          terms reviewed by a lawyer in that jurisdiction.
        </p>
      )}
    </LegalPage>
  );
}
