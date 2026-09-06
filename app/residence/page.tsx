import type { Metadata } from 'next';
import { AccommodationSchedule } from '@/components/residence/AccommodationSchedule';
import { Reveal } from '@/components/effects/Reveal';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { PROPERTY } from '@/lib/constants/site';
import { PALETTE } from '@/lib/experience/palette';

export const metadata: Metadata = {
  title: 'The Residence',
  description:
    'The architectural concept, material palette, and full accommodation schedule of Residence No. 01 at Coastal Ridge — four bedrooms, three bathrooms, across two levels.',
  openGraph: {
    title: 'The Residence — AURELIA',
    description:
      'Architectural concept, material palette, and accommodation schedule of Residence No. 01.',
  },
};

export default function ResidencePage() {
  return (
    <>
      <PageHeader
        eyebrow="The Residence"
        title={PROPERTY.name}
        lede={`${PROPERTY.location}. Designed by ${PROPERTY.architect} and completed in
          ${PROPERTY.year} — a single continuous volume set against the ridge, oriented
          for one uninterrupted view.`}
      />

      <Container className="pb-section flex flex-col gap-24">
        <section
          aria-labelledby="concept-heading"
          className="grid gap-12 lg:grid-cols-12 lg:gap-20"
        >
          <div className="lg:col-span-5">
            <Reveal>
              <SectionHeading
                eyebrow="Concept"
                title={<span id="concept-heading">Mass, shadow, and horizon</span>}
              />
            </Reveal>
          </div>
          <div className="flex flex-col gap-6 lg:col-span-7">
            <Reveal delay={80}>
              <p className="text-lede text-mist">
                A rear service bar holds the private rooms. Two stone wings push forward from it,
                and the glazed living volume occupies the gap they leave — so the house is read as
                two solids and the light between them.
              </p>
            </Reveal>
            <Reveal delay={140}>
              <p className="text-mist text-sm leading-relaxed">
                Above, the upper floor cantilevers four metres past the building line over the
                terrace, and a two-storey slot is cut through both levels at the entrance and roofed
                in glass. Nothing is decorative. Every element is structural, and the landscape is
                invited to do the rest.
              </p>
            </Reveal>
          </div>
        </section>

        <section aria-labelledby="palette-heading" className="flex flex-col gap-12">
          <Reveal>
            <SectionHeading
              eyebrow="Materials"
              title={<span id="palette-heading">Six finishes, and no others</span>}
              lede="The palette is deliberately short. Each finish below is a material the
                model is genuinely rendered with, not a specification written after the fact."
            />
          </Reveal>

          <dl className="border-alabaster/10 grid border-t sm:grid-cols-2 lg:grid-cols-3">
            {PALETTE.map((finish, index) => (
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

        <section aria-labelledby="accommodation-heading" className="flex flex-col gap-12">
          <Reveal>
            <SectionHeading
              eyebrow="Accommodation"
              title={<span id="accommodation-heading">Room by room</span>}
              lede="Areas are computed from the residence's room schedule, level by level."
            />
          </Reveal>
          <AccommodationSchedule />
        </section>

        <section className="border-alabaster/10 flex flex-col items-start gap-8 border-t pt-16">
          <SectionHeading
            eyebrow="Enquire"
            title="See it in person"
            lede="Viewings are held by appointment. Share your details and the private client team will respond with a proposed time."
          />
          <div className="flex flex-wrap gap-3">
            <Button href="/contact" magnetic>
              Request private viewing
            </Button>
            <Button href="/floor-plan" variant="outline" magnetic>
              Study the plans
            </Button>
          </div>
        </section>
      </Container>
    </>
  );
}
