'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import type { ExplorerTab } from './ResidenceExplorer';

const TABS: readonly ExplorerTab[] = ['overview', 'explore', 'plan', 'gallery'];

/**
 * Applies `?space=<id>` and `?tab=<id>` to the explorer.
 *
 * This exists to be small. `useSearchParams` opts a component out of static
 * server rendering, and Next applies that to the whole nearest Suspense
 * boundary — so reading it inside `ResidenceExplorer` meant the page's HTML
 * contained no heading, no rail and no copy, only a placeholder, until
 * JavaScript ran. A crawler reading the document saw an empty page.
 *
 * Confined to a leaf that renders `null`, the bail-out costs nothing: the
 * heading and content around it render on the server as before, and only
 * this component waits for the client. Rendered unconditionally — not just
 * inside the `explore` tab — because `?tab=plan` has to be read before any
 * tab is showing, and `/floor-plan` and `/gallery` redirect here carrying
 * exactly that.
 */
export function DeepLinkedSpace({
  onSpace,
  onTab,
}: {
  onSpace: (id: string) => void;
  onTab: (tab: ExplorerTab) => void;
}) {
  const params = useSearchParams();
  const space = params.get('space');
  const tab = params.get('tab');

  useEffect(() => {
    if (space) onSpace(space);
  }, [space, onSpace]);

  useEffect(() => {
    if (tab && (TABS as readonly string[]).includes(tab)) onTab(tab as ExplorerTab);
  }, [tab, onTab]);

  return null;
}

export default DeepLinkedSpace;
