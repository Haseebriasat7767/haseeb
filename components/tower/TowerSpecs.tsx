import { Reveal } from '@/components/effects/Reveal';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { towerSpecification } from '@/lib/property/tower';

/**
 * The tower in figures, set as the residence's specification is.
 *
 * Every value here is counted from `createTowerLayout()` — the same
 * function the 3D scene builds the building from — rather than written
 * alongside it. That is the whole point: the residence published an
 * interior area 280 m² larger than its own plans for months because the
 * number and the model had no relationship. These two cannot come apart,
 * and `tests/tower-figures.test.ts` fails with the new figure if the
 * building changes.
 *
 * So there is no `derived` flag and no dot in the margin, as there is on
 * the residence's table where some rows are asserted and some are counted.
 * Here every row is counted, and the note under the table says so once.
 */
export function TowerSpecs() {
  return (
    <section aria-labelledby="tower-spec-heading" className="flex flex-col gap-12">
      <Reveal>
        <SectionHeading
          eyebrow="Specification"
          title={<span id="tower-spec-heading">The building, in figures</span>}
          lede="Every figure below is counted from the same geometry the view above is
            drawn from. None of it is written by hand, so none of it can drift from
            the building."
        />
      </Reveal>

      <dl className="border-alabaster/10 bg-alabaster/10 grid grid-cols-2 gap-px border md:grid-cols-4">
        {towerSpecification().map((item, index) => (
          // A definition list may hold only `dt`, `dd` and a single `div`
          // between them, so `Reveal` is that div — same construction as
          // `PropertySpecs`, for the same validity reason.
          <Reveal
            key={item.label}
            delay={index * 50}
            className="bg-obsidian flex h-full flex-col gap-2 p-6 sm:p-8"
          >
            <dt className="text-eyebrow text-stone uppercase">{item.label}</dt>
            <dd className="flex flex-col">
              <span className="font-display text-alabaster text-3xl leading-none font-light sm:text-4xl">
                {item.value}
              </span>
              <span className="text-stone mt-3 text-xs leading-relaxed">{item.note}</span>
            </dd>
          </Reveal>
        ))}
      </dl>

      <p className="text-stone text-xs">
        Counted from the tower&rsquo;s own geometry, not from a specification written beside it.
      </p>
    </section>
  );
}
