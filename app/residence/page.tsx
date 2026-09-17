import type { Metadata } from 'next';
import { ResidenceExplorer } from '@/components/explorer/ResidenceExplorer';
import { parseExplorerTab } from '@/components/explorer/explorer-tabs';

const CANONICAL_PATH = '/residence';

export const metadata: Metadata = {
  // A local const rather than repeating the path: `alternates.canonical`
  // and `openGraph.url` have to agree, and a route only ever moves once.
  alternates: { canonical: CANONICAL_PATH },
  title: 'The Residence',
  description:
    'The architectural concept, material palette, full accommodation schedule, floor plans and gallery of Residence No. 01 at Coastal Ridge — walkable space by space, under any hour of the day.',
  openGraph: {
    url: CANONICAL_PATH,
    // Every route lost its social card the moment it defined its own
    // `openGraph` object: Next does not deep-merge that field across the
    // segment tree, so this object fully replaced the root layout's —
    // taking `url`, `siteName` and the auto-attached image with it. The
    // path is relative and resolves against the same `metadataBase` the
    // root layout sets, so nothing here names a domain.
    images: ['/opengraph-image'],
    title: 'The Residence — AURELIA',
    description:
      'Architectural concept, accommodation schedule, floor plans and gallery of Residence No. 01.',
  },
};

/**
 * Why this route reads `searchParams` rather than leaving `?tab=` to the
 * client.
 *
 * `DeepLinkedSpace` still applies the query after hydration, and for every
 * tab but one that is invisible. `explore` is the exception: it is the only
 * tab with a full-bleed canvas above the content, so switching to it after
 * first paint drops an 86svh block into the flow and pushes everything
 * below it down — a measured layout shift of 0.575 on `?tab=explore`,
 * against 0.000 on `/residence` and 0.032 on `?tab=plan`. Poor, by a factor
 * of two, on the page the site's own redirects (`/experience`, `/gallery`,
 * `/floor-plan`) and the tour's hand-off links all land on.
 *
 * Seeding the tab on the server means the first paint already has the hero
 * and the content in their final places. The cost is that the route renders
 * per request instead of being prerendered; it is a page whose body is a
 * client component either way, and nothing here is expensive to render.
 */
export default async function ResidencePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tab } = await searchParams;
  return <ResidenceExplorer initialTab={parseExplorerTab(tab) ?? 'overview'} />;
}
