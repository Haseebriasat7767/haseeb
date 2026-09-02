'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExperienceViewport } from '@/components/experience/ExperienceViewport';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { DEFAULT_TIME_OF_DAY } from '@/lib/three/lighting';
import { findSpace, SPACES } from '@/lib/experience/spaces';
import type { Space } from '@/lib/experience/spaces';
import type { TimeOfDay } from '@/types';
import { SpacePanel } from './SpacePanel';
import { SpaceRail } from './SpaceRail';
import { TimeOfDayControl } from './TimeOfDayControl';

const DEFAULT_SPACE = SPACES[0]!;

/**
 * The residence explorer. One canvas, one camera, and a set of named
 * spaces: selecting a space in the rail or clicking its marker on the model
 * eases the camera to that framing and opens its details. Nothing here
 * navigates — the scene is never torn down and rebuilt.
 */
export function ResidenceExplorer() {
  const params = useSearchParams();
  const reducedMotion = useReducedMotion();

  const requested = params.get('space');
  const [framedId, setFramedId] = useState<string>(
    () => findSpace(requested ?? '')?.id ?? DEFAULT_SPACE.id,
  );
  const [openId, setOpenId] = useState<string | null>(() => findSpace(requested ?? '')?.id ?? null);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(DEFAULT_TIME_OF_DAY);

  // A deep link arriving after mount (client navigation) should still land.
  useEffect(() => {
    const target = findSpace(requested ?? '');
    if (!target) return;
    setFramedId(target.id);
    setOpenId(target.id);
  }, [requested]);

  const framed = useMemo(() => findSpace(framedId) ?? DEFAULT_SPACE, [framedId]);
  const open = useMemo(() => (openId ? (findSpace(openId) ?? null) : null), [openId]);

  const select = useCallback((space: Space) => {
    setFramedId(space.id);
    setOpenId(space.id);
  }, []);

  const frame = useCallback((space: Space) => setFramedId(space.id), []);
  const close = useCallback(() => setOpenId(null), []);

  return (
    <div className="relative">
      <div className="relative h-[68svh] w-full overflow-hidden sm:h-[78svh] lg:h-[82svh]">
        <ExperienceViewport
          className="absolute inset-0 h-full w-full"
          view={framed.view}
          mode="journey"
          timeOfDay={timeOfDay}
          parallax={reducedMotion ? 0 : 1}
          label={`Interactive residence, currently framing the ${framed.name.toLowerCase()}`}
          hotspots={{ activeId: openId, onSelect: select }}
        >
          <div
            aria-hidden="true"
            className="from-obsidian/70 pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t to-transparent lg:hidden"
          />
        </ExperienceViewport>

        <SpacePanel space={open} onClose={close} onFocusSpace={frame} />
      </div>

      <div className="border-alabaster/10 grid gap-10 border-t pt-10 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-7">
          <SpaceRail activeId={framedId} onSelect={select} />
        </div>
        <div className="flex flex-col gap-8 lg:col-span-5">
          <TimeOfDayControl value={timeOfDay} onChange={setTimeOfDay} />
          <p className="text-stone max-w-[42ch] text-xs leading-relaxed">
            Select a space to move the camera to it — markers on the model open the same details.
            Moving the pointer across the frame shifts the camera slightly, the way a hand-held
            architectural camera would. The hour changes the lighting state, not the geometry.
          </p>
        </div>
      </div>
    </div>
  );
}

export default ResidenceExplorer;
