'use client';

import { useEffect, useRef } from 'react';
import { usePerformanceMetrics } from './usePerformanceMetrics';
import type { PerformanceSnapshot } from './performance-types';

type PerformanceMonitorProps = {
  qualityTier: string;
  /** Called at the metrics hook's own throttled rate (~4 Hz), never per frame. */
  onUpdate: (snapshot: PerformanceSnapshot) => void;
};

/**
 * Canvas-side half of the diagnostics system. Renders nothing — it exists
 * only to run `usePerformanceMetrics` (which needs `useThree`/`useFrame`,
 * so it must live inside the Canvas) and forward the already-throttled
 * result out to the DOM overlay via a plain callback.
 */
export function PerformanceMonitor({ qualityTier, onUpdate }: PerformanceMonitorProps) {
  const { frame, counters, snapshot } = usePerformanceMetrics(qualityTier);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    onUpdateRef.current(snapshot());
    // `frame`/`counters` change only on the hook's own throttled interval,
    // so this effect fires at that same low rate — not once per frame.
  }, [frame, counters, snapshot]);

  return null;
}
