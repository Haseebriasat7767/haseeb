import type { Metadata } from 'next';
import { Gallery } from '@/components/gallery/Gallery';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';
import { SPACES } from '@/lib/experience/spaces';

const CANONICAL_PATH = '/gallery';

export const metadata: Metadata = {
  // A local const rather than repeating the path: `alternates.canonical`
  // and `openGraph.url` have to agree, and a route only ever moves once.
  alternates: { canonical: CANONICAL_PATH },
  title: 'Gallery',
  // Counted, not written. This said "Eleven" against a gallery that renders
  // seventeen, because the number was typed once and the space list grew
  // afterwards — exactly the drift the property figures were fixed for.
  // The gallery maps `SPACES` unfiltered, so the length is the count.
  description: `${SPACES.length} framings of the residence, each opening as a live view, under any hour from morning to night.`,
  openGraph: {
    url: CANONICAL_PATH,
    // Every route lost its social card the moment it defined its own
    // `openGraph` object: Next does not deep-merge that field across the
    // segment tree, so this object fully replaced the root layout's —
    // taking `url`, `siteName` and the auto-attached image with it. The
    // path is relative and resolves against the same `metadataBase` the
    // root layout sets, so nothing here names a domain.
    images: ['/opengraph-image'],
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
