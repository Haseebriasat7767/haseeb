import { TrackedViewLink } from './TrackedViewLink';
import { Reveal } from '@/components/effects/Reveal';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { TOWER_VIEWS, TOWER_VIEW_NOTES } from '@/lib/three/tower-views';
import { cn } from '@/lib/utils/cn';

/**
 * Every framing in the walkthrough, as a way in.
 *
 * ## Why the links are indices and not names
 *
 * The residence deep-links by identity — `/experience?space=living` — and
 * the obvious thing was to assume the tower does the same. It does not.
 * `TowerWalkthrough` reads `?step=`, parses it as a number, and accepts
 * `1 <= step <= TOWER_VIEWS.length` before subtracting one; there is no
 * id lookup anywhere in it. So `/tower?step=12` is the twelfth framing,
 * and `/tower?space=residence` is the first framing and a silent no-op.
 *
 * An index is a fragile thing to write down, because reordering the views
 * silently repoints every link that was ever shared. It is a perfectly
 * safe thing to *generate*, which is what happens below: the number comes
 * from the position of the view in the same array the walkthrough indexes,
 * so the two cannot disagree. Nothing here hard-codes a step.
 *
 * ## Why every view, rather than a chosen few
 *
 * Picking six good ones means maintaining a list of six good ones beside a
 * list of eighteen views. The building already decided which framings are
 * worth having when it wrote them; this renders that decision rather than
 * second-guessing it, and a view added to the walkthrough appears here on
 * the same commit.
 */
export function TowerViews() {
  return (
    <section aria-labelledby="tower-views-heading" className="flex flex-col gap-12">
      <Reveal>
        <SectionHeading
          eyebrow="The walkthrough"
          // Counted, never written. A spelled-out number beside an array is
          // how the gallery came to advertise eleven framings of seventeen.
          title={<span id="tower-views-heading">{TOWER_VIEWS.length} ways in</span>}
          lede="Each opens the building on that framing, at whatever hour you choose.
            They are positions a person could stand in, derived from the geometry
            rather than placed by eye."
        />
      </Reveal>

      <ul className="border-alabaster/10 bg-alabaster/10 grid gap-px border sm:grid-cols-2 lg:grid-cols-3">
        {TOWER_VIEWS.map((view, index) => {
          const note = TOWER_VIEW_NOTES[view.id];
          // `?step=` is 1-based — see the parse in `TowerWalkthrough`.
          const step = index + 1;

          return (
            <Reveal as="li" key={view.id} delay={index * 30} className="bg-obsidian">
              <TrackedViewLink
                space={view.id}
                href={`/tower?step=${step}`}
                data-cursor="link"
                className={cn(
                  'group ease-luxe flex h-full flex-col items-start gap-3 p-7 sm:p-8',
                  'hover:bg-ink transition-colors duration-500',
                )}
              >
                <span className="text-eyebrow text-stone uppercase tabular-nums">
                  {String(step).padStart(2, '0')}
                </span>
                <span className="font-display text-alabaster text-2xl leading-none font-light">
                  {view.label}
                </span>
                {note ? (
                  <span className="text-mist mt-1 text-sm leading-relaxed">{note}</span>
                ) : null}
                <span className="text-eyebrow text-gold mt-auto flex items-center gap-2 pt-6 uppercase">
                  Enter this space
                  <span
                    aria-hidden="true"
                    className="ease-luxe transition-transform duration-500 group-hover:translate-x-1"
                  >
                    →
                  </span>
                </span>
              </TrackedViewLink>
            </Reveal>
          );
        })}
      </ul>
    </section>
  );
}
