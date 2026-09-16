'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { BackSide, MathUtils, Vector3, type Mesh, type MeshBasicMaterial } from 'three';
import { loadPanorama, type LoadedPanorama, type PanoramaSource } from '@/lib/pano/panoLoader';

/**
 * The interior renderer.
 *
 * The exterior stays procedural and real-time; inside the building the
 * pixels come from a pre-rendered cubemap instead, mapped to the inside of
 * a sphere the camera sits at the centre of. There is no scene to light and
 * nothing to shade, so this costs a single draw call per visible room and
 * runs at display rate on hardware that could not raster the villa at all.
 */

/** Radius of the shell, in metres. Far enough to read as infinity. */
const SHELL_RADIUS = 50;

/** Task 2.1's load fade. */
export const PANO_FADE_MS = 500;

/**
 * A value the shell samples once per frame. A ref rather than a prop is the
 * whole point: a crossfade that set React state every frame would re-render
 * the tree sixty times a second to animate one float.
 */
export type FrameValue = number | RefObject<number>;

function read(value: FrameValue | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  return typeof value === 'number' ? value : value.current;
}

export type PanoShellProps = {
  panorama: LoadedPanorama;
  /** 0–1. Driven by the transition controller when crossfading. */
  opacity: FrameValue;
  /** Multiplier on the shell radius, for the dolly-forward effect. */
  scale?: FrameValue;
  /**
   * Painter's order. The incoming room must draw after the outgoing one, or
   * the crossfade resolves as a hard swap the moment depth testing picks a
   * winner.
   */
  renderOrder?: number;
};

/**
 * One panorama, on the inside of a sphere.
 *
 * `depthTest` and `depthWrite` are both off. Two concentric shells have no
 * meaningful depth relationship — whichever is nearer wins per fragment, and
 * at these radii that decision flickers. Turning depth off entirely makes
 * `renderOrder` the only thing that decides, which is exactly what a
 * crossfade needs.
 */
export function PanoShell({ panorama, opacity, scale, renderOrder = 0 }: PanoShellProps) {
  const material = useRef<MeshBasicMaterial>(null);
  const mesh = useRef<Mesh>(null);

  useFrame(() => {
    if (material.current) material.current.opacity = read(opacity, 1);
    if (mesh.current) mesh.current.scale.setScalar(read(scale, 1));
  });

  return (
    <mesh ref={mesh} renderOrder={renderOrder} frustumCulled={false}>
      <sphereGeometry args={[SHELL_RADIUS, 60, 40]} />
      {panorama.kind === 'cube' ? (
        <meshBasicMaterial
          ref={material}
          envMap={panorama.texture}
          side={BackSide}
          transparent
          opacity={read(opacity, 1)}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      ) : (
        <meshBasicMaterial
          ref={material}
          map={panorama.texture}
          side={BackSide}
          transparent
          opacity={read(opacity, 1)}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      )}
    </mesh>
  );
}

export type PanoramaState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; panorama: LoadedPanorama }
  | { status: 'error'; error: Error };

/**
 * Loads a panorama through the shared cache and reports what happened.
 * A cache hit resolves in the same microtask, so a room already visited
 * never shows a loading state on the way back.
 */
export function usePanorama(source: PanoramaSource | null): PanoramaState {
  const [state, setState] = useState<PanoramaState>({ status: 'idle' });

  useEffect(() => {
    if (!source) {
      setState({ status: 'idle' });
      return;
    }

    let live = true;
    setState({ status: 'loading' });
    loadPanorama(source)
      .then((panorama) => {
        if (live) setState({ status: 'ready', panorama });
      })
      .catch((error: unknown) => {
        if (live) {
          setState({
            status: 'error',
            error: error instanceof Error ? error : new Error('Panorama failed to load'),
          });
        }
      });

    return () => {
      live = false;
    };
    // `source` is a plain record rebuilt by the manifest lookup, so its
    // identity is not stable; its id is what actually decides the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source?.id, source?.kind]);

  return state;
}

/**
 * Fades a freshly loaded panorama up from black over `PANO_FADE_MS`, into a
 * ref the shell samples per frame.
 */
export function useFadeIn(active: boolean, durationMs = PANO_FADE_MS): RefObject<number> {
  const opacity = useRef(0);

  useEffect(() => {
    if (!active) {
      opacity.current = 0;
      return;
    }
    let start: number | null = null;
    let raf = 0;
    const step = (now: number) => {
      start ??= now;
      opacity.current = Math.min(1, (now - start) / durationMs);
      if (opacity.current < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [active, durationMs]);

  return opacity;
}

/**
 * Writes the camera's compass bearing into a ref every frame. A ref rather
 * than state on purpose: a compass that re-rendered React sixty times a
 * second would cost more than the scene it labels.
 */
function YawReporter({ onYaw }: { onYaw: (yaw: number) => void }) {
  const { camera } = useThree();
  const scratch = useMemo(() => new Vector3(), []);
  useFrame(() => {
    const direction = camera.getWorldDirection(scratch);
    onYaw(Math.atan2(direction.x, direction.z));
  });
  return null;
}

export type InteriorPanoViewerProps = {
  /** Rendered inside the canvas: shells, hotspots, transitions. */
  children?: ReactNode;
  /** DOM chrome drawn over the canvas. */
  overlay?: ReactNode;
  /** Vertical field of view in degrees. */
  fov?: number;
  onYaw?: (yaw: number) => void;
  label?: string;
  className?: string;
};

/**
 * The canvas and the look-around control, and nothing else. What is shown
 * inside it is the caller's business, so the same viewer serves a single
 * still room and a crossfading tour.
 */
export function InteriorPanoViewer({
  children,
  overlay,
  fov = 72,
  onYaw,
  label = 'Panoramic interior view',
  className,
}: InteriorPanoViewerProps) {
  const yawRef = useRef(onYaw);
  yawRef.current = onYaw;

  const handleYaw = useMemo(() => (yaw: number) => yawRef.current?.(yaw), []);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);

  // The label names the room, and the room changes without the canvas ever
  // being recreated — so setting it once in `onCreated` leaves a screen
  // reader announcing whichever room the visitor happened to start in, for
  // the rest of the tour.
  useEffect(() => {
    canvas?.setAttribute('aria-label', label);
  }, [canvas, label]);

  return (
    <div className={className}>
      <Canvas
        camera={{ position: [0, 0, 0.01], fov, near: 0.1, far: SHELL_RADIUS * 4 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.domElement.setAttribute('role', 'img');
          setCanvas(gl.domElement);
        }}
      >
        {/* Look-around only. Zoom would let a visitor push the camera
            through the shell, and panning has no meaning from a fixed
            standpoint. The negative speed is what makes dragging feel like
            turning your head rather than spinning a globe. */}
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={-0.32}
          target={[0, 0, 0]}
          makeDefault
        />
        {onYaw ? <YawReporter onYaw={handleYaw} /> : null}
        {children}
      </Canvas>
      {overlay}
    </div>
  );
}

export const degrees = (radians: number): number => MathUtils.radToDeg(radians);
