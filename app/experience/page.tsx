import type { Metadata } from 'next';
import { ExperienceViewport } from '@/components/experience/ExperienceViewport';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';
import { CAMERA_VIEWS } from '@/lib/three/scene-config';

export const metadata: Metadata = {
  title: 'Explore',
  description:
    'Move through the residence in real time. Orbit the massing model and study the composition from every approach.',
};

export default function ExperiencePage() {
  return (
    <>
      <PageHeader
        eyebrow="Explore"
        title="The residence in real time"
        lede="Drag to orbit. The scene is generated entirely in code — no downloaded models, no photography."
      />

      <Container className="pb-section">
        <ExperienceViewport
          className="border-alabaster/10 aspect-[3/4] w-full border sm:aspect-[16/10] lg:aspect-[16/9]"
          mode="orbit"
          label="Interactive massing model of the residence"
        />

        <ul className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
          {CAMERA_VIEWS.map((view) => (
            <li key={view.id} className="text-eyebrow text-stone uppercase">
              {view.label}
            </li>
          ))}
        </ul>
      </Container>
    </>
  );
}
