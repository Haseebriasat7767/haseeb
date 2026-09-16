import { PanoRenderClient } from '@/components/render/PanoRenderClient';

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
