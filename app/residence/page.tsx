import type { Metadata } from 'next';
import { ResidenceExplorer } from '@/components/explorer/ResidenceExplorer';

const CANONICAL_PATH = '/residence';

export const metadata: Metadata = {
  // A local const rather than repeating the path: `alternates.canonical`
  // and `openGraph.url` have to agree, and a route only ever moves once.
  alternates: { canonical: CANONICAL_PATH },
  title: 'The Residence',
  description:
    'The architectural concept, material palette, full accommodation schedule, floor plans and gallery of Residence No. 01 at Coastal Ridge — walkable space by space, under any hour of the day.',
  openGraph: {
    url: CANONICAL_PATH,
    // Every route lost its social card the moment it defined its own
    // `openGraph` object: Next does not deep-merge that field across the
    // segment tree, so this object fully replaced the root layout's —
    // taking `url`, `siteName` and the auto-attached image with it. The
    // path is relative and resolves against the same `metadataBase` the
    // root layout sets, so nothing here names a domain.
    images: ['/opengraph-image'],
    title: 'The Residence — AURELIA',
    description:
      'Architectural concept, accommodation schedule, floor plans and gallery of Residence No. 01.',
  },
};

export default function ResidencePage() {
  return <ResidenceExplorer />;
}
