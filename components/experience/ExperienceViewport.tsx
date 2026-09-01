'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { WebGLFallback } from '@/components/three/WebGLFallback';
import { useWebGLSupport } from '@/hooks/useWebGLSupport';
import { cn } from '@/lib/utils/cn';
import type { CameraMode, CameraView } from '@/types';

const ExperienceCanvas = dynamic(
  () => import('./ExperienceCanvas').then((mod) => mod.ExperienceCanvas),
  { ssr: false },
);

type ExperienceViewportProps = {
  view?: CameraView;
  mode?: CameraMode;
  className?: string;
  /** Accessible description of what the canvas depicts. */
  label?: string;
};

/**
 * The bridge between ordinary UI and the 3D layer. It is the only component
 * pages need: it verifies WebGL, defers the three.js chunk until the region
 * approaches the viewport, and degrades to a static plate when it must.
 */
export function ExperienceViewport({
  view,
  mode,
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
        <WebGLFallback reason="unsupported" />
      ) : webgl && inView ? (
        <ExperienceCanvas view={view} mode={mode} />
      ) : null}
    </div>
  );
}
