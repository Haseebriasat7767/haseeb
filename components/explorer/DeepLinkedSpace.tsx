'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Applies `?space=<id>` to the explorer.
 *
 * This exists to be small. `useSearchParams` opts a component out of static
 * server rendering, and Next applies that to the whole nearest Suspense
 * boundary — so reading it inside `ResidenceExplorer` meant the explore
 * page's HTML contained no heading, no space rail and no copy, only a
 * placeholder, until JavaScript ran. A crawler reading the document saw an
 * empty page.
 *
 * Confined to a leaf that renders `null`, the bail-out costs nothing: the
 * heading and rail around it render on the server as before, and only this
 * component waits for the client.
 */
export function DeepLinkedSpace({ onSpace }: { onSpace: (id: string) => void }) {
  const requested = useSearchParams().get('space');

  useEffect(() => {
    if (requested) onSpace(requested);
  }, [requested, onSpace]);

  return null;
}

export default DeepLinkedSpace;
