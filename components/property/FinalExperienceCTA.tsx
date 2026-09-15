import { Reveal } from '@/components/effects/Reveal';
import { BuildForYourProperty } from './BuildForYourProperty';
import { BrochureButton } from './BrochureButton';

/**
 * The closing conversion moment, meant for the point a visitor has actually
 * finished looking — the end of the gallery, not the top of the homepage.
 *
 * The pitch itself now comes from `BuildForYourProperty`, which the guided
 * tour's completion card and the agencies page also read, so the one claim
 * the product makes about itself is written once. What stays here is the
 * placement: the rule above it, the centring, and the brochure beside it.
 * "Create this for my property" used to point at `/contact` — the buyer's
 * viewing form — which put a developer's enquiry into the client's inbox
 * labelled as a request to view a residence that does not exist.
 */
export function FinalExperienceCTA() {
  return (
    <Reveal className="border-alabaster/10 mt-4 flex flex-col items-center gap-6 border-t pt-16 pb-4">
      <BuildForYourProperty source="gallery-final" compact />
      <BrochureButton />
    </Reveal>
  );
}

export default FinalExperienceCTA;
