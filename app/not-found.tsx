import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { SectionHeading } from '@/components/ui/SectionHeading';

export default function NotFound() {
  return (
    <Container className="flex min-h-[70svh] flex-col justify-center gap-10 py-40">
      <SectionHeading
        as="h1"
        eyebrow="404"
        title="This page is not part of the residence"
        lede="The address you followed does not exist. Return to the entrance to continue."
      />
      <div>
        <Button href="/">Return home</Button>
      </div>
    </Container>
  );
}
