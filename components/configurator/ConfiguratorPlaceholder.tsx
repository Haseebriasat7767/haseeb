import { Container } from '@/components/ui/Container';

const TRACKS = [
  { label: 'Material palette', detail: 'Stone, concrete, and bronze variants' },
  { label: 'Glazing', detail: 'Frame density and reveal depth' },
  { label: 'Light', detail: 'Time of day and seasonal sun path' },
] as const;

/**
 * Phase 2 placeholder. The panel establishes the layout and vocabulary of
 * the configurator without implementing any state or geometry bindings.
 */
export function ConfiguratorPlaceholder() {
  return (
    <Container className="pb-section">
      <ul className="border-alabaster/10 bg-alabaster/10 grid gap-px border md:grid-cols-3">
        {TRACKS.map((track) => (
          <li key={track.label} className="bg-obsidian flex flex-col gap-3 p-8">
            <span className="text-eyebrow text-stone uppercase">{track.label}</span>
            <span className="font-display text-alabaster text-2xl font-light">{track.detail}</span>
            <span className="text-gold-dim mt-auto pt-6 text-[0.625rem] tracking-[0.28em] uppercase">
              Phase 2
            </span>
          </li>
        ))}
      </ul>
    </Container>
  );
}
