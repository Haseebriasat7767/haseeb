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
            eyebrow="Your property could be next"
            title={<span id="cta-heading">Your property could be next.</span>}
            lede="AURELIA demonstrates how an unbuilt property can become an interactive digital
              sales experience — from architecture and interiors to floor plans, walkthroughs and
              private enquiries."
          />
        </Reveal>

        <Reveal delay={120} className="flex flex-wrap justify-center gap-3">
          <Button href="/contact" magnetic>
            Create this for my property
          </Button>
          <Button href="/for-agencies" variant="outline" magnetic>
            For agencies &amp; developers
          </Button>
        </Reveal>
      </Container>
    </section>
  );
}
