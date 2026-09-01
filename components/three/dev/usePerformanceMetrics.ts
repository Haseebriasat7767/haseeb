'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import type {
  FrameStats,
  PerformanceSnapshot,
  RendererCounters,
  RendererInfo,
} from './performance-types';

/** How often the displayed metrics refresh — 4 Hz, not once a frame. */
const UPDATE_INTERVAL_MS = 250;
/** Rolling window frame-time statistics are computed over. */
const WINDOW_SECONDS = 4;
/** Hard cap on buffered samples, in case of a runaway frame rate. */
const MAX_SAMPLES = 600;

const EMPTY_FRAME_STATS: FrameStats = {
  fps: 0,
  frameMs: 0,
  avgFrameMs: 0,
  p95FrameMs: 0,
  worstFrameMs: 0,
  sampleWindowSeconds: WINDOW_SECONDS,
  sampleCount: 0,
};

const EMPTY_COUNTERS: RendererCounters = {
  drawCalls: 0,
  triangles: 0,
  points: 0,
  lines: 0,
  geometries: 0,
  textures: 0,
};

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)]!;
}

/**
 * Reads WebGL context info through `WEBGL_debug_renderer_info` when the
 * browser exposes it. Many browsers restrict or spoof this for privacy, so
 * every field is `null` — never guessed — when it isn't available.
 */
function readRendererInfo(gl: WebGLRenderingContext | WebGL2RenderingContext): RendererInfo {
  const isWebGL2 =
    typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;

  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const vendor = ext ? (gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) as string) : null;
    const renderer = ext ? (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string) : null;
    return {
      webglVersion: isWebGL2 ? 'WebGL2' : 'WebGL1',
      vendor: vendor || null,
      renderer: renderer || null,
    };
  } catch {
    return { webglVersion: isWebGL2 ? 'WebGL2' : 'WebGL1', vendor: null, renderer: null };
  }
}

/**
 * Rolling FPS / frame-time / renderer-counter sampler.
 *
 * Sampling happens every frame inside `useFrame`, entirely in refs — no
 * React state is touched there, so this never causes a 60 Hz re-render. The
 * displayed snapshot is recomputed and published to state at a fixed low
 * frequency (`UPDATE_INTERVAL_MS`) instead.
 */
export function usePerformanceMetrics(qualityTier: string) {
  const { gl } = useThree();

  const samples = useRef<{ t: number; ms: number }[]>([]);
  const lastFrameTime = useRef<number | null>(null);
  const lastUpdateTime = useRef(0);
  const rendererInfo = useRef<RendererInfo | null>(null);

  const [frame, setFrame] = useState<FrameStats>(EMPTY_FRAME_STATS);
  const [counters, setCounters] = useState<RendererCounters>(EMPTY_COUNTERS);

  useFrame(() => {
    const now = performance.now();

    if (lastFrameTime.current !== null) {
      const ms = now - lastFrameTime.current;
      if (Number.isFinite(ms) && ms > 0) {
        samples.current.push({ t: now, ms });
        if (samples.current.length > MAX_SAMPLES) samples.current.shift();
      }
    }
    lastFrameTime.current = now;

    if (now - lastUpdateTime.current < UPDATE_INTERVAL_MS) return;
    lastUpdateTime.current = now;

    // Drop samples older than the rolling window so a long idle period
    // doesn't stale-average against ancient frames.
    const cutoff = now - WINDOW_SECONDS * 1000;
    while (samples.current.length > 0 && samples.current[0]!.t < cutoff) {
      samples.current.shift();
    }

    const recent = samples.current;
    if (recent.length > 0) {
      const durations = recent.map((s) => s.ms);
      const sorted = [...durations].sort((a, b) => a - b);
      const avg = durations.reduce((sum, v) => sum + v, 0) / durations.length;
      const latest = durations[durations.length - 1]!;
      setFrame({
        fps: avg > 0 ? Math.round(1000 / avg) : 0,
        frameMs: latest,
        avgFrameMs: avg,
        p95FrameMs: percentile(sorted, 95),
        worstFrameMs: sorted[sorted.length - 1]!,
        sampleWindowSeconds: WINDOW_SECONDS,
        sampleCount: recent.length,
      });
    }

    const info = gl.info;
    setCounters({
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      points: info.render.points,
      lines: info.render.lines,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
    });

    if (!rendererInfo.current) {
      rendererInfo.current = readRendererInfo(gl.getContext());
    }
  });

  const snapshot = useMemo(
    () => (): PerformanceSnapshot => ({
      frame,
      counters,
      dpr: gl.getPixelRatio(),
      qualityTier,
      rendererInfo: rendererInfo.current ?? { webglVersion: null, vendor: null, renderer: null },
      viewport: { width: gl.domElement.width, height: gl.domElement.height },
      deviceClass: window.matchMedia('(pointer: coarse)').matches ? 'mobile' : 'desktop',
      timestamp: new Date().toISOString(),
    }),
    [frame, counters, gl, qualityTier],
  );

  return { frame, counters, dpr: gl.getPixelRatio(), rendererInfo: rendererInfo.current, snapshot };
}
