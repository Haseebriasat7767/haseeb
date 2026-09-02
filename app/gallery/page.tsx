import type { Metadata } from 'next';
import { Gallery } from '@/components/gallery/Gallery';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = {
  title: 'Gallery',
  description:
    'Eleven framings of the residence, each rendered live at the moment you open it, under any hour from morning to night.',
  openGraph: {
    title: 'Gallery — AURELIA',
    description: 'Framings of the residence, rendered live under any hour from morning to night.',
  },
};

export default function GalleryPage() {
  return (
    <>
      <PageHeader
        dense
        eyebrow="Gallery"
        title="Framings of the residence"
        lede="There is no photography here, because there is no photograph to take — every
          frame below is rendered live from the model when you open it. Choose an hour
          and the whole set changes with it."
      />

      <Container className="pb-section">
        <Gallery />
      </Container>
    </>
  );
}
