'use client';

import type { AnchorHTMLAttributes } from 'react';

/**
 * One `<a>`, with a tracking call fired on click before it navigates.
 *
 * `AgentCard` and `DirectChannels` are both server components — one of
 * them for a real reason: `DirectChannels` warns to the server console
 * when no contact channel is configured, and that has to stay a
 * server-only `console.warn`, not something printed into every visitor's
 * browser console. Wrapping just the anchor in a client leaf keeps the
 * analytics call available without pulling either card across the
 * boundary.
 */
export function TrackedLink({
  onTrack,
  ...props
}: { onTrack: () => void } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props} onClick={onTrack} />;
}
