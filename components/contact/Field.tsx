'use client';

import { useId, type ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils/cn';

type FieldProps = {
  label: string;
  error?: string;
  optional?: boolean;
  multiline?: boolean;
} & Omit<ComponentPropsWithoutRef<'input'>, 'id' | 'className'>;

/**
 * A single form field. The label sits inside the field's own rule and
 * lifts to a caption on focus, so the form reads as a set of ruled lines
 * rather than a stack of boxes.
 */
export function Field({ label, error, optional, multiline, ...props }: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;

  const shared = cn(
    'peer w-full bg-transparent pt-6 pb-2 font-sans text-alabaster',
    'placeholder-transparent outline-none transition-colors duration-300',
    'border-b',
    error ? 'border-red-400/70' : 'border-alabaster/20 focus:border-gold',
  );

  return (
    <div className="relative flex flex-col">
      {multiline ? (
        <textarea
          id={id}
          rows={4}
          placeholder={label}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(shared, 'resize-none')}
          {...(props as ComponentPropsWithoutRef<'textarea'>)}
        />
      ) : (
        <input
          id={id}
          placeholder={label}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={shared}
          {...props}
        />
      )}

      <label
        htmlFor={id}
        className={cn(
          'text-eyebrow ease-luxe pointer-events-none absolute top-0 left-0 uppercase',
          'transition-colors duration-300',
          'peer-placeholder-shown:text-stone peer-focus:text-gold text-stone',
        )}
      >
        {label}
        {optional ? <span className="text-stone/60 normal-case"> (optional)</span> : null}
      </label>

      {error ? (
        <p id={errorId} role="alert" className="mt-2 text-xs text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
