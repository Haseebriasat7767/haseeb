'use client';

import { useCallback, useState } from 'react';
import { LoadingScreen } from '@/components/three/LoadingScreen';
import { Scene } from '@/components/three/Scene';
import { SceneErrorBoundary } from '@/components/three/SceneErrorBoundary';
import { useDevOverlayEnabled } from '@/components/three/dev/useDevOverlayEnabled';
import { PerformanceOverlay } from '@/components/three/dev/PerformanceOverlay';
import type { PerformanceSnapshot } from '@/components/three/dev/performance-types';
import { WebGLFallback } from '@/components/three/WebGLFallback';
import type { CameraMode, CameraView, SceneContent } from '@/types';

type ExperienceCanvasProps = {
  view?: CameraView;
  mode?: CameraMode;
  content?: SceneContent;
};

/**
 * Everything that touches three.js lives in this chunk. `ExperienceViewport`
 * loads it dynamically, so no three/drei code reaches the initial bundle.
 */
export function ExperienceCanvas({ view, mode, content }: ExperienceCanvasProps) {
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);

  const diagnosticsEnabled = useDevOverlayEnabled();
  const [metrics, setMetrics] = useState<PerformanceSnapshot | null>(null);

  return (
    <SceneErrorBoundary fallback={<WebGLFallback reason="error" />}>
      <Scene
        view={view}
        mode={mode}
        content={content}
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
