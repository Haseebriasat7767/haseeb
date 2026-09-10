import { Reveal } from '@/components/effects/Reveal';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { SectionHeading } from '@/components/ui/SectionHeading';

export function CallToAction() {
  return (
    <section className="py-section-lg" aria-labelledby="cta-heading">
      <Container className="flex flex-col items-center gap-12 text-center">
        <Reveal>
          <SectionHeading
            align="center"
            eyebrow="Commission a build"
            title={<span id="cta-heading">Bring your property to life.</span>}
            lede="Everything here was built from geometry, not photography — which means it can be
              built for a development that does not exist yet. Tell us about the project."
          />
        </Reveal>

        <Reveal delay={120} className="flex flex-wrap justify-center gap-3">
          <Button href="/contact" magnetic>
            Discuss your project
          </Button>
          <Button href="/tower" variant="outline" magnetic>
            See the tower
          </Button>
        </Reveal>
      </Container>
    </section>
  );
}
