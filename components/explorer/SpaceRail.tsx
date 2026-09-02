'use client';

import { SPACES, type Space } from '@/lib/experience/spaces';
import { cn } from '@/lib/utils/cn';

const GROUPS = [
  { level: 'site', label: 'Site' },
  { level: 'ground', label: 'Ground level' },
  { level: 'upper', label: 'Upper level' },
] as const;

type SpaceRailProps = {
  activeId: string | null;
  onSelect: (space: Space) => void;
  className?: string;
};

/**
 * The index of spaces, set as an architectural schedule. Selecting an entry
 * moves the camera rather than navigating, so the scene never reloads.
 */
export function SpaceRail({ activeId, onSelect, className }: SpaceRailProps) {
  return (
    <nav aria-label="Spaces" className={cn('flex flex-col gap-8', className)}>
      {GROUPS.map((group) => {
        const spaces = SPACES.filter((space) => space.level === group.level);
        if (spaces.length === 0) return null;

        return (
          <div key={group.level} className="flex flex-col gap-3">
            <h3 className="text-eyebrow text-stone uppercase">{group.label}</h3>
            <ul className="flex flex-col">
              {spaces.map((space) => {
                const active = space.id === activeId;

                return (
                  <li key={space.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(space)}
                      aria-current={active ? 'true' : undefined}
                      data-cursor="link"
                      className={cn(
                        'group ease-luxe flex w-full items-center gap-3 py-1.5 text-left',
                        'font-sans text-sm transition-colors duration-300',
                        active ? 'text-alabaster' : 'text-mist hover:text-alabaster',
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          'ease-luxe h-px shrink-0 transition-all duration-500',
                          active
                            ? 'bg-gold w-7'
                            : 'bg-alabaster/30 group-hover:bg-gold w-3 group-hover:w-7',
                        )}
                      />
                      {space.name}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
