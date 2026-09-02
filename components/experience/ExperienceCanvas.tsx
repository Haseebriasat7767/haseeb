'use client';

import { useCallback, useState } from 'react';
import { LoadingScreen } from '@/components/three/LoadingScreen';
import { Scene } from '@/components/three/Scene';
import { SceneErrorBoundary } from '@/components/three/SceneErrorBoundary';
import { useDevOverlayEnabled } from '@/components/three/dev/useDevOverlayEnabled';
import { PerformanceOverlay } from '@/components/three/dev/PerformanceOverlay';
import type { PerformanceSnapshot } from '@/components/three/dev/performance-types';
import { SpaceHotspots } from '@/components/three/hotspots/SpaceHotspots';
import { WebGLFallback } from '@/components/three/WebGLFallback';
import { useQualityTier } from '@/hooks/useQualityTier';
import type { HotspotConfig } from '@/lib/experience/spaces';
import type { CameraMode, CameraView, SceneContent, TimeOfDay } from '@/types';

type ExperienceCanvasProps = {
  view?: CameraView;
  mode?: CameraMode;
  content?: SceneContent;
  timeOfDay?: TimeOfDay;
  parallax?: number;
  /** Mounts the architectural markers on the model when supplied. */
  hotspots?: HotspotConfig;
};

/**
 * Everything that touches three.js lives in this chunk. `ExperienceViewport`
 * loads it dynamically, so no three/drei code reaches the initial bundle.
 */
export function ExperienceCanvas({
  view,
  mode,
  content,
  timeOfDay,
  parallax,
  hotspots,
}: ExperienceCanvasProps) {
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  const quality = useQualityTier();

  const diagnosticsEnabled = useDevOverlayEnabled();
  const [metrics, setMetrics] = useState<PerformanceSnapshot | null>(null);

  return (
    <SceneErrorBoundary fallback={<WebGLFallback reason="error" />}>
      <Scene
        view={view}
        mode={mode}
        content={content}
        timeOfDay={timeOfDay}
        parallax={parallax}
        overlay={
          hotspots ? (
            <SpaceHotspots
              detail={quality.tier}
              activeId={hotspots.activeId}
              onSelect={hotspots.onSelect}
            />
          ) : null
        }
        onReady={onReady}
        diagnosticsEnabled={diagnosticsEnabled}
        onMetrics={diagnosticsEnabled ? setMetrics : undefined}
      />
      <LoadingScreen visible={!ready} />
      {diagnosticsEnabled ? <PerformanceOverlay snapshot={metrics} /> : null}
    </SceneErrorBoundary>
  );
}

export default ExperienceCanvas;
