import type { Metadata } from 'next';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';
import { PROPERTY } from '@/lib/constants/site';

export const metadata: Metadata = {
  title: 'Architecture',
  description: 'Plans, levels, and the structural logic behind the residence at Coastal Ridge.',
};

const LEVELS = [
  { name: 'Lower level', detail: 'Wellness, cellar, and service' },
  { name: 'Ground level', detail: 'Living, dining, and the terrace edge' },
  { name: 'Upper level', detail: 'Principal suite and studio' },
] as const;

export default function FloorPlanPage() {
  return (
    <>
      <PageHeader
        eyebrow="Architecture"
        title="Plans and levels"
        lede={`Three levels stepped into the ridge. Drawn plans arrive alongside the
          procedural model in the next phase.`}
      />

      <Container className="pb-section">
        <dl className="border-alabaster/10 bg-alabaster/10 grid gap-px border md:grid-cols-3">
          {LEVELS.map((level) => (
            <div key={level.name} className="bg-obsidian flex flex-col gap-3 p-8">
              <dt className="text-eyebrow text-stone uppercase">{level.name}</dt>
              <dd className="font-display text-alabaster text-2xl font-light">{level.detail}</dd>
            </div>
          ))}
        </dl>

        <p className="text-stone mt-10 max-w-[52ch] text-sm leading-relaxed">
          {PROPERTY.name} — {PROPERTY.architect}, {PROPERTY.year}. Placeholder content for the Phase
          1 foundation.
        </p>
      </Container>
    </>
  );
}
