import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ResidenceExplorer } from '@/components/explorer/ResidenceExplorer';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = {
  title: 'Explore',
  description:
    'Move through the residence space by space in real time — foyer, living room, kitchen, stair hall, master suite, library, terrace, and pool — under any hour of the day.',
  openGraph: {
    title: 'Explore the residence — AURELIA',
    description:
      'Move through the residence space by space in real time, under any hour of the day.',
  },
};

export default function ExperiencePage() {
  return (
    <>
      <PageHeader
        dense
        eyebrow="Explore"
        title="The residence, space by space"
        lede="Every space below is a framing of the same live model. Select one to move the
          camera to it — nothing reloads, and nothing is pre-rendered."
      />

      <Container className="pb-section">
        <Suspense fallback={<div className="h-[68svh] w-full" aria-hidden="true" />}>
          <ResidenceExplorer />
        </Suspense>
      </Container>
    </>
  );
}
