import { ExperiencePreview } from '@/components/experience/ExperiencePreview';
import { ArchitecturalStatement } from '@/components/property/ArchitecturalStatement';
import { CallToAction } from '@/components/property/CallToAction';
import { Hero } from '@/components/property/Hero';
import { PropertyIntro } from '@/components/property/PropertyIntro';

export default function HomePage() {
  return (
    <>
      <Hero />
      <ArchitecturalStatement />
      <PropertyIntro />
      <ExperiencePreview />
      <CallToAction />
    </>
  );
}
