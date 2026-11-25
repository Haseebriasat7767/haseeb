'use client';

import { useEffect, useState } from 'react';
import { getQualityProfile } from '@/lib/three/scene-config';
import type { QualityProfile, QualityTier } from '@/types';

/**
 * Resolves a rendering tier from device signals rather than user-agent
 * sniffing: coarse pointer + low core count implies a mobile GPU budget.
 */
function resolveTier(): QualityProfile {
  const cores = navigator.hardwareConcurrency ?? 4;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const smallViewport = window.innerWidth < 768;
  const saveData =
    (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData ??
    false;
  // More aggressive: treat all mobile (coarse pointer) as low-medium tier for performance
  const isMobile = coarsePointer && smallViewport;

  if (saveData || (coarsePointer && cores <= 4)) return getQualityProfile('low');
  if (isMobile) return getQualityProfile('medium'); // Force medium for mobile
  if (coarsePointer || smallViewport || cores <= 8) return getQualityProfile('medium');
  return getQualityProfile('high');
}

/** Average frame time (ms) above which the probe demotes a tier. */
const DEMOTE_MS: Record<QualityTier, number> = { low: Infinity, medium: 40, high: 28 };

/**
 * Average frame time (ms) below which the probe promotes medium to
 * high. 14 ms is a full frame of headroom at 60 fps: a device
 * averaging under it is sustaining ~70 fps on the medium chain, so
 * it can afford MSAA 4, full-resolution GTAO and 4096 shadow maps.
 * Promotion is one-shot, like demotion — the probe runs once and
 * never oscillates.
 */
const PROMOTE_MS = 14;

/**
 * The probe's one-shot decision, pure so it can be tested without a
 * renderer: demote when the measured frame time is over the tier's
 * budget, promote medium to high when it is comfortably under it,
 * and otherwise keep the tier `resolveTier()` assigned. Low never
 * promotes: it is the save-data / small-device tier, and its
 * protections are not the probe's to lift.
 */
export function decideTier(base: QualityTier, avgFrameMs: number): QualityTier {
  if (avgFrameMs > DEMOTE_MS[base]) return demote(base);
  if (base === 'medium' && avgFrameMs < PROMOTE_MS) return 'high';
  return base;
}
const PROBE_DELAY_MS = 3000;
const PROBE_FRAMES = 90;
const PROBE_WARMUP_FRAMES = 30;

function demote(tier: QualityTier): QualityTier {
  if (tier === 'high') return 'medium';
  if (tier === 'medium') return 'low';
  return 'low';
}

export function useQualityTier(): QualityProfile {
  const [profile, setProfile] = useState<QualityProfile>(() => getQualityProfile('medium'));

  useEffect(() => {
    const base = resolveTier();
    setProfile(base);

    // One-shot frame-time probe: the static tier is a guess from cores and
    // pointer type; the probe replaces it with a measurement. It runs
    // once, so it cannot oscillate — and its decision is one-shot in
    // either direction: it demotes a tier that cannot hold its frame
    // budget, and it promotes medium to high when the measured frame
    // time leaves a full frame of headroom (see `decideTier`). It
    // starts late and skips its first frames so first-paint load does
    // not read as a slow device. Changing the tier rebuilds the
    // composer once (PostProcessing already rebuilds when the profile
    // changes).
    let cancelled = false;
    let raf = 0;
    const timer = window.setTimeout(() => {
      let frames = 0;
      let total = 0;
      let last = 0;
      const tick = (t: number) => {
        if (cancelled) return;
        if (last > 0) {
          frames += 1;
          if (frames > PROBE_WARMUP_FRAMES) total += t - last;
        }
        last = t;
        if (frames < PROBE_WARMUP_FRAMES + PROBE_FRAMES) {
          raf = requestAnimationFrame(tick);
          return;
        }
        const avg = total / PROBE_FRAMES;
        const next = decideTier(base.tier, avg);
        if (next !== base.tier) {
          setProfile(getQualityProfile(next));
        }
      };
      raf = requestAnimationFrame(tick);
    }, PROBE_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, []);

  return profile;
}
