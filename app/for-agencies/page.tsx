import type { Metadata } from 'next';
import { Reveal } from '@/components/effects/Reveal';
import { BrochureButton } from '@/components/property/BrochureButton';
import { DirectChannels } from '@/components/contact/DirectChannels';
import { EnquiryForm } from '@/components/contact/EnquiryForm';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { CLIENT } from '@/lib/constants/client';

const CANONICAL_PATH = '/for-agencies';

export const metadata: Metadata = {
  alternates: { canonical: CANONICAL_PATH },
  title: 'For Agencies & Developers',
  description:
    'AURELIA is a working example of an interactive digital property experience — built for developments that need to be seen before they can be built.',
  openGraph: {
    url: CANONICAL_PATH,
    images: ['/opengraph-image'],
    title: 'For Agencies & Developers — AURELIA',
    description:
      'An interactive digital property experience, built for developments that need to be seen before they can be built.',
  },
};

const WHAT_WE_BUILD = [
  'Interactive 3D property, walkable in real time',
  'Guided and free-roam virtual walkthroughs',
  'Floor-plan navigation, connected to the 3D model',
  'Time-of-day visualization, from morning to night',
  'Digital brochures, generated from the same data as the model',
  'Private enquiry systems, with real delivery to your team',
  'White-label deployment under your own domain and branding',
] as const;

const WHO_ITS_FOR = [
  'Real-estate developers',
  'Luxury property agencies',
  'Architects',
  'Property marketers',
  'Off-plan developments',
  'Pre-launch sales campaigns',
] as const;

const OUTCOMES = [
  {
    title: 'Help buyers understand space',
    body: 'A floor plan and a set of renderings ask a buyer to imagine a building. A walkthrough lets them stand in it.',
  },
  {
    title: 'Create stronger pre-launch presentations',
    body: 'Golden hour, blue hour, a private viewing from the terrace — the same property, shown the way it will actually be lived in.',
  },
  {
    title: 'Give sales teams an interactive demonstration',
    body: 'A link a sales team can send, and a client can explore on their own, on their own time — not a meeting-room-only deck.',
  },
  {
    title: 'Make unbuilt developments tangible',
    body: 'The building does not have to exist to be walked through. That is the entire premise this project demonstrates.',
  },
  {
    title: 'Differentiate a premium listing',
    body: 'Most listings at this price point still lead with photography and PDF. An interactive model is still rare enough to stand out.',
  },
] as const;

const BEFORE = [
  'Static renderings',
  'A PDF floor plan',
  'A printed or emailed brochure',
  'Photography, available only after completion',
] as const;

const AFTER = [
  'Walk through the property, from any device',
  'Explore every room, at your own pace',
  'Change the time of day and see it differently',
  'Move between the floor plan and the space itself',
  'Request a private viewing, without leaving the page',
  'Experience the property before a single wall is built',
] as const;

