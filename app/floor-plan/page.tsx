import type { Metadata } from 'next';
import { FloorPlan } from '@/components/plan/FloorPlan';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = {
  title: 'Architecture',
  description:
    'Drawn plans of both levels of the residence, projected from the same room schedule that generates the real-time model.',
  openGraph: {
    title: 'Architecture — AURELIA',
    description: 'Drawn plans of both levels, projected from the generated room schedule.',
  },
};

export default function FloorPlanPage() {
  return (
    <>
      <PageHeader
        dense
        eyebrow="Architecture"
        title="Plans and levels"
        lede="Two levels stepped onto the ridge. These outlines are projected from the same
          room schedule the three-dimensional model is generated from — the drawing and
          the building are the same description."
      />

      <Container className="pb-section">
        <FloorPlan />
      </Container>
    </>
  );
}
