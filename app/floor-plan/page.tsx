import type { Metadata } from 'next';
import { FloorPlan } from '@/components/plan/FloorPlan';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';

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
  return (
    <>
      <PageHeader
        dense
        eyebrow="Architecture"
        title="Plans and levels"
        lede="Two levels stepped onto the ridge. The plans and the residence are drawn
          to one schedule, so what you walk through and what you read here are the
          same description."
      />

      <Container className="pb-section">
        <FloorPlan />
      </Container>
    </>
  );
}
