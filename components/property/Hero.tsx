import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { PROPERTY, SITE } from '@/lib/constants/site';

/**
 * Cinematic opening frame. Deliberately typographic: it must feel expensive
 * on a cold load, before any 3D chunk is fetched.
 */
export function Hero() {
  return (
    <section className="relative flex min-h-[100svh] flex-col justify-end overflow-hidden pt-32 pb-16 sm:pb-20">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: 'linear-gradient(to right, rgba(244,241,236,.6) 1px, transparent 1px)',
          backgroundSize: 'clamp(72px, 12vw, 160px) 100%',
        }}
      />

      <Container className="relative flex flex-col gap-12">
        <div className="flex flex-col gap-7">
          <p className="text-eyebrow text-stone uppercase">
            {PROPERTY.location} — {PROPERTY.year}
          </p>

          <h1 className="text-display-xl font-display text-alabaster font-light">
            <span className="block">A residence</span>
            <span className="text-bone block italic">composed of light</span>
          </h1>
        </div>

        <div className="border-alabaster/10 grid gap-10 border-t pt-8 md:grid-cols-12 md:items-end">
          <p className="text-lede text-mist max-w-[46ch] md:col-span-6 lg:col-span-5">
            {SITE.description}
          </p>

          <div className="flex flex-wrap gap-3 md:col-span-6 md:justify-end lg:col-span-7">
            <Button href="/experience">Enter the experience</Button>
            <Button href="/contact" variant="outline">
              Request the dossier
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
