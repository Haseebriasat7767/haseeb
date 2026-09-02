import type { Metadata } from 'next';
import { EnquiryForm } from '@/components/contact/EnquiryForm';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';
import { SITE } from '@/lib/constants/site';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Arrange a private viewing of the residence at Coastal Ridge, or reach the team directly.',
  openGraph: {
    title: 'Contact — AURELIA',
    description: 'Arrange a private viewing of the residence at Coastal Ridge.',
  },
};

const CHANNELS = [
  { label: 'Enquiries', value: SITE.contact.email, href: `mailto:${SITE.contact.email}` },
  { label: 'Telephone', value: SITE.contact.phone, href: `tel:${SITE.contact.phone}` },
  { label: 'Location', value: SITE.contact.address },
] as const;

export default function ContactPage() {
  return (
    <>
      <PageHeader
        eyebrow="Contact"
        title="Arrange an introduction"
        lede="Viewings are held by appointment only. Share your details below, or reach the
          team directly through any of the channels listed."
      />

      <Container className="pb-section grid gap-16 lg:grid-cols-12 lg:gap-20">
        <div className="lg:col-span-7">
          <EnquiryForm />
        </div>

        <div className="lg:col-span-5">
          <dl className="border-alabaster/10 flex flex-col border-t">
            {CHANNELS.map((channel) => (
              <div
                key={channel.label}
                className="border-alabaster/10 flex flex-col gap-2 border-b py-6"
              >
                <dt className="text-eyebrow text-stone uppercase">{channel.label}</dt>
                <dd className="font-display text-alabaster text-xl font-light">
                  {'href' in channel && channel.href ? (
                    <a href={channel.href} className="hover:text-gold transition-colors">
                      {channel.value}
                    </a>
                  ) : (
                    channel.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </Container>
    </>
  );
}
