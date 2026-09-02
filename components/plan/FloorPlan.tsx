'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { createFloorPlanModel, createPlanEnvelope } from '@/lib/experience/floorplan';
import { SPACES } from '@/lib/experience/spaces';
import { cn } from '@/lib/utils/cn';

/** Plan label type size, in metres of the drawing. */
const LABEL_SIZE = 0.62;
/** Rough advance width per character at that size, for the fit test. */
const LABEL_ADVANCE = 0.66;
const LABEL_MIN_HEIGHT = 1.9;

/**
 * A room only gets a label drawn inside it if the label actually fits.
 * Everything else is named in the schedule alongside the plan, which hover
 * keeps in sync — a drawing with overlapping room names is not a drawing.
 */
function labelFits(label: string, width: number, height: number): boolean {
  return height >= LABEL_MIN_HEIGHT && label.length * LABEL_SIZE * LABEL_ADVANCE <= width - 0.5;
}

/**
 * The drawn plans. Every outline here is projected from the same room
 * schedule that generates the 3D model, so the drawing and the building can
 * never disagree — this is the residence seen from above, not an
 * illustration of it.
 *
 * Rooms that also exist as a named space in the explorer link straight
 * through to that space's framing.
 */
export function FloorPlan() {
  const model = useMemo(() => createFloorPlanModel(), []);
  const envelope = useMemo(() => createPlanEnvelope(), []);
  const spaceByRoom = useMemo(
    () => new Map(SPACES.filter((s) => s.room).map((s) => [s.room as string, s])),
    [],
  );

  const [levelId, setLevelId] = useState<'ground' | 'upper'>('ground');
  const [hovered, setHovered] = useState<string | null>(null);

  const level = model.levels.find((entry) => entry.id === levelId) ?? model.levels[0]!;
  const { bounds } = model;

  return (
    <div className="flex flex-col gap-10">
      <div
        role="tablist"
        aria-label="Level"
        className="border-alabaster/10 bg-obsidian flex w-full max-w-sm gap-px border"
      >
        {model.levels.map((entry) => {
          const active = entry.id === levelId;
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              id={`level-tab-${entry.id}`}
              aria-selected={active}
              aria-controls={`level-panel-${entry.id}`}
              onClick={() => setLevelId(entry.id)}
              data-cursor="link"
              className={cn(
                'ease-luxe flex-1 px-4 py-3 font-sans text-[0.625rem] tracking-[0.24em] uppercase transition-colors duration-300',
                active ? 'bg-alabaster text-obsidian' : 'text-mist hover:text-alabaster',
              )}
            >
              {entry.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`level-panel-${level.id}`}
        aria-labelledby={`level-tab-${level.id}`}
        className="grid gap-10 lg:grid-cols-12 lg:gap-14"
      >
        <div className="lg:col-span-8">
          <svg
            viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`}
            role="img"
            aria-label={`${level.label} plan of the residence, ${level.rooms.length} rooms`}
            className="border-alabaster/10 bg-ink h-auto w-full border"
          >
            {/* Building envelope, drawn as a hairline so the rooms read as
                sitting inside a known outline. */}
            <rect
              x={envelope.x}
              y={envelope.y}
              width={envelope.width}
              height={envelope.height}
              fill="none"
              stroke="var(--color-alabaster)"
              strokeOpacity={0.18}
              strokeWidth={0.12}
            />

            {level.rooms.map((room) => {
              const space = spaceByRoom.get(room.id);
              const active = hovered === room.id;
              const fits = labelFits(room.label, room.width, room.height);

              return (
                <g
                  key={room.id}
                  onMouseEnter={() => setHovered(room.id)}
                  onMouseLeave={() => setHovered(null)}
                  className={space ? 'cursor-pointer' : undefined}
                >
                  <rect
                    x={room.x}
                    y={room.y}
                    width={room.width}
                    height={room.height}
                    fill="var(--color-alabaster)"
                    fillOpacity={active ? 0.16 : 0.05}
                    stroke={active ? 'var(--color-gold)' : 'var(--color-alabaster)'}
                    strokeOpacity={active ? 1 : 0.35}
                    strokeWidth={active ? 0.14 : 0.08}
                    className="transition-all duration-300"
                  />
                  {fits ? (
                    <text
                      x={room.x + room.width / 2}
                      y={room.y + room.height / 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={active ? 'var(--color-alabaster)' : 'var(--color-mist)'}
                      style={{ fontSize: LABEL_SIZE, letterSpacing: 0.06 }}
                      className="pointer-events-none font-sans uppercase transition-colors duration-300"
                    >
                      {room.label}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>

          <p className="text-stone mt-4 text-xs">
            North is at the top. Plans are projected from the generated room schedule.
          </p>
        </div>

        <div className="flex flex-col gap-6 lg:col-span-4">
          <div className="flex flex-col gap-2">
            <p className="text-eyebrow text-stone uppercase">{level.label}</p>
            <p className="text-mist text-sm leading-relaxed">{level.detail}</p>
          </div>

          <ul className="border-alabaster/10 flex flex-col border-t">
            {level.rooms.map((room) => {
              const space = spaceByRoom.get(room.id);
              const area = Math.round(room.width * room.height);

              return (
                <li key={room.id} className="border-alabaster/10 border-b">
                  <div
                    onMouseEnter={() => setHovered(room.id)}
                    onMouseLeave={() => setHovered(null)}
                    className={cn(
                      'ease-luxe flex items-baseline justify-between gap-4 py-3 transition-colors duration-300',
                      hovered === room.id ? 'text-alabaster' : 'text-mist',
                    )}
                  >
                    {space ? (
                      <Link
                        href={`/experience?space=${space.id}`}
                        data-cursor="link"
                        className="hover:text-gold text-sm transition-colors"
                      >
                        {room.label}
                      </Link>
                    ) : (
                      <span className="text-sm">{room.label}</span>
                    )}
                    <span className="text-stone text-xs tabular-nums">{area} m²</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default FloorPlan;
