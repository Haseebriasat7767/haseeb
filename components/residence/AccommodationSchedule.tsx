'use client';

import { useMemo } from 'react';
import { createFloorPlanModel } from '@/lib/experience/floorplan';

/**
 * The accommodation, level by level. Rooms and areas are read from the same
 * schedule that generates both the model and the drawn plans, so this table
 * cannot drift out of step with the building it describes.
 */
export function AccommodationSchedule() {
  const model = useMemo(() => createFloorPlanModel(), []);

  return (
    <div className="flex flex-col gap-14">
      {model.levels.map((level) => {
        const total = level.rooms.reduce((sum, room) => sum + room.width * room.height, 0);

        return (
          <section
            key={level.id}
            className="flex flex-col gap-6"
            aria-labelledby={`acc-${level.id}`}
          >
            <div className="border-alabaster/10 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 border-b pb-4">
              <h3
                id={`acc-${level.id}`}
                className="font-display text-alabaster text-2xl font-light"
              >
                {level.label}
              </h3>
              <p className="text-stone text-xs tracking-[0.2em] uppercase tabular-nums">
                {level.rooms.length} rooms · {Math.round(total)} m²
              </p>
            </div>

            <ul className="grid gap-x-10 gap-y-3 sm:grid-cols-2">
              {level.rooms.map((room) => (
                <li
                  key={room.id}
                  className="border-alabaster/10 flex items-baseline justify-between gap-4 border-b pb-3"
                >
                  <span className="text-mist text-sm">{room.label}</span>
                  <span className="text-stone shrink-0 text-xs tabular-nums">
                    {Math.round(room.width * room.height)} m²
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
