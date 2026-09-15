import { spaceArea, spaceFinishes } from '@/lib/experience/space-detail';
import type { Space } from '@/lib/experience/spaces';

/**
 * What the selected space is, in the fewest lines that say anything.
 *
 * Sits under the plan's 3D preview, where the visitor has just chosen a
 * room and wants to know what they are looking at. Deliberately not a card:
 * a hairline rule, a name, a measured area and the finishes — the same
 * restraint the rest of the chrome keeps, because the drawing above it is
 * the thing being sold.
 *
 * Every value is read, never written. The area comes from the plan
 * geometry, the finishes from the material schedule, the prose from the
 * space's own record. A room with no area and no finishes shows neither
 * heading rather than an empty one.
 */
export function SpaceSummary({ space }: { space: Space }) {
  const area = spaceArea(space);
  const finishes = spaceFinishes(space);

  return (
    <div
      // Announced as a unit when the selection changes, so a screen-reader
      // visitor choosing a room on the plan hears what they selected
      // instead of only seeing the outline change.
      aria-live="polite"
      className="border-alabaster/10 mt-6 flex flex-col gap-4 border-t pt-6"
    >
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-eyebrow text-stone uppercase">{space.eyebrow}</p>
          <p className="font-display text-alabaster text-xl leading-tight font-semibold">
            {space.name}
          </p>
        </div>
        {area === null ? null : (
          <p className="text-stone text-sm whitespace-nowrap tabular-nums">{area} m²</p>
        )}
      </div>

      <p className="text-mist text-sm leading-relaxed">{space.feature}</p>

      {finishes.length === 0 ? null : (
        <div className="flex flex-col gap-2">
          <p className="text-eyebrow text-stone uppercase">Material palette</p>
          {/* Typographic, not swatches. The renderer's materials are shaders
              over generated geometry, not texture plates that could be cut
              into thumbnails — a coloured square here would be a guess at
              what the material looks like rather than the material. */}
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
            {finishes.map((finish) => (
              <li key={finish} className="text-bone text-xs tracking-[0.12em] uppercase">
                {finish}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default SpaceSummary;
