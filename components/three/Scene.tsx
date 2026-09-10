'use client';

import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, type ReactNode } from 'react';
import { ACESFilmicToneMapping } from 'three';
import { useQualityTier } from '@/hooks/useQualityTier';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { getPostProfile, resolveGrade } from '@/lib/three/grading';
import { setDecalMaxSize } from '@/components/three/textures/DecalMaps';
import { setImperfectionEnabled } from '@/components/three/textures/ImperfectionMaps';
import { setSurfaceMapResolution } from '@/components/three/textures/SurfaceMaps';
import { setSurfaceMapsEnabled } from '@/lib/three/materials';
import { DEFAULT_TIME_OF_DAY, resolveLighting } from '@/lib/three/lighting';
import { DEFAULT_VIEW } from '@/lib/three/scene-config';
import type { CameraMode, CameraView, SceneContent, TimeOfDay } from '@/types';
import { CameraController } from './CameraController';
import { PerformanceMonitor } from './dev/PerformanceMonitor';
import type { PerformanceSnapshot } from './dev/performance-types';
import { SceneEnvironment } from './Environment';
import { PlaceholderMassing } from './PlaceholderMassing';
import { PathTracer } from './post/PathTracer';
import { PostProcessing } from './post/PostProcessing';
import { Terrain } from './Terrain';
import { TowerScene } from './tower/TowerScene';
import { ProceduralVilla } from './villa/ProceduralVilla';

