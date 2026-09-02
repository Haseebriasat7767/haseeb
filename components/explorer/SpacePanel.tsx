'use client';

import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import type { Space } from '@/lib/experience/spaces';
import { cn } from '@/lib/utils/cn';

type SpacePanelProps = {
  space: Space | null;
  onClose: () => void;
  onFocusSpace: (space: Space) => void;
};

/**
 * Contextual information for the selected space. Deliberately a panel and
 * not a modal: the residence stays visible and interactive behind it, which
 * is the point of selecting a space at all. Escape still closes it, and the
 * heading takes focus on open so the change is announced.
 */
export function SpacePanel({ space, onClose, onFocusSpace }: SpacePanelProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const open = space !== null;

  useEffect(() => {
    if (!open) return;

    headingRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, space?.id]);

  return (
    <aside
      aria-label="Selected space"
      aria-live="polite"
      className={cn(
        'ease-luxe pointer-events-none absolute right-0 bottom-0 left-0 z-20 transition-all duration-700',
        'lg:top-0 lg:left-auto lg:flex lg:w-[26rem] lg:items-end',
        open ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0 lg:translate-x-6',
      )}
    >
      {space ? (
        <div className="border-alabaster/10 bg-obsidian/85 pointer-events-auto m-4 flex flex-col gap-5 border p-6 backdrop-blur-md sm:m-6 sm:p-8 lg:m-8 lg:mb-10">
          <div className="flex items-start justify-between gap-4">
            <p className="text-eyebrow text-stone uppercase">{space.eyebrow}</p>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close space details"
              data-cursor="link"
              className="text-stone hover:text-alabaster -mt-1.5 -mr-1.5 inline-flex h-8 w-8 shrink-0 items-center justify-center transition-colors"
            >
              <X size={16} strokeWidth={1.25} aria-hidden="true" />
            </button>
          </div>

          <h2
            ref={headingRef}
            tabIndex={-1}
            className="font-display text-alabaster text-3xl leading-none font-light outline-none sm:text-4xl"
          >
            {space.name}
          </h2>

          <p className="text-mist text-sm leading-relaxed">{space.description}</p>

          <div className="border-alabaster/10 flex flex-col gap-2 border-t pt-5">
            <p className="text-eyebrow text-stone uppercase">Key feature</p>
            <p className="text-bone text-sm leading-relaxed">{space.feature}</p>
          </div>

          <Button variant="outline" size="sm" onClick={() => onFocusSpace(space)}>
            Frame this space
          </Button>
        </div>
      ) : null}
    </aside>
  );
}
