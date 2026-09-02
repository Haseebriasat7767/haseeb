import { JourneyStage } from '@/components/journey/JourneyStage';
import { ArchitecturalStatement } from '@/components/property/ArchitecturalStatement';
import { CallToAction } from '@/components/property/CallToAction';
import { PropertyIntro } from '@/components/property/PropertyIntro';
import { PropertySpecs } from '@/components/property/PropertySpecs';

export default function HomePage() {
  return (
    <>
      <JourneyStage />
      <ArchitecturalStatement />
      <PropertyIntro />
      <PropertySpecs />
      <CallToAction />
    </>
  );
}