/**
 * ============================================================================
 * THE SCENE — how this 3D experience is put together
 * ============================================================================
 *
 * Read this first if you are new to the project, or need to explain it.
 *
 * ## How a scene loads
 *
 * Nothing 3D is in the page bundle. `ExperienceViewport` waits until the
 * viewport is scrolled to and WebGL is confirmed, then loads the canvas
 * chunk — which is why every page here holds ~103 kB of shared JavaScript
 * despite the project containing three.js, drei, a BVH and a path tracer.
 * While that chunk and its assets load, `LoadingScreen` reports real
 * progress from three's own `LoadingManager` (via drei's `useProgress`),
 * not a timer. The screen dismisses when the scene reports ready.
 *
 * ## How time of day works
 *
 * One state, five states deep: `TimeOfDay` is a named hour, not a number.
 * `lib/three/lighting.ts` maps each name to a complete lighting description
 * — sun angle and colour, sky and horizon tint, fog density, exposure — and
 * `SceneEnvironment` applies the whole set at once. Nothing about the
 * geometry changes when the hour changes; only the light does. That is why
 * the dial is instant, and why a new hour is a data entry rather than code.
 *
 * ## How to add a new space (camera marker)
 *
 * Spaces live in `lib/experience/spaces.ts` as plain data. One entry needs
 * an `id`, a display `name`, an `eyebrow`, a `level` ('site' | 'ground' |
 * 'upper'), a short `description` and `feature`, and a `view` — the camera
 * position, target and field of view for that framing. Add the entry and it
 * appears in the space rail, gets a hotspot marker on the model, becomes
 * deep-linkable as `?space=<id>`, and counts toward the three levels that
 * unlock the closing call to action. No component needs editing.
 *
 * ## Quality tiers
 *
 * `useQualityTier` reads pointer type and core count — not the user agent —
 * and resolves one of three profiles in `lib/three/scene-config.ts`. The
 * tier decides device pixel ratio, whether shadows render at all, shadow
 * map size and antialiasing, so a phone and a workstation run the same
 * scene at costs appropriate to each.
 * ============================================================================
 */

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
  /** Metres of slow automatic movement on a held framing. */
  drift?: number;
  /**
   * Alternative text for the rendered frame. It is applied to the `<canvas>`
   * element itself rather than to a wrapper, because the wrapper also holds
   * the hotspot buttons and an `img` may not contain interactive controls.
   */
  label?: string;
  /**
   * Renders this view by path tracing instead of rasterizing. For still
   * hero framings only — it converges over seconds and does not survive a
   * moving camera.
   */
  cinematic?: boolean;
  /** Convergence progress, so chrome can show it and then withdraw. */
  onCinematicProgress?: (samples: number, maxSamples: number) => void;
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
  cinematic = false,
  onCinematicProgress,
  onReady,
  content = 'villa',
  timeOfDay = DEFAULT_TIME_OF_DAY,
  parallax = 0,
  drift = 0,
  label,
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
  const lighting = useMemo(() => {
    const base = resolveLighting(timeOfDay, quality.tier);
    if (content !== 'tower') return base;

    // The hours are composed for the residence, whose whole site fits
    // inside fifty metres. A twenty-storey building on a beach is a
    // different scale of scene entirely: the cameras that frame it stand a
    // hundred and thirty metres back and the sea runs to the horizon, so at
    // the villa's fog distances the tower washes out to nothing before it
    // is even in frame. Same air, more of it — and a shadow frustum wide
    // enough for an eighty-metre building to cast across its own plaza.
    return {
      ...base,
      atmosphere: {
        ...base.atmosphere,
        fogNear: base.atmosphere.fogNear * 3.2,
        fogFar: base.atmosphere.fogFar * 4.4,
      },
      shadowExtent: base.shadowExtent * 2.6,
    };
  }, [timeOfDay, quality.tier, content]);

  // The finishing chain reads the same hour the rig does, so a grade can
  // never describe a different time of day than the light it is grading.
  // Settled during render rather than in an effect: the material cache is
  // built lazily by the children below, so the answer has to be in place
  // before they first ask for it.
  useMemo(() => setSurfaceMapsEnabled(quality.tier !== 'low'), [quality.tier]);

  // Texel density is the quiet half of material scale, and the top tier can
  // afford twice as much of it. Settled here alongside the other material
  // decisions, and before the children below first ask for a map.
  useMemo(() => setSurfaceMapResolution(quality.tier === 'high' ? 1024 : 512), [quality.tier]);

  // What the decal and foliage sheets may cost on the GPU.
  //
  // Not a quality preference — a hard budget. Authored at 2048 px they are
  // 21 MB each, and three of them plus the masks below made up 80 MB of the
  // 94 MB this scene was uploading. A mid-range mobile GPU answers that by
  // losing the WebGL context, and a lost context is a black canvas with no
  // error and no explanation, which is exactly what a phone showed.
  useMemo(
    () => setDecalMaxSize(quality.tier === 'high' ? 2048 : quality.tier === 'medium' ? 768 : 512),
    [quality.tier],
  );
  // Roughness weathering is the least visible thing in the material chain and
  // costs 16 MB. Top tier only.
  useMemo(() => setImperfectionEnabled(quality.tier === 'high'), [quality.tier]);

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
      // A fixed camera renders on demand so an idle view costs no GPU
      // time — except while path tracing, which converges by accumulating
      // samples and therefore needs every frame it can get. Without this the
      // tracer sat below its minimum sample count forever and quietly showed
      // its rasterized fallback, which looked like the tracer doing nothing.
      // Walk mode renders every frame by definition: the camera is moving
      // because a person is moving it, and `demand` would show them a still.
      // A held framing costs nothing on demand — but a DRIFTING held framing
      // is never finished moving, and `demand` would render the first second
      // of the drift and then stop dead.
      frameloop={mode === 'fixed' && !cinematic && drift <= 0 ? 'demand' : 'always'}
      // The canvas is the picture; the DOM that react-three-fiber wraps it in
      // is shared with drei's `Html` hotspots, so the role belongs here and
      // nowhere further out.
      onCreated={({ gl }) => {
        if (!label) return;
        gl.domElement.setAttribute('role', 'img');
        gl.domElement.setAttribute('aria-label', label);
      }}
      className="h-full w-full"
    >
      <color attach="background" args={[lighting.atmosphere.background]} />

      {/* In walk mode the visitor owns the camera; a controller easing it
          toward a framing would be fighting them for it every frame. */}
      {mode === 'walk' ? null : (
        <CameraController
          view={view}
          mode={mode}
          parallax={parallax}
          drift={drift}
          reducedMotion={reducedMotion}
          // The tower stands on an ocean that runs to the horizon. Near is
          // lifted with far to keep the depth ratio sane — nothing in this
          // scene is ever within a quarter metre of the eye.
          {...(content === 'tower' ? { near: 0.25, far: 3000 } : {})}
        />
      )}
      <SceneEnvironment
        lighting={lighting}
        shadows={quality.shadows}
        shadowMapSize={quality.shadowMapSize}
        exposure={view.exposure}
      />

      {/* The two finishing paths are mutually exclusive: a traced frame has
          already resolved its own exposure and tone curve, and running it
          through the composer would grade an already-graded image. */}
      {cinematic ? (
        <PathTracer active onProgress={onCinematicProgress} />
      ) : post.enabled ? (
        <PostProcessing profile={post} grade={grade} />
      ) : null}

      {diagnosticsEnabled && onMetrics ? (
        <PerformanceMonitor qualityTier={quality.tier} onUpdate={onMetrics} />
      ) : null}

      <Suspense fallback={null}>
        {/* The villa's rolling terrain is the villa's site. The tower brings
            its own ground — a plaza, a beach and an ocean — and laying the
            estate landform under it would push hills through the sand. */}
        {content === 'tower' ? null : <Terrain />}
        {children ??
          (content === 'placeholder' ? (
            <PlaceholderMassing />
          ) : content === 'tower' ? (
            <TowerScene detail={quality.tier} walk={mode === 'walk'} />
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
