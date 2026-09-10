import type { Metadata } from 'next';
import { AgentCard } from '@/components/contact/AgentCard';
import { DirectChannels } from '@/components/contact/DirectChannels';
import { EnquiryForm } from '@/components/contact/EnquiryForm';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';

const CANONICAL_PATH = '/contact';

export const metadata: Metadata = {
  // A local const rather than repeating the path: `alternates.canonical`
  // and `openGraph.url` have to agree, and a route only ever moves once.
  alternates: { canonical: CANONICAL_PATH },
  title: 'Contact',
  description:
    'Arrange a private viewing of the residence at Coastal Ridge with the private client team.',
  openGraph: {
    url: CANONICAL_PATH,
    // Every route lost its social card the moment it defined its own
    // `openGraph` object: Next does not deep-merge that field across the
    // segment tree, so this object fully replaced the root layout's —
    // taking `url`, `siteName` and the auto-attached image with it. The
    // path is relative and resolves against the same `metadataBase` the
    // root layout sets, so nothing here names a domain.
    images: ['/opengraph-image'],
    title: 'Contact — AURELIA',
    description: 'Arrange a private viewing of the residence at Coastal Ridge.',
  },
};

export default function ContactPage() {
  return (
    <>
      <PageHeader
        eyebrow="Contact"
        title="Arrange an introduction"
        lede="Viewings are held by appointment only. Share your details and the private
          client team will respond with the full architectural dossier and a proposed
          time."
      />

      <Container className="pb-section grid gap-16 lg:grid-cols-12 lg:gap-20">
        <div className="flex flex-col gap-8 lg:col-span-7">
          <EnquiryForm />
          {/* Always on screen, never behind a failure state: a form has more
              ways to fail than to succeed, and a lost enquiry costs more
              than the whole site. */}
          <DirectChannels />
        </div>

        <div className="lg:col-span-5">
          <AgentCard />
        </div>
      </Container>
    </>
  );
}
