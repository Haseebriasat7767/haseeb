import type { Metadata } from 'next';
import { PanoRenderClient } from '@/components/render/PanoRenderClient';

/**
 * Kept out of the index.
 *
 * The route inherits `robots: { index: true }` from the root layout, which
 * is right for every page a visitor is meant to see and wrong for this one:
 * it is a chrome-free square that renders one cube face of one room, and
 * indexed it would put a black rectangle with no copy on it into search
 * results under this site's name. Not being linked or in the sitemap is not
 * protection — a crawler reaches any URL it is given, and this one is handed
 * out by the render job's own logs and by deployment tooling.
 *
 * `robots.ts` disallows the path as well. The two do different jobs: the
 * disallow asks a well-behaved crawler not to fetch it, and this tag tells
 * one that fetched it anyway not to index it.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * The render job's entry point. Not linked from anywhere and not in the
 * sitemap: it exists so `scripts/render-panoramas.mjs` has a square,
 * chrome-free surface to point a cube face at.
 *
 * The bridge is dynamically imported with `ssr: false` — through a client
 * boundary, which is where next requires that flag to live — for the same
 * reason `ExperienceViewport` does it: three stays out of every shared
 * chunk, so this route costs the rest of the site nothing.
 */
export default async function RenderPanoramaPage({
  searchParams,
}: {
  searchParams: Promise<{ space?: string; building?: string; trace?: string }>;
}) {
  const { space, building, trace } = await searchParams;

  return (
    <main className="bg-obsidian fixed inset-0 h-screen w-screen overflow-hidden">
      <PanoRenderClient
        spaceId={space ?? ''}
        building={building === 'tower' ? 'tower' : 'residence'}
        trace={trace !== 'off'}
      />
    </main>
  );
}
