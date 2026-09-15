import { Reveal } from '@/components/effects/Reveal';
import { Button } from '@/components/ui/Button';
import { CLIENT } from '@/lib/constants/client';

/**
 * The closing conversion moment, meant for the point a visitor has actually
 * finished looking — the end of the gallery, not the top of the homepage.
 * Reuses the same commercial framing `CallToAction` gives the homepage
 * rather than inventing a second voice for the same pitch.
 */
export function FinalExperienceCTA() {
  return (
    <Reveal className="border-alabaster/10 mt-4 flex flex-col items-center gap-6 border-t pt-16 pb-4 text-center">
      <div className="flex flex-col gap-3">
        <p className="text-eyebrow text-stone uppercase">You&rsquo;ve seen AURELIA</p>
        <p className="font-display text-alabaster text-display-md font-semibold">
          Now imagine your property this way.
        </p>
        <p className="text-mist mx-auto max-w-[52ch] text-sm leading-relaxed">
          The property shown here is conceptual. The technology and the experience are real — and
          can be adapted to a real development.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <Button href="/contact" magnetic>
          Create this for my property
        </Button>
        {CLIENT.brochurePath ? (
          <Button href={CLIENT.brochurePath} variant="outline" magnetic download>
            Download brochure
          </Button>
        ) : null}
      </div>
    </Reveal>
  );
}

export default FinalExperienceCTA;
