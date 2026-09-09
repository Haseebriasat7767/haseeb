'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { WebGLFallback } from '@/components/three/WebGLFallback';
import { ViewportPlaceholder } from '@/components/three/ViewportPlaceholder';
import { useWebGLSupport } from '@/hooks/useWebGLSupport';
import type { HotspotConfig } from '@/lib/experience/spaces';
import { cn } from '@/lib/utils/cn';
import type { CameraMode, CameraView, SceneContent, TimeOfDay } from '@/types';

const ExperienceCanvas = dynamic(
  () => import('./ExperienceCanvas').then((mod) => mod.ExperienceCanvas),
  // The `loading` fallback is not optional here. Without it this area renders
  // nothing at all while the three.js chunk downloads — a black rectangle with
  // no spinner and no text, for however long that takes on the visitor's
  // connection. `LoadingScreen` cannot do this job: it reads drei's
  // `useProgress` and so ships inside the very chunk being waited for.
  { ssr: false, loading: () => <ViewportPlaceholder /> },
);

type ExperienceViewportProps = {
  view?: CameraView;
  mode?: CameraMode;
  /** `placeholder` renders the Phase 1 diagnostic massing instead. */
  content?: SceneContent;
  /** Architectural lighting state. Golden hour is the presentation default. */
  timeOfDay?: TimeOfDay;
  /** Metres of pointer-driven camera parallax; 0 disables it. */
  parallax?: number;
  /** Metres of slow automatic movement on a held framing; 0 disables it. */
  drift?: number;
  /** Mounts the architectural markers on the model when supplied. */
  hotspots?: HotspotConfig;
  /** Fires once the scene is mounted and the loading state has cleared. */
  onReady?: () => void;
  /** Path-traces this framing instead of rasterizing it. Stills only. */
  cinematic?: boolean;
  onCinematicProgress?: (samples: number, maxSamples: number) => void;
  /** Chrome rendered over the canvas, inside the same positioned box. */
  children?: ReactNode;
  className?: string;
  /** Accessible description of what the canvas depicts. */
  label?: string;
};

/**
 * The bridge between ordinary UI and the 3D layer. It is the only component
 * pages need: it verifies WebGL, defers the three.js chunk until the region
 * approaches the viewport, and degrades to a static plate when it must.
 */
/**
 * The static plate, plus the readiness signal the page is waiting on: with
 * no renderer there is no canvas to report in, and an entrance sequence
 * that waits for one would never run.
 */
function UnsupportedNotice({ onReady }: { onReady?: () => void }) {
  useEffect(() => {
    onReady?.();
  }, [onReady]);

  return <WebGLFallback reason="unsupported" />;
}

export function ExperienceViewport({
  view,
  mode,
  content,
  timeOfDay,
  parallax,
  drift,
  hotspots,
  onReady,
  cinematic,
  onCinematicProgress,
  children,
  className,
  label = 'Interactive three-dimensional view of the residence',
}: ExperienceViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const webgl = useWebGLSupport();

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={label}
      className={cn('bg-obsidian relative isolate overflow-hidden', className)}
    >
      {webgl === false ? (
        <UnsupportedNotice onReady={onReady} />
      ) : webgl && inView ? (
        <ExperienceCanvas
          view={view}
          mode={mode}
          content={content}
          timeOfDay={timeOfDay}
          parallax={parallax}
          drift={drift}
          hotspots={hotspots}
          cinematic={cinematic}
          onCinematicProgress={onCinematicProgress}
          onReady={onReady}
        />
      ) : (
        // Still deciding whether WebGL exists, or the viewport has not been
        // scrolled to yet. Both used to render null, which is the same black
        // rectangle by another route.
        <ViewportPlaceholder />
      )}
      {children}
    </div>
  );
}
