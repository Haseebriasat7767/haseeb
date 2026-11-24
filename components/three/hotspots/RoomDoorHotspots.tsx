'use client';

import { Html } from '@react-three/drei';
import { useMemo } from 'react';
import { findSpace, type Space } from '@/lib/experience/spaces';
import { cn } from '@/lib/utils/cn';
import { createInteriorPlan } from '../villa/interior/InteriorPlan';
import { createVillaLayout, VILLA_CONFIG } from '../villa/VillaGeometry';
import type { DetailTier } from '../villa/VillaTypes';

type RoomDoorHotspotsProps = {
  detail?: DetailTier;
  /** The space currently framed; markers render only for its doors. */
  framedId: string;
  onSelect: (space: Space) => void;
};

/**
 * Door markers between the residence's framed rooms — the same interaction
 * language as the tower's click-to-enter flow: a quiet gold dot on the
 * doorway, labelled with the room beyond it. Only the doors of the room
 * currently framed render, so the frame never fills with markers for rooms
 * the visitor is not in. Positions come from the plan itself
 * (InteriorPlan.doors), not from coordinates authored here.
 */
export function RoomDoorHotspots({ detail = 'high', framedId, onSelect }: RoomDoorHotspotsProps) {
  const doors = useMemo(() => {
    const layout = createVillaLayout(VILLA_CONFIG, detail);
    return createInteriorPlan(layout.plan, layout.levels).doors;
  }, [detail]);

  const here = doors.filter((door) => door.from === framedId || door.to === framedId);
  if (here.length === 0) return null;

  return (
    <>
      {here.map((door) => {
        const otherId = door.from === framedId ? door.to : door.from;
        const other = findSpace(otherId);
        if (!other) return null;
        return (
          <Html
            key={`${door.from}-${door.to}`}
            position={door.position}
            center
            zIndexRange={[15, 10]}
            style={{ pointerEvents: 'none' }}
          >
            <button
              type="button"
              onClick={() => onSelect(other)}
              aria-label={`Go to the ${other.name.toLowerCase()}`}
              className="group ease-luxe pointer-events-auto -m-2.5 flex items-center gap-0 p-2.5 opacity-80 transition-opacity duration-500 hover:opacity-100"
            >
              <span
                aria-hidden="true"
                className="ease-luxe rounded-pill border-gold bg-obsidian/40 group-hover:bg-gold/25 relative flex h-6 w-6 shrink-0 items-center justify-center border backdrop-blur-[2px] transition-all duration-500"
              >
                <span className="rounded-pill ease-luxe bg-gold block h-1.5 w-1.5" />
              </span>

              <span
                aria-hidden="true"
                className="bg-gold/70 ease-luxe h-px w-0 transition-all duration-500 group-hover:w-4"
              />

              <span
                className={cn(
                  'ease-luxe overflow-hidden whitespace-nowrap transition-all duration-500',
                  'text-eyebrow text-alabaster font-sans uppercase',
                  'max-w-0 opacity-0 group-hover:max-w-[16rem] group-hover:pl-2 group-hover:opacity-100',
                )}
              >
                {other.name}
              </span>
            </button>
          </Html>
        );
      })}
    </>
  );
}

export default RoomDoorHotspots;
