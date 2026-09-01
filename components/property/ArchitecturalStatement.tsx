import { Reveal } from '@/components/effects/Reveal';
import { Container } from '@/components/ui/Container';
import { Eyebrow } from '@/components/ui/Eyebrow';

/** Short editorial statement — the magazine spread of the page. */
export function ArchitecturalStatement() {
  return (
    <section className="py-section" aria-labelledby="statement-heading">
      <Container width="editorial" className="flex flex-col gap-10">
        <Reveal>
          <Eyebrow>The Statement</Eyebrow>
        </Reveal>

        <Reveal delay={80}>
          <h2
            id="statement-heading"
            className="text-display-md text-balance-tight font-display text-alabaster font-light"
          >
            Architecture as restraint — mass, shadow, and horizon reduced to their essential terms.
          </h2>
        </Reveal>

        <Reveal delay={160}>
          <p className="text-lede text-mist">
            The residence is conceived as a single continuous volume set against the ridge. Stone
            podium, cast concrete frame, and full-height glazing are the only materials in play.
            Nothing is decorative; every element is structural, and the landscape is invited to do
            the rest.
          </p>
        </Reveal>
      </Container>
    </section>
  );
}
