'use client';

import { useCallback, useState } from 'react';
import { LoadingScreen } from '@/components/three/LoadingScreen';
import { Scene } from '@/components/three/Scene';
import { SceneErrorBoundary } from '@/components/three/SceneErrorBoundary';
import { WebGLFallback } from '@/components/three/WebGLFallback';
import type { CameraMode, CameraView } from '@/types';

type ExperienceCanvasProps = {
  view?: CameraView;
  mode?: CameraMode;
};

/**
 * Everything that touches three.js lives in this chunk. `ExperienceViewport`
 * loads it dynamically, so no three/drei code reaches the initial bundle.
 */
export function ExperienceCanvas({ view, mode }: ExperienceCanvasProps) {
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);

  return (
    <SceneErrorBoundary fallback={<WebGLFallback reason="error" />}>
      <Scene view={view} mode={mode} onReady={onReady} />
      <LoadingScreen visible={!ready} />
    </SceneErrorBoundary>
  );
}

export default ExperienceCanvas;
