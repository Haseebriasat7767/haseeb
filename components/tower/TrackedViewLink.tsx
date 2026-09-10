'use client';

import Link, { type LinkProps } from 'next/link';
import type { AnchorHTMLAttributes } from 'react';
import { trackSpaceEntered } from '@/lib/analytics/events';

/**
 * `next/link`'s `Link` is itself a client component, so an inline
 * `onClick` cannot be passed to it from a server component — the handler
 * isn't serialisable across that boundary. `TowerViews` stays server-
 * rendered; this is the one leaf that needs to cross it.
 */
export function TrackedViewLink({
  space,
  ...props
}: { space: string } & LinkProps & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <Link {...props} onClick={() => trackSpaceEntered(space, 'tower')} />;
}
