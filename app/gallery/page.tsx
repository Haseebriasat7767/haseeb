import type { Metadata } from 'next';
import { Gallery } from '@/components/gallery/Gallery';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = {
  title: 'Gallery',
  description:
    'Eleven framings of the residence, each opening as a live view, under any hour from morning to night.',
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
