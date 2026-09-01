import { Reveal } from '@/components/effects/Reveal';
import { Container } from '@/components/ui/Container';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { ExperienceViewport } from './ExperienceViewport';

/**
 * Landing-page window into the real-time scene. Phase 1 renders placeholder
 * massing; the surrounding composition is final.
 */
export function ExperiencePreview() {
  return (
    <section className="py-section" aria-labelledby="experience-heading">
      <Container className="flex flex-col gap-12">
        <Reveal className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <SectionHeading
            eyebrow="Real-time"
            title={<span id="experience-heading">The residence, rendered live</span>}
          />
          <p className="text-stone max-w-[38ch] text-sm leading-relaxed">
            Drag to orbit the massing model. The full procedural residence arrives in the next phase
            of the experience.
          </p>
        </Reveal>

        <Reveal delay={100}>
          <ExperienceViewport
            className="border-alabaster/10 aspect-[4/5] w-full border sm:aspect-[16/10] lg:aspect-[21/9]"
            label="Interactive massing model of the residence"
          />
        </Reveal>
      </Container>
    </section>
  );
}
