'use client';

import dynamic from 'next/dynamic';

/**
 * The client boundary the dynamic import needs.
 *
 * `ssr: false` is only legal inside a client component, and the render
 * bridge must not server-render: it mounts three, which has no meaning
 * without a canvas. Keeping the boundary here means the route itself stays
 * a plain server component and three never reaches a shared chunk.
 */
const PanoRenderBridge = dynamic(
  () => import('./PanoRenderBridge').then((mod) => mod.PanoRenderBridge),
  { ssr: false },
);

export function PanoRenderClient({ spaceId }: { spaceId: string }) {
  return <PanoRenderBridge spaceId={spaceId} />;
}
