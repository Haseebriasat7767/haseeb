import { Reveal } from '@/components/effects/Reveal';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { TOWER_PALETTE } from '@/lib/experience/palette';

/**
 * The same palette as `/residence`, at the tower's own locations.
 *
 * Both buildings are drawn from one material library — that is the whole
 * claim the tower makes about itself, not a coincidence to paper over. So
 * this reuses `PALETTE`'s six finishes rather than inventing a second set:
 * `TOWER_PALETTE` in `lib/experience/palette.ts` carries the same
 * descriptions of each material and only relocates `where` to the tower.
 */
export function TowerMaterials() {
  return (
    <section aria-labelledby="tower-materials-heading" className="flex flex-col gap-12">
      <Reveal>
        <SectionHeading
          eyebrow="Materials"
          title={<span id="tower-materials-heading">One palette, two buildings</span>}
          lede="The tower is drawn from the same six finishes as the residence —
            the same material library, applied at a different scale."
        />
      </Reveal>

      <dl className="border-alabaster/10 grid border-t sm:grid-cols-2 lg:grid-cols-3">
        {TOWER_PALETTE.map((finish, index) => (
          <Reveal
            key={finish.name}
            delay={index * 50}
            className="border-alabaster/10 flex flex-col gap-3 border-b py-8 sm:pr-10"
          >
            <dt className="font-display text-alabaster text-xl font-light">{finish.name}</dt>
            <dd className="flex flex-col gap-2">
              <span className="text-eyebrow text-stone block uppercase">{finish.where}</span>
              <span className="text-mist block text-sm leading-relaxed">{finish.note}</span>
            </dd>
          </Reveal>
        ))}
      </dl>
    </section>
  );
}
