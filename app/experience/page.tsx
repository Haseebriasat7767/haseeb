import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ViewportPlaceholder } from '@/components/three/ViewportPlaceholder';
import { ResidenceExplorer } from '@/components/explorer/ResidenceExplorer';

const CANONICAL_PATH = '/experience';

export const metadata: Metadata = {
  // A local const rather than repeating the path: `alternates.canonical`
  // and `openGraph.url` have to agree, and a route only ever moves once.
  alternates: { canonical: CANONICAL_PATH },
  title: 'Explore',
  description:
    'Move through the residence space by space — foyer, living room, kitchen, stair hall, master suite, library, terrace, and pool — under any hour of the day.',
  openGraph: {
    url: CANONICAL_PATH,
    // Every route lost its social card the moment it defined its own
    // `openGraph` object: Next does not deep-merge that field across the
    // segment tree, so this object fully replaced the root layout's —
    // taking `url`, `siteName` and the auto-attached image with it. The
    // path is relative and resolves against the same `metadataBase` the
    // root layout sets, so nothing here names a domain.
    images: ['/opengraph-image'],
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
      <Suspense
        fallback={
          <div className="relative h-[86svh] w-full">
            <ViewportPlaceholder />
          </div>
        }
      >
        <ResidenceExplorer />
      </Suspense>
    </>
  );
}
