'use client';

import { useCallback } from 'react';
import { PERFORMANCE_BUDGET } from './performance-types';
import type { PerformanceSnapshot } from './performance-types';

type PerformanceOverlayProps = {
  snapshot: PerformanceSnapshot | null;
};

type Severity = 'good' | 'warning' | 'critical';

const SEVERITY_COLOR: Record<Severity, string> = {
  good: 'text-mist',
  warning: 'text-gold',
  critical: 'text-[#d97757]',
};

function drawCallSeverity(calls: number): Severity {
  if (calls > PERFORMANCE_BUDGET.criticalDrawCalls) return 'critical';
  if (calls > PERFORMANCE_BUDGET.warningDrawCalls) return 'warning';
  return 'good';
}

function triangleSeverity(triangles: number): Severity {
  if (triangles > PERFORMANCE_BUDGET.criticalTriangles) return 'critical';
  if (triangles > PERFORMANCE_BUDGET.warningTriangles) return 'warning';
  return 'good';
}

function frameSeverity(p95Ms: number, deviceClass: 'desktop' | 'mobile'): Severity {
  const target =
    deviceClass === 'mobile'
      ? PERFORMANCE_BUDGET.mobileTargetFrameMs
      : PERFORMANCE_BUDGET.desktopTargetFrameMs;
  if (p95Ms > target * 1.6) return 'critical';
  if (p95Ms > target * 1.15) return 'warning';
  return 'good';
}

function Row({
  label,
  value,
  severity = 'good',
}: {
  label: string;
  value: string;
  severity?: Severity;
}) {
  return (
    <div className="flex items-baseline justify-between gap-6">
      <span className="text-stone">{label}</span>
      <span className={`font-medium tabular-nums ${SEVERITY_COLOR[severity]}`}>{value}</span>
    </div>
  );
}

/**
 * Development-only diagnostics HUD. Purely presentational: it reads the
 * already-throttled snapshot published by `PerformanceMonitor` and renders
 * static text — no timers or frame subscriptions of its own.
 */
export function PerformanceOverlay({ snapshot }: PerformanceOverlayProps) {
  const logSnapshot = useCallback(() => {
    if (!snapshot) return;
    console.log('AURELIA PERFORMANCE SNAPSHOT', snapshot);
  }, [snapshot]);

  if (!snapshot) {
    return (
      <div className="border-gold/30 bg-obsidian/85 text-alabaster pointer-events-none absolute top-3 left-3 z-30 rounded-xs border px-3 py-2 font-mono text-[11px] tracking-wide backdrop-blur-sm">
        AURELIA DEV — warming up…
      </div>
    );
  }

  const { frame, counters, dpr, qualityTier, rendererInfo, deviceClass } = snapshot;

  return (
    <div className="border-gold/30 bg-obsidian/85 text-alabaster absolute top-3 left-3 z-30 flex w-56 flex-col gap-2 rounded-xs border px-3 py-2.5 font-mono text-[11px] leading-relaxed tracking-wide backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <span className="text-gold text-[10px] font-semibold tracking-[0.2em] uppercase">
          AURELIA DEV
        </span>
        <button
          type="button"
          onClick={logSnapshot}
          className="text-stone hover:text-gold pointer-events-auto text-[10px] tracking-wide uppercase underline underline-offset-2"
        >
          snapshot
        </button>
      </div>

      <div className="border-alabaster/10 flex flex-col gap-0.5 border-t pt-1.5">
        <Row
          label="FPS"
          value={String(frame.fps)}
          severity={frameSeverity(frame.p95FrameMs, deviceClass)}
        />
        <Row label="FRAME" value={`${frame.frameMs.toFixed(1)} ms`} />
        <Row label="P95" value={`${frame.p95FrameMs.toFixed(1)} ms`} />
        <Row label="WORST" value={`${frame.worstFrameMs.toFixed(1)} ms`} />
      </div>

      <div className="border-alabaster/10 flex flex-col gap-0.5 border-t pt-1.5">
        <Row
          label="DRAW CALLS"
          value={String(counters.drawCalls)}
          severity={drawCallSeverity(counters.drawCalls)}
        />
        <Row
          label="TRIANGLES"
          value={counters.triangles.toLocaleString()}
          severity={triangleSeverity(counters.triangles)}
        />
        <Row label="GEOMETRIES" value={String(counters.geometries)} />
        <Row label="TEXTURES" value={String(counters.textures)} />
      </div>

      <div className="border-alabaster/10 flex flex-col gap-0.5 border-t pt-1.5">
        <Row label="DPR" value={dpr.toFixed(2)} />
        <Row label="QUALITY" value={qualityTier.toUpperCase()} />
        <Row label="DEVICE" value={deviceClass.toUpperCase()} />
      </div>

      <div className="border-alabaster/10 border-t pt-1.5 text-[10px] leading-snug">
        <span className="text-stone">GPU </span>
        <span className="text-mist">{rendererInfo.renderer ?? 'Unavailable'}</span>
      </div>
    </div>
  );
}
