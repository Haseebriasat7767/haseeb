import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ResidenceExplorer } from '@/components/explorer/ResidenceExplorer';

export const metadata: Metadata = {
  title: 'Explore',
  description:
    'Move through the residence space by space — foyer, living room, kitchen, stair hall, master suite, library, terrace, and pool — under any hour of the day.',
  openGraph: {
    title: 'Explore the residence — AURELIA',
    description: 'Move through the residence space by space, under any hour of the day.',
  },
};

export default function ExperiencePage() {
  return (
    <>
      {/*
        The view comes first, and it comes full bleed.
        
        A page header above the frame pushed the residence below the fold
        and left a visitor's first screen as a heading and a paragraph. The
        genre this page belongs to opens on the architecture and captions it
        in place — the plate over the view already names the space, so the
        heading has nothing to do until the visitor has looked. It now sits
        underneath, introducing the rail rather than the image.
      */}
      <Suspense fallback={<div className="h-[86svh] w-full" aria-hidden="true" />}>
        <ResidenceExplorer />
      </Suspense>
    </>
  );
}
