'use client';

import { Html } from '@react-three/drei';
import { SHOW_UNIT_DOORS, TOWER_ROOMS, type TowerRoomId } from '@/lib/three/tower-units';
import { cn } from '@/lib/utils/cn';

type TowerRoomHotspotsProps = {
  currentRoom: TowerRoomId;
  onSelectRoom: (room: TowerRoomId) => void;
};

/**
 * Door markers inside the show unit — the room-to-room half of the
 * click-to-enter flow. One dot per doorway, labelled with the room beyond
 * it; only the doors of the room currently framed render, so the frame
 * never fills with markers for rooms the visitor is not in.
 */
export function TowerRoomHotspots({ currentRoom, onSelectRoom }: TowerRoomHotspotsProps) {
  const here = SHOW_UNIT_DOORS.filter(
    (door) => door.from === currentRoom || door.to === currentRoom,
  );
  if (here.length === 0) return null;

  return (
    <>
      {here.map((door) => {
        const otherId = door.from === currentRoom ? door.to : door.from;
        const other = TOWER_ROOMS[otherId];
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
              onClick={() => onSelectRoom(otherId)}
              aria-label={`Go to the ${other.label.toLowerCase()}`}
              className="group ease-luxe pointer-events-auto flex items-center gap-0 transition-opacity duration-500 opacity-80 hover:opacity-100 -m-2.5 p-2.5"
            >
              <span
                aria-hidden="true"
                className="ease-luxe relative flex h-6 w-6 shrink-0 items-center justify-center rounded-pill border border-gold bg-obsidian/40 backdrop-blur-[2px] transition-all duration-500 group-hover:bg-gold/25"
              >
                <span className="rounded-pill ease-luxe block bg-gold h-1.5 w-1.5" />
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
                {other.label}
              </span>
            </button>
          </Html>
        );
      })}
    </>
  );
}

export default TowerRoomHotspots;
