import { Reveal } from '@/components/effects/Reveal';
import { Container } from '@/components/ui/Container';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { PROPERTY } from '@/lib/constants/site';

/**
 * The full specification, set as an architectural schedule rather than a
 * grid of cards. Entries read from the residence's own room schedule are
 * marked as such, so nothing here is presented as a surveyed measurement of
 * a building that stands.
 */
export function PropertySpecs() {
  return (
    <section className="py-section" aria-labelledby="specification-heading">
      <Container className="flex flex-col gap-14">
        <Reveal>
          <SectionHeading
            eyebrow="Specification"
            title={<span id="specification-heading">The residence, in figures</span>}
            lede="Counts marked below are read from the residence's own room schedule.
              Areas and elevations describe the residence as designed."
          />
        </Reveal>

        <dl className="border-alabaster/10 bg-alabaster/10 grid grid-cols-2 gap-px border md:grid-cols-4">
          {PROPERTY.specification.map((item, index) => (
            <Reveal key={item.label} delay={index * 50} className="bg-obsidian">
              <div className="flex h-full flex-col gap-2 p-6 sm:p-8">
                <dt className="text-eyebrow text-stone flex items-center gap-2 uppercase">
                  {item.label}
                  {item.derived ? (
                    <span
                      title="Counted from the room schedule"
                      aria-label="Counted from the room schedule"
                      className="bg-gold-dim inline-block h-1 w-1 rounded-full"
                    />
                  ) : null}
                </dt>
                <dd className="font-display text-alabaster text-3xl leading-none font-light sm:text-4xl">
                  {item.value}
                </dd>
                <p className="text-stone mt-1 text-xs leading-relaxed">{item.note}</p>
              </div>
            </Reveal>
          ))}
        </dl>

        <p className="text-stone flex items-center gap-2 text-xs">
          <span aria-hidden="true" className="bg-gold-dim inline-block h-1 w-1 rounded-full" />
          Counted from the room schedule.
        </p>
      </Container>
    </section>
  );
}
