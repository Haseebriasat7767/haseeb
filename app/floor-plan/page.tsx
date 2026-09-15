import type { Metadata } from 'next';
import { ResidenceExplorer } from '@/components/explorer/ResidenceExplorer';

const CANONICAL_PATH = '/floor-plan';

export const metadata: Metadata = {
  // A local const rather than repeating the path: `alternates.canonical`
  // and `openGraph.url` have to agree, and a route only ever moves once.
  alternates: { canonical: CANONICAL_PATH },
  title: 'Architecture',
  description:
    'Drawn plans of both levels of the residence, set to the same room schedule the residence itself is built to.',
  openGraph: {
    url: CANONICAL_PATH,
    // Every route lost its social card the moment it defined its own
    // `openGraph` object: Next does not deep-merge that field across the
    // segment tree, so this object fully replaced the root layout's —
    // taking `url`, `siteName` and the auto-attached image with it. The
    // path is relative and resolves against the same `metadataBase` the
    // root layout sets, so nothing here names a domain.
    images: ['/opengraph-image'],
    title: 'Architecture — AURELIA',
    description: 'Drawn plans of both levels of the residence, level by level.',
  },
};

export default function FloorPlanPage() {
  return <ResidenceExplorer tab="plan" />;
}
