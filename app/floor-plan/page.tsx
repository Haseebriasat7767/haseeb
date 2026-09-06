import type { Metadata } from 'next';
import { FloorPlan } from '@/components/plan/FloorPlan';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = {
  title: 'Architecture',
  description:
    'Drawn plans of both levels of the residence, set to the same room schedule the residence itself is built to.',
  openGraph: {
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
