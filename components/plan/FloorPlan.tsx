'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { createFloorPlanModel, createPlanEnvelope } from '@/lib/experience/floorplan';
import { trackFloorPlanRoomSelected } from '@/lib/analytics/events';
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
 * through to that space's framing — both the schedule row beside the plan
 * and the drawn shape itself, so the plan reads as a navigable model of the
 * property rather than a picture with a list bolted on next to it.
 */
export function FloorPlan({
  activeSpaceId,
  onSelect,
}: {
  /** The room currently framed in the 3D view, if the visitor arrived here
   *  from it — drawn with the same highlight hover gives, so leaving the
   *  plan and coming back still shows where they are. */
  activeSpaceId?: string;
  /** Called instead of navigating when a room with a matching 3D space is
   *  activated. Omit to fall back to a plain link to `?space=`. */
  onSelect?: (spaceId: string) => void;
}) {
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

  /**
   * The one way a room is chosen, wherever it is chosen from.
   *
   * Both the drawn shape and the schedule row call this, so the analytics
   * event fires once per selection however it was made and neither can
   * quietly acquire behaviour the other lacks.
   */
  const activateSpace = (spaceId: string) => {
    trackFloorPlanRoomSelected(spaceId);
    if (onSelect) onSelect(spaceId);
    else window.location.assign(`/residence?space=${spaceId}`);
  };

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
                'ease-luxe flex min-h-11 flex-1 items-center justify-center px-4 py-3 font-sans text-[0.625rem] tracking-[0.24em] uppercase transition-colors duration-300',
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
              const active = hovered === room.id || activeSpaceId === room.id;
              const fits = labelFits(room.label, room.width, room.height);
              const activate = () => {
                if (space) activateSpace(space.id);
              };

              return (
                <g
                  key={room.id}
                  onMouseEnter={() => setHovered(room.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={space ? activate : undefined}
                  onKeyDown={
                    space
                      ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            activate();
                          }
                        }
                      : undefined
                  }
                  tabIndex={space ? 0 : undefined}
                  role={space ? 'button' : undefined}
                  // An SVG group cannot be a real <button>, so it carries
                  // the role and the key handling itself. `aria-pressed`
                  // gives the selected room a state a screen reader can
                  // read, which the gold outline only conveys visually.
                  aria-pressed={space ? activeSpaceId === room.id : undefined}
                  aria-label={space ? `View ${room.label} in 3D` : undefined}
                  className={cn(
                    space &&
                      'focus-visible:outline-gold cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2',
                  )}
                >
                  {/* A room too small to set its name inside the cell — the
                      guest bathroom, the stair hall — still names itself on
                      hover rather than reading as unlabelled. The schedule
                      beside the plan carries the name too, but a visitor
                      pointing at the drawing itself shouldn't have to look
                      away from the shape they're asking about. */}
                  <title>{room.label}</title>
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
            North is at the top. Plans are drawn to the residence&rsquo;s room schedule.
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
                      'ease-luxe flex min-h-11 items-baseline justify-between gap-4 py-3 transition-colors duration-300',
                      hovered === room.id ? 'text-alabaster' : 'text-mist',
                    )}
                  >
                    {space ? (
                      /*
                       * A button, not a link, whenever the explorer is
                       * listening. The row used to navigate to
                       * `?space=` while the drawn shape beside it called
                       * `onSelect` — the same action taking two different
                       * paths, one of which reloaded the route and threw
                       * away the hour, the tab and the camera's position.
                       * `activate` is the shape's own handler, so the two
                       * cannot diverge again. Without `onSelect` it still
                       * falls back to the link, for the plan rendered
                       * outside the explorer.
                       *
                       * The row is already 44px tall; the control inside it
                       * was only as tall as its own text. Padding out to
                       * the row's edges and pulling the margin back makes
                       * the whole row tappable without moving anything.
                       */
                      onSelect ? (
                        <button
                          type="button"
                          onClick={() => activateSpace(space.id)}
                          data-cursor="link"
                          aria-current={activeSpaceId === room.id ? 'true' : undefined}
                          className="hover:text-gold focus-visible:outline-gold -my-3 inline-flex min-h-11 items-center py-3 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                        >
                          {room.label}
                        </button>
                      ) : (
                        <Link
                          href={`/residence?space=${space.id}`}
                          data-cursor="link"
                          className="hover:text-gold -my-3 inline-flex min-h-11 items-center py-3 text-sm transition-colors"
                        >
                          {room.label}
                        </Link>
                      )
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
