'use client';

import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect, type ReactNode } from 'react';
import { ACESFilmicToneMapping } from 'three';
import { useQualityTier } from '@/hooks/useQualityTier';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { DEFAULT_VIEW } from '@/lib/three/scene-config';
import type { CameraMode, CameraView, SceneContent } from '@/types';
import { CameraController } from './CameraController';
import { PerformanceMonitor } from './dev/PerformanceMonitor';
import type { PerformanceSnapshot } from './dev/performance-types';
import { SceneEnvironment } from './Environment';
import { PlaceholderMassing } from './PlaceholderMassing';
import { Terrain } from './Terrain';
import { ProceduralVilla } from './villa/ProceduralVilla';

type SceneProps = {
  view?: CameraView;
  mode?: CameraMode;
  /** Fires once the scene graph has mounted and suspense has resolved. */
  onReady?: () => void;
  /** Which building to render. `placeholder` is a diagnostic fallback. */
  content?: SceneContent;
  /** Overrides `content` entirely when custom scene contents are needed. */
  children?: ReactNode;
  /** Mounts the dev-only performance sampler; a no-op when omitted. */
  diagnosticsEnabled?: boolean;
  /** Receives a throttled metrics snapshot (~4 Hz) while diagnostics run. */
  onMetrics?: (snapshot: PerformanceSnapshot) => void;
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
export function Scene({
  view = DEFAULT_VIEW,
  mode = 'orbit',
  onReady,
  content = 'villa',
  children,
  diagnosticsEnabled = false,
  onMetrics,
}: SceneProps) {
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

      {diagnosticsEnabled && onMetrics ? (
        <PerformanceMonitor qualityTier={quality.tier} onUpdate={onMetrics} />
      ) : null}

      <Suspense fallback={null}>
        <Terrain />
        {children ??
          (content === 'placeholder' ? (
            <PlaceholderMassing />
          ) : (
            <ProceduralVilla detail={quality.tier} />
          ))}
        <ReadySignal onReady={onReady} />
      </Suspense>
    </Canvas>
  );
}

export default Scene;
