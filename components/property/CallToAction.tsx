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

        {/* The primary goes to the commercial enquiry, not to `/contact`.
            This CTA is addressed to somebody with a property of their own —
            sending them to the buyer's viewing form made them start a
            conversation about a residence that does not exist. The viewing
            form is still one click away for the visitor who wants it. */}
        <Reveal delay={120} className="flex flex-wrap justify-center gap-3">
          <Button href="/for-agencies#create" magnetic>
            Create my property experience
          </Button>
          <Button href="/contact" variant="outline" magnetic>
            Request a private viewing
          </Button>
        </Reveal>
      </Container>
    </section>
  );
}
