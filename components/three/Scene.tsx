'use client';

import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect, type ReactNode } from 'react';
import { ACESFilmicToneMapping } from 'three';
import { useQualityTier } from '@/hooks/useQualityTier';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { DEFAULT_VIEW } from '@/lib/three/scene-config';
import type { CameraMode, CameraView } from '@/types';
import { CameraController } from './CameraController';
import { SceneEnvironment } from './Environment';
import { PlaceholderMassing } from './PlaceholderMassing';

type SceneProps = {
  view?: CameraView;
  mode?: CameraMode;
  /** Fires once the scene graph has mounted and suspense has resolved. */
  onReady?: () => void;
  /** Extra scene content. Defaults to the Phase 1 placeholder massing. */
  children?: ReactNode;
};

/** Signals readiness from inside Suspense — no timers, no fake delay. */
function ReadySignal({ onReady }: { onReady?: () => void }) {
  useEffect(() => {
    onReady?.();
  }, [onReady]);

  return null;
}

/**
 * The single Canvas wrapper for the whole site. Quality (DPR, shadows,
 * antialiasing) is resolved per device before the renderer is created, and
 * the frameloop pauses when the canvas leaves the viewport.
 */
export function Scene({ view = DEFAULT_VIEW, mode = 'orbit', onReady, children }: SceneProps) {
  const quality = useQualityTier();
  const reducedMotion = useReducedMotion();

  return (
    <Canvas
      shadows={quality.shadows}
      dpr={quality.dpr}
      gl={{
        antialias: quality.antialias,
        powerPreference: 'high-performance',
        toneMapping: ACESFilmicToneMapping,
        toneMappingExposure: 1.05,
      }}
      camera={{ position: view.position, fov: view.fov }}
      // Renders only when something changes — idle scenes cost no GPU time.
      frameloop={mode === 'fixed' ? 'demand' : 'always'}
      className="h-full w-full"
    >
      <color attach="background" args={['#0a0a0b']} />

      <CameraController view={view} mode={mode} reducedMotion={reducedMotion} />
      <SceneEnvironment shadows={quality.shadows} shadowMapSize={quality.shadowMapSize} />

      <Suspense fallback={null}>
        {children ?? <PlaceholderMassing />}
        <ReadySignal onReady={onReady} />
      </Suspense>
    </Canvas>
  );
}

export default Scene;
