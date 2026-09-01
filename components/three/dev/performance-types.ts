/**
 * AURELIA engineering targets — internal budgets for this project, not
 * universal Three.js limits. Safe to retune as the scene grows.
 */
export const PERFORMANCE_BUDGET = {
  desktopTargetFps: 60,
  desktopTargetFrameMs: 16.7,

  mobileTargetFps: 30,
  mobileTargetFrameMs: 33.3,

  /** Draw calls: <excellent is great, warning..critical is "investigate". */
  excellentDrawCalls: 100,
  warningDrawCalls: 150,
  criticalDrawCalls: 250,

  /** Triangles: same escalation, in whole triangles. */
  excellentTriangles: 50_000,
  warningTriangles: 100_000,
  criticalTriangles: 250_000,
} as const;

/** Renderer counters read verbatim from `renderer.info` each sample. */
export type RendererCounters = {
  drawCalls: number;
  triangles: number;
  points: number;
  lines: number;
  geometries: number;
  textures: number;
};

/** Frame-timing statistics over the current rolling window. */
export type FrameStats = {
  fps: number;
  frameMs: number;
  avgFrameMs: number;
  p95FrameMs: number;
  worstFrameMs: number;
  /** Seconds of data the average/P95/worst are computed over. */
  sampleWindowSeconds: number;
  sampleCount: number;
};

/**
 * WebGL context info exposed only when the browser allows it. A field is
 * `null` — never fabricated — when the API is unavailable or restricted.
 */
export type RendererInfo = {
  webglVersion: 'WebGL2' | 'WebGL1' | null;
  vendor: string | null;
  renderer: string | null;
};

export type PerformanceSnapshot = {
  frame: FrameStats;
  counters: RendererCounters;
  dpr: number;
  qualityTier: string;
  rendererInfo: RendererInfo;
  viewport: { width: number; height: number };
  deviceClass: 'desktop' | 'mobile';
  timestamp: string;
};
