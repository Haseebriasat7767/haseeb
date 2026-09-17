/**
 * The explorer's tabs, in a module neither the page nor the client tree has
 * to be a client component to read.
 *
 * `ResidenceExplorer` is `'use client'`, so the route could not import the
 * type or the parser from it without the whole page becoming a client
 * boundary. Splitting them out is what lets `/residence` resolve `?tab=` on
 * the server — see the page for why that matters.
 */
export type ExplorerTab = 'overview' | 'explore' | 'interior' | 'plan' | 'gallery';

/**
 * The tabs a URL may ask for.
 *
 * `interior` is absent deliberately: it is offered only when rooms have been
 * rendered, so a link to it is a link to a tab that may not exist in this
 * build. Every other tab is always there.
 */
const DEEP_LINK_TABS: readonly ExplorerTab[] = ['overview', 'explore', 'plan', 'gallery'];

/** The tab a `?tab=` value names, or `null` if it names none. */
export function parseExplorerTab(value: string | string[] | undefined | null): ExplorerTab | null {
  // `searchParams` hands back an array when the key is repeated. The first
  // value is the one a browser's own `URLSearchParams.get` would return, so
  // the server and the client agree on which one wins.
  const first = Array.isArray(value) ? value[0] : value;
  if (!first) return null;
  return (DEEP_LINK_TABS as readonly string[]).includes(first) ? (first as ExplorerTab) : null;
}
