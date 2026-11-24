'use client';

import { Html } from '@react-three/drei';
import { useMemo } from 'react';
import { towerInventory, type Unit } from '@/lib/property/tower-inventory';
import { createTowerLayout } from './TowerGeometry';
import { SHOW_UNIT_FLOOR } from '@/lib/three/tower-units';
import { cn } from '@/lib/utils/cn';

type UnitHotspotsProps = {
  onSelectUnit: (unit: Unit) => void;
};

/**
 * Clickable unit markers on the tower's ocean facade — the front door of
 * the click-to-enter flow. One dot per residential floor, on the glass line
 * just outside the balconies; the show unit (the furnished floor) wears
 * gold so the visitor can see which one opens. Hidden once inside a unit
 * or on foot, by the page that mounts this.
 *
 * Dots are 16px, not the 24px of the residence markers: fourteen floors
 * are 3.4 m apart, which is ~24px on screen from the aerial, so 24px dots
 * would overlap each other.
 */
export function UnitHotspots({ onSelectUnit }: UnitHotspotsProps) {
  const units = useMemo(() => {
    const plates = createTowerLayout().residentialPlates.filter((plate) => plate.level > 0);
    const byFloor = new Map(towerInventory().map((unit) => [unit.floor, unit]));
    return plates.flatMap((plate) => {
      const unit = byFloor.get(plate.level);
      return unit ? [{ plate, unit }] : [];
    });
  }, []);

  return (
    <>
      {units.map(({ plate, unit }) => {
        const show = unit.floor === SHOW_UNIT_FLOOR;
        return (
          <Html
            key={unit.id}
            position={[6.8, plate.floorY + 1.6, 0]}
            center
            zIndexRange={[15, 10]}
            style={{ pointerEvents: 'none' }}
          >
            <button
              type="button"
              onClick={() => onSelectUnit(unit)}
              aria-label={
                show ? `Unit ${unit.id} — enter the show unit` : `Unit ${unit.id} — view this floor`
              }
              className="group ease-luxe pointer-events-auto flex items-center gap-0 transition-opacity duration-500 opacity-80 hover:opacity-100 -m-2 p-2"
            >
              <span
                aria-hidden="true"
                className={cn(
                  'ease-luxe relative flex h-4 w-4 shrink-0 items-center justify-center',
                  'rounded-pill border transition-all duration-500',
                  show
                    ? 'border-gold bg-gold/25'
                    : 'border-alabaster/60 bg-obsidian/40 group-hover:border-gold backdrop-blur-[2px]',
                )}
              >
                <span
                  className={cn(
                    'rounded-pill ease-luxe block transition-all duration-500',
                    show ? 'bg-gold h-1.5 w-1.5' : 'bg-alabaster group-hover:bg-gold h-1 w-1',
                  )}
                />
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
                Unit {unit.id}
              </span>
            </button>
          </Html>
        );
      })}
    </>
  );
}

export default UnitHotspots;
