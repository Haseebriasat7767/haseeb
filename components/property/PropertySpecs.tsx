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
            // A definition list may contain only `dt`, `dd` and a single `div`
            // between them — so `Reveal` IS that div, and the note moves inside
            // the `dd` it describes rather than sitting loose after it.
            <Reveal
              key={item.label}
              delay={index * 50}
              className="bg-obsidian flex h-full flex-col gap-2 p-6 sm:p-8"
            >
              <dt className="text-eyebrow text-stone flex items-center gap-2 uppercase">
                {item.label}
                {item.derived ? (
                  <span
                    role="img"
                    title="Counted from the room schedule"
                    aria-label="Counted from the room schedule"
                    className="bg-gold-dim inline-block h-1 w-1 rounded-full"
                  />
                ) : null}
              </dt>
              <dd className="flex flex-col">
                <span className="font-display text-alabaster text-3xl leading-none font-light sm:text-4xl">
                  {item.value}
                </span>
                <span className="text-stone mt-3 text-xs leading-relaxed">{item.note}</span>
              </dd>
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
