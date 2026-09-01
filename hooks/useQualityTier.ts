'use client';

import { useEffect, useState } from 'react';
import { getQualityProfile } from '@/lib/three/scene-config';
import type { QualityProfile } from '@/types';

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

  if (saveData || (coarsePointer && cores <= 4)) return getQualityProfile('low');
  if (coarsePointer || smallViewport || cores <= 8) return getQualityProfile('medium');
  return getQualityProfile('high');
}

export function useQualityTier(): QualityProfile {
  const [profile, setProfile] = useState<QualityProfile>(() => getQualityProfile('medium'));

  useEffect(() => {
    setProfile(resolveTier());
  }, []);

  return profile;
}
