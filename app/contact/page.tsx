import type { Metadata } from 'next';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';
import { SITE } from '@/lib/constants/site';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Arrange a private viewing of the residence at Coastal Ridge.',
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
        lede="Viewings are held by appointment only. Reach the team directly through any
          of the channels below."
      />

      <Container className="pb-section">
        <dl className="border-alabaster/10 bg-alabaster/10 grid gap-px border sm:grid-cols-3">
          {CHANNELS.map((channel) => (
            <div key={channel.label} className="bg-obsidian flex flex-col gap-3 p-8">
              <dt className="text-eyebrow text-stone uppercase">{channel.label}</dt>
              <dd className="font-display text-alabaster text-xl font-light sm:text-2xl">
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
      </Container>
    </>
  );
}
