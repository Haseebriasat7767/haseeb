import type { Metadata } from 'next';
import { AgentCard } from '@/components/contact/AgentCard';
import { EnquiryForm } from '@/components/contact/EnquiryForm';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Arrange a private viewing of the residence at Coastal Ridge with the private client team.',
  openGraph: {
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
        <div className="lg:col-span-7">
          <EnquiryForm />
        </div>

        <div className="lg:col-span-5">
          <AgentCard />
        </div>
      </Container>
    </>
  );
}
