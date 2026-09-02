'use client';

import { useProgress } from '@react-three/drei';
import { SITE } from '@/lib/constants/site';
import { cn } from '@/lib/utils/cn';

/** Segments in the progress scale. */
const SEGMENTS = 16;

type LoadingScreenProps = {
  /** Hide once the scene reports ready — never on a timer. */
  visible: boolean;
  className?: string;
};

/**
 * Premium loading state. Progress is read from three's loading manager via
 * drei's `useProgress`, so it already reflects real asset loading the
 * moment Phase 2 introduces textures or models. With nothing to load it
 * simply reads 0% and dismisses as soon as the scene mounts.
 */
export function LoadingScreen({ visible, className }: LoadingScreenProps) {
  const { progress, item } = useProgress();
  const percent = Math.min(100, Math.round(progress));

  return (
    <div
      role="status"
      aria-live="polite"
      aria-hidden={!visible}
      hidden={!visible}
      className={cn(
        'bg-obsidian absolute inset-0 z-20 flex flex-col items-center justify-center gap-8',
        'ease-luxe transition-opacity duration-700',
        visible ? 'opacity-100' : 'pointer-events-none opacity-0',
        className,
      )}
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="font-display text-alabaster text-3xl tracking-[0.5em] sm:text-4xl">
          {SITE.name}
        </span>
        <span className="text-eyebrow text-stone uppercase">Loading residence</span>
      </div>

      <div className="flex w-48 flex-col gap-3">
        {/* A run of segments rather than a bar: it reads as a measured
            architectural scale, and it is legible at a glance. */}
        <div className="flex gap-1" aria-hidden="true">
          {Array.from({ length: SEGMENTS }, (_, index) => (
            <span
              key={index}
              className={cn(
                'ease-luxe h-1 flex-1 transition-colors duration-500',
                index < Math.round((percent / 100) * SEGMENTS) ? 'bg-gold' : 'bg-alabaster/15',
              )}
            />
          ))}
        </div>
        <span className="text-stone text-center text-[0.625rem] tracking-[0.28em] uppercase tabular-nums">
          {percent}%
        </span>
      </div>

      <span className="sr-only">{item ? `Loading ${item}` : 'Preparing the experience'}</span>
    </div>
  );
}
