'use client';

import { cn } from '@/lib/utils/cn';
import { PROPERTY } from '@/lib/constants/site';
import type { Space } from '@/lib/experience/spaces';

/**
 * The chrome that sits over a full-bleed architectural view.
 *
 * ## The language this is written in
 *
 * Look at how the marketing sites for buildings of this kind are actually
 * composed — 111 West 57th, Amáli Island — and the common grammar is
 * immediately clear, and it is almost entirely about *restraint*:
 *
 * - The image is full bleed and nothing is allowed into its middle. Every
 *   piece of interface is pinned to an edge.
 * - Type is tiny, widely letter-spaced and uppercase for anything
 *   functional; the only large type is the name of what you are looking at,
 *   set in the display serif.
 * - There is exactly one bright element on the screen. Everything else is
 *   a hairline rule or text at low opacity.
 * - The view has a *number*. It is presented as one plate in a series,
 *   which is what makes a residence read as a portfolio rather than a
 *   gallery of screenshots.
 * - The building's figures appear as a single quiet row, not as cards.
 * - Moving between views is prev/next, named — never a grid of thumbnails
 *   over the image.
 *
 * None of that is decoration. It is what leaves the architecture as the
 * only thing in the frame with any visual weight, which is the entire point
 * of the genre.
 *
 * Everything here is presentational: it renders the space it is handed and
 * calls back. The explorer keeps owning which space is framed.
 */

type CinematicOverlayProps = {
  space: Space;
  index: number;
  total: number;
  previous: Space;
  next: Space;
  onSelect: (space: Space) => void;
  onOpen: () => void;
  /** Hidden while a detail panel is over the view. */
  hidden?: boolean;
};

/** Two digits, so `01` and `11` occupy the same width in a series. */
function ordinal(index: number): string {
  return String(index + 1).padStart(2, '0');
}

/**
 * The figures worth carrying over the image.
 *
 * Three, taken from the same specification the schedule page renders, so
 * the plate can never drift from the residence's own numbers. Three is the
 * count these sites settle on and it is the right one: two reads as thin,
 * four starts to read as a table.
 */
const PILLS = ['Bedrooms', 'Interior', 'Grounds'] as const;

function specPills(): { label: string; value: string }[] {
  return PILLS.map((label) => {
    const entry = PROPERTY.specification.find((item) => item.label === label);
    return { label, value: entry?.value ?? '' };
  }).filter((pill) => pill.value !== '');
}

export function CinematicOverlay({
  space,
  index,
  total,
  previous,
  next,
  onSelect,
  onOpen,
  hidden = false,
}: CinematicOverlayProps) {
  return (
    <div
      className={cn(
        'ease-luxe pointer-events-none absolute inset-0 transition-opacity duration-500',
        hidden ? 'opacity-0' : 'opacity-100',
      )}
      // Hidden from assistive technology as well as sight when a panel is
      // over it, so a screen reader is never offered controls the sighted
      // user cannot see.
      aria-hidden={hidden}
      inert={hidden}
    >
      {/* ── Scroll cue, set vertically down the right edge ─────────────── */}
      <span
        aria-hidden="true"
        className="text-stone absolute top-1/2 right-4 hidden -translate-y-1/2 rotate-180 text-[0.5rem] tracking-[0.35em] uppercase [writing-mode:vertical-rl] lg:block"
      >
        Scroll to learn more
      </span>

      {/* ── The name of what you are looking at ────────────────────────── */}
      {/* Low and centred, the way a plate is captioned. The eyebrow above it
          places the space in the building; the serif carries the name. */}
      <div className="absolute inset-x-0 bottom-36 flex flex-col items-center gap-2 px-6 text-center sm:bottom-40 lg:bottom-44">
        <p className="text-eyebrow text-alabaster/70 uppercase">{space.eyebrow}</p>
        <h2 className="font-display text-alabaster text-3xl leading-none font-light tracking-tight sm:text-4xl lg:text-5xl">
          {space.name}
        </h2>
      </div>

      {/* ── The residence's figures ────────────────────────────────────── */}
      <ul className="absolute inset-x-0 bottom-16 hidden items-center justify-center gap-px px-6 sm:bottom-20 sm:flex lg:bottom-24">
        {specPills().map((pill) => (
          <li
            key={pill.label}
            className="border-alabaster/15 bg-obsidian/40 border px-4 py-2 backdrop-blur-sm"
          >
            <span className="text-eyebrow text-alabaster/85 uppercase">
              {pill.value} <span className="text-stone">{pill.label}</span>
            </span>
          </li>
        ))}
      </ul>

      {/* ── Previous / next, named ─────────────────────────────────────── */}
      <nav
        aria-label="Move between spaces"
        className="pointer-events-auto absolute inset-x-0 bottom-0 flex items-stretch justify-between gap-3 p-4 sm:p-6"
      >
        <button
          type="button"
          onClick={() => onSelect(previous)}
          data-cursor="link"
          className="group ease-luxe border-alabaster/15 bg-obsidian/40 text-alabaster/80 hover:border-alabaster/40 hover:text-alabaster flex max-w-[38%] items-center gap-3 border px-3 py-2.5 text-left backdrop-blur-sm transition-colors duration-300 sm:px-4"
        >
          <span aria-hidden="true" className="text-stone group-hover:text-gold transition-colors">
            ‹
          </span>
          <span className="min-w-0">
            <span className="text-stone block text-[0.5rem] tracking-[0.3em] uppercase">
              Previous
            </span>
            <span className="text-eyebrow block truncate uppercase">{previous.name}</span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSelect(next)}
          data-cursor="link"
          className="group ease-luxe border-alabaster/15 bg-obsidian/40 text-alabaster/80 hover:border-alabaster/40 hover:text-alabaster flex max-w-[38%] items-center gap-3 border px-3 py-2.5 text-right backdrop-blur-sm transition-colors duration-300 sm:px-4"
        >
          <span className="min-w-0">
            <span className="text-stone block text-[0.5rem] tracking-[0.3em] uppercase">Next</span>
            <span className="text-eyebrow block truncate uppercase">{next.name}</span>
          </span>
          <span aria-hidden="true" className="text-stone group-hover:text-gold transition-colors">
            ›
          </span>
        </button>
      </nav>

      {/* ── The plate ──────────────────────────────────────────────────── */}
      {/* The one bright element on the screen, and the only one that reads
          as a control rather than as a caption. It carries the view's number
          in the series and opens its detail. */}
      <button
        type="button"
        onClick={onOpen}
        data-cursor="link"
        className="group ease-luxe bg-alabaster text-obsidian pointer-events-auto absolute top-20 right-4 flex items-center gap-3 py-2.5 pr-2.5 pl-4 transition-transform duration-500 hover:-translate-y-0.5 sm:top-24 sm:right-6"
      >
        <span className="text-gold-deep text-[0.6875rem] tracking-[0.2em] tabular-nums">
          {ordinal(index)}
        </span>
        <span aria-hidden="true" className="bg-obsidian/20 h-4 w-px" />
        <span className="text-eyebrow text-obsidian uppercase">{space.name}</span>
        <span
          aria-hidden="true"
          className="border-obsidian/20 group-hover:border-obsidian/50 ease-luxe flex h-6 w-6 items-center justify-center border text-sm leading-none transition-colors duration-300"
        >
          +
        </span>
        <span className="sr-only">
          — view {ordinal(index)} of {total}. Open details.
        </span>
      </button>
    </div>
  );
}

export default CinematicOverlay;
