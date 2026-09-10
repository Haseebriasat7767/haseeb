import type { Metadata } from 'next';
import { Gallery } from '@/components/gallery/Gallery';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';
import { SPACES } from '@/lib/experience/spaces';

export const metadata: Metadata = {
  alternates: { canonical: '/gallery' },
  title: 'Gallery',
  // Counted, not written. This said "Eleven" against a gallery that renders
  // seventeen, because the number was typed once and the space list grew
  // afterwards — exactly the drift the property figures were fixed for.
  // The gallery maps `SPACES` unfiltered, so the length is the count.
  description: `${SPACES.length} framings of the residence, each opening as a live view, under any hour from morning to night.`,
  openGraph: {
    title: 'Gallery — AURELIA',
    description: 'Framings of the residence, under any hour from morning to night.',
  },
};

export default function GalleryPage() {
  return (
    <>
      <PageHeader
        dense
        eyebrow="Gallery"
        title="Framings of the residence"
        lede="These are not photographs. Each framing opens as a live view of the
          residence — choose an hour, and the whole set answers to it."
      />

      <Container className="pb-section">
        <Gallery />
      </Container>
    </>
  );
}
