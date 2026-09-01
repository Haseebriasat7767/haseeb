import { Reveal } from '@/components/effects/Reveal';
import { Container } from '@/components/ui/Container';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { PROPERTY } from '@/lib/constants/site';

/** Property identity and key figures, set as an editorial data table. */
export function PropertyIntro() {
  return (
    <section className="py-section" aria-labelledby="property-heading">
      <Container className="grid gap-16 lg:grid-cols-12 lg:gap-20">
        <div className="lg:col-span-5">
          <Reveal>
            <SectionHeading
              eyebrow="The Residence"
              title={
                <span id="property-heading">
                  {PROPERTY.name}
                  <span className="text-bone block italic">{PROPERTY.location}</span>
                </span>
              }
              lede={`Designed by ${PROPERTY.architect}, the residence occupies a private
                ledge above the coast — oriented for a single, uninterrupted view.`}
            />
          </Reveal>
        </div>

        <div className="lg:col-span-7">
          <dl className="border-alabaster/10 bg-alabaster/10 grid grid-cols-2 gap-px border sm:grid-cols-4 lg:grid-cols-2">
            {PROPERTY.stats.map((stat, index) => (
              <Reveal key={stat.label} delay={index * 70} className="bg-obsidian">
                <div className="flex h-full flex-col gap-3 p-6 sm:p-8">
                  <dt className="text-eyebrow text-stone uppercase">{stat.label}</dt>
                  <dd className="font-display text-alabaster text-3xl font-light sm:text-4xl">
                    {stat.value}
                  </dd>
                </div>
              </Reveal>
            ))}
          </dl>
        </div>
      </Container>
    </section>
  );
}
