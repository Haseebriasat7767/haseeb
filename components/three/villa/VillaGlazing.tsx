'use client';

import { EntranceDoor } from './openings/EntranceDoor';
import { SlidingDoor } from './openings/SlidingDoor';
import { WindowSystem } from './openings/WindowSystem';
import type { VillaLayout } from './VillaTypes';

/**
 * Every opening in the building. The three systems below share one schedule
 * resolved from the villa layout, so window positions, mullion spacing, and
 * door widths all follow the villa's own dimensions.
 */
export function VillaGlazing({ layout }: { layout: VillaLayout }) {
  return (
    <group name="Glazing">
      <WindowSystem openings={layout.openings} />
      <SlidingDoor openings={layout.openings} />
      <EntranceDoor openings={layout.openings} />
    </group>
  );
}