export default function ForAgenciesPage() {
  return (
    <>
      <PageHeader
        eyebrow="For agencies & developers"
        title="Sell the property before it exists."
        lede="We build interactive digital property experiences for developments that need to
          be experienced before they can be photographed, visited or completed."
      />

      <section className="py-section" aria-labelledby="what-we-build-heading">
        <Container className="flex flex-col gap-14">
          <Reveal>
            <SectionHeading
              eyebrow="What we build"
              title={<span id="what-we-build-heading">One experience, not a slide deck</span>}
            />
          </Reveal>

          <ul className="border-alabaster/10 bg-alabaster/10 grid grid-cols-1 gap-px border sm:grid-cols-2">
            {WHAT_WE_BUILD.map((item, index) => (
              <Reveal
                key={item}
                as="li"
                delay={index * 40}
                className="bg-obsidian flex min-h-16 items-center p-6 sm:p-7"
              >
                <span className="text-bone text-sm leading-relaxed">{item}</span>
              </Reveal>
            ))}
          </ul>
        </Container>
      </section>

      <section className="py-section" aria-labelledby="who-its-for-heading">
        <Container className="flex flex-col gap-14">
          <Reveal>
            <SectionHeading
              eyebrow="Who it is for"
              title={<span id="who-its-for-heading">Built for who sells before it is built</span>}
            />
          </Reveal>

          <ul className="flex flex-wrap gap-3">
            {WHO_ITS_FOR.map((item) => (
              <li
                key={item}
                className="border-alabaster/20 text-eyebrow text-mist border px-5 py-3 uppercase"
              >
                {item}
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section className="py-section" aria-labelledby="outcome-heading">
        <Container className="flex flex-col gap-14">
          <Reveal>
            <SectionHeading
              eyebrow="The outcome"
              title={<span id="outcome-heading">What it actually changes</span>}
              lede="Not a promise of a conversion number — a description of what the experience
                does differently from a brochure."
            />
          </Reveal>

          <div className="border-alabaster/10 bg-alabaster/10 grid gap-px border sm:grid-cols-2">
            {OUTCOMES.map((outcome, index) => (
              <Reveal
                key={outcome.title}
                delay={index * 50}
                className="bg-obsidian flex flex-col gap-3 p-7 sm:p-8"
              >
                <p className="font-display text-alabaster text-xl leading-tight font-semibold">
                  {outcome.title}
                </p>
                <p className="text-mist text-sm leading-relaxed">{outcome.body}</p>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      <section className="py-section" aria-labelledby="comparison-heading">
        <Container className="flex flex-col gap-14">
          <Reveal>
            <SectionHeading
              eyebrow="Before / after"
              title={<span id="comparison-heading">What changes for a buyer</span>}
            />
          </Reveal>

          <div className="border-alabaster/10 bg-alabaster/10 grid gap-px border md:grid-cols-2">
            <Reveal className="bg-obsidian flex flex-col gap-6 p-8 sm:p-10">
              <p className="text-eyebrow text-stone uppercase">Traditional presentation</p>
              <ul className="flex flex-col gap-4">
                {BEFORE.map((item) => (
                  <li key={item} className="text-mist border-alabaster/10 border-t pt-4 text-sm">
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={80} className="bg-obsidian flex flex-col gap-6 p-8 sm:p-10">
              <p className="text-eyebrow text-gold uppercase">The AURELIA experience</p>
              <ul className="flex flex-col gap-4">
                {AFTER.map((item) => (
                  <li key={item} className="text-bone border-alabaster/10 border-t pt-4 text-sm">
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </Container>
      </section>

      {/*
        The commercial enquiry itself, on this page rather than behind a
        link to `/contact`.

        A developer who has read this far has already decided to ask; sending
        them to the buyer's viewing form to start over would lose most of
        them, and would reach the client's inbox labelled as a viewing
        request for a residence that does not exist. Same form component,
        same route, same validation — `kind="commercial"` is the whole
        difference, and it is what makes the lead legible at the other end.
      */}
      <section className="py-section-lg" aria-labelledby="agencies-cta-heading" id="create">
        <Container className="flex flex-col gap-12">
          <Reveal>
            <SectionHeading
              eyebrow="Discuss a project"
              title={<span id="agencies-cta-heading">Create this for your property.</span>}
              lede="The residence and tower shown here are conceptual. The architecture, the
                floor plans, the walkthrough and the enquiry system behind them are the same
                system that would be built for a real development."
            />
          </Reveal>

          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-16">
            <Reveal delay={120}>
              <EnquiryForm kind="commercial" />
            </Reveal>

            <Reveal delay={200} className="flex flex-col gap-8">
              <DirectChannels />
              {CLIENT.brochurePath ? (
                <div className="border-alabaster/10 flex flex-col gap-4 border p-6">
                  <p className="text-eyebrow text-stone uppercase">Before you write</p>
                  <p className="text-mist text-sm leading-relaxed">
                    The brochure is generated from the same model the walkthrough is built from — a
                    working example of what the system produces.
                  </p>
                  <BrochureButton />
                </div>
              ) : null}
            </Reveal>
          </div>
        </Container>
      </section>
    </>
  );
}
