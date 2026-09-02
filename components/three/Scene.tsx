'use client';

import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, type ReactNode } from 'react';
import { ACESFilmicToneMapping } from 'three';
import { useQualityTier } from '@/hooks/useQualityTier';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { getPostProfile, resolveGrade } from '@/lib/three/grading';
import { DEFAULT_TIME_OF_DAY, resolveLighting } from '@/lib/three/lighting';
import { DEFAULT_VIEW } from '@/lib/three/scene-config';
import type { CameraMode, CameraView, SceneContent, TimeOfDay } from '@/types';
import { CameraController } from './CameraController';
import { PerformanceMonitor } from './dev/PerformanceMonitor';
import type { PerformanceSnapshot } from './dev/performance-types';
import { SceneEnvironment } from './Environment';
import { PlaceholderMassing } from './PlaceholderMassing';
import { PostProcessing } from './post/PostProcessing';
import { Terrain } from './Terrain';
import { ProceduralVilla } from './villa/ProceduralVilla';

type SceneProps = {
  view?: CameraView;
  mode?: CameraMode;
  /** Fires once the scene graph has mounted and suspense has resolved. */
  onReady?: () => void;
  /** Which building to render. `placeholder` is a diagnostic fallback. */
  content?: SceneContent;
  /** Architectural lighting state. Golden hour is the presentation default. */
  timeOfDay?: TimeOfDay;
  /** Metres of pointer-driven camera parallax; 0 disables it. */
  parallax?: number;
  /** Extra scene contents mounted alongside the building (hotspots, helpers). */
  overlay?: ReactNode;
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
  timeOfDay = DEFAULT_TIME_OF_DAY,
  parallax = 0,
  overlay,
  children,
  diagnosticsEnabled = false,
  onMetrics,
}: SceneProps) {
  const quality = useQualityTier();
  const reducedMotion = useReducedMotion();

  // One resolved rig for the whole scene: the environment reads it, and so
  // do the interior practicals and the exterior fixtures, so nothing can
  // drift out of step with the hour.
  const lighting = useMemo(
    () => resolveLighting(timeOfDay, quality.tier),
    [timeOfDay, quality.tier],
  );

  // The finishing chain reads the same hour the rig does, so a grade can
  // never describe a different time of day than the light it is grading.
  const post = useMemo(() => getPostProfile(quality.tier), [quality.tier]);
  const grade = useMemo(() => resolveGrade(timeOfDay ?? DEFAULT_TIME_OF_DAY), [timeOfDay]);

  return (
    <Canvas
      shadows={quality.shadows}
      dpr={quality.dpr}
      // Exposure is deliberately absent here: `SceneEnvironment` owns it, so
      // the renderer and the time-of-day state cannot disagree.
      gl={{
        antialias: quality.antialias,
        powerPreference: 'high-performance',
        toneMapping: ACESFilmicToneMapping,
      }}
      camera={{ position: view.position, fov: view.fov }}
      // Renders only when something changes — idle scenes cost no GPU time.
      frameloop={mode === 'fixed' ? 'demand' : 'always'}
      className="h-full w-full"
    >
      <color attach="background" args={[lighting.atmosphere.background]} />

      <CameraController view={view} mode={mode} parallax={parallax} reducedMotion={reducedMotion} />
      <SceneEnvironment
        lighting={lighting}
        shadows={quality.shadows}
        shadowMapSize={quality.shadowMapSize}
      />

      {post.enabled ? <PostProcessing profile={post} grade={grade} /> : null}

      {diagnosticsEnabled && onMetrics ? (
        <PerformanceMonitor qualityTier={quality.tier} onUpdate={onMetrics} />
      ) : null}

      <Suspense fallback={null}>
        <Terrain />
        {children ??
          (content === 'placeholder' ? (
            <PlaceholderMassing />
          ) : (
            <ProceduralVilla detail={quality.tier} lighting={lighting} />
          ))}
        {overlay}
        <ReadySignal onReady={onReady} />
      </Suspense>
    </Canvas>
  );
}

export default Scene;
