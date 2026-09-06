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
            eyebrow="Private Viewing"
            title={<span id="cta-heading">Own the extraordinary.</span>}
            lede="Viewings are held by appointment. Share your details and a member of the
              team will respond with the full architectural dossier."
          />
        </Reveal>

        <Reveal delay={120} className="flex flex-wrap justify-center gap-3">
          <Button href="/contact" magnetic>
            Request private viewing
          </Button>
          <Button href="/floor-plan" variant="outline" magnetic>
            Contact residence
          </Button>
        </Reveal>
      </Container>
    </section>
  );
}
