import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ViewportPlaceholder } from '@/components/three/ViewportPlaceholder';
import { TowerWalkthrough } from '@/components/tower/TowerWalkthrough';
import { Container } from '@/components/ui/Container';

export const metadata: Metadata = {
  alternates: { canonical: '/tower' },
  title: 'Oceanfront tower',
  description:
    'A twenty-storey oceanfront tower generated entirely in code — five retail levels around a full-height atrium, fifteen floors of apartments above, and an amenity deck between them. Walk it at any hour.',
  openGraph: {
    title: 'Oceanfront tower — AURELIA',
    description:
      'Twenty storeys, five of retail and fifteen of residences, walked from the plaza to a balcony at sunset.',
  },
};

export default function TowerPage() {
  return (
    <>
      {/* The view first and full bleed, as the explorer does: the building
          is the argument, and a heading above it would push it off the
          first screen. */}
      {/* `useSearchParams` needs a boundary, and reading it bails the whole
          subtree out of server rendering — so this fallback is not a brief
          flash, it is everything a visitor sees until the client bundle
          arrives and hydrates. An empty div of the right height held the
          layout and showed a black rectangle for the duration, which on a
          phone on mobile data reads as a broken page. */}
      <Suspense
        fallback={
          <div className="relative h-[86svh] w-full">
            <ViewportPlaceholder />
          </div>
        }
      >
        <TowerWalkthrough />
      </Suspense>

      <Container>
        <div className="max-w-[62ch] py-16 lg:py-24">
          <p className="text-eyebrow text-gold uppercase">A second building</p>
          <h1 className="text-display-md font-display text-alabaster mt-5 font-light">
            Twenty storeys, generated in code
          </h1>
          <p className="text-lede text-mist mt-6">
            Five retail levels wrapped around an atrium that runs the full height of the podium to a
            roof light, fifteen floors of apartments above it, and the amenity deck on the roof
            between the two. Every balcony, fin, slab edge and shopfront is a pure function of one
            configuration object — there is no model file and no photograph anywhere in it.
          </p>
          <p className="text-lede text-mist mt-5">
            It shares the residence&rsquo;s renderer completely: the same materials, the same
            merged-geometry primitives, the same time-of-day rig and the same finishing chain. What
            is new is only what a building on a beach actually needs — an ocean written at swell
            scale rather than pool scale, a beach that falls to the water, and palms.
          </p>
          <p className="text-mist/70 mt-8 text-sm">
            The site is fictional and unlocated. It is composed for the light rather than surveyed:
            the sun at golden hour sits low over the water on the building&rsquo;s ocean elevation,
            which is what puts the sunset in front of the balconies.
          </p>
        </div>
      </Container>
    </>
  );
}
