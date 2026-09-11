'use client';

import { useId, type ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils/cn';

type FieldProps = {
  label: string;
  error?: string;
  optional?: boolean;
  multiline?: boolean;
  hint?: string;
} & Omit<ComponentPropsWithoutRef<'input'>, 'id' | 'className'>;

/**
 * A single form field. The label sits inside the field's own rule and
 * lifts to a caption on focus, so the form reads as a set of ruled lines
 * rather than a stack of boxes.
 *
 * Accessibility:
 * - aria-invalid + aria-describedby for errors
 * - hint text linked via aria-describedby
 * - required prop passed through
 */
export function Field({ label, error, optional, multiline, hint, required, ...props }: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;

  const shared = cn(
    'peer w-full bg-transparent pt-3 pb-3 sm:pt-6 sm:pb-2 font-sans text-alabaster',
    'placeholder-transparent outline-none transition-colors duration-300',
    'border-b min-h-11',
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
          aria-describedby={describedBy}
          aria-required={required ? true : undefined}
          required={required}
          className={cn(shared, 'resize-none')}
          {...(props as ComponentPropsWithoutRef<'textarea'>)}
        />
      ) : (
        <input
          id={id}
          placeholder={label}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-required={required ? true : undefined}
          required={required}
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
        {optional ? <span className="text-stone normal-case"> (optional)</span> : null}
        {required ? <span className="text-gold ml-1" aria-hidden="true">*</span> : null}
      </label>

      {hint && !error ? (
        <p id={hintId} className="text-stone mt-2 text-[0.6875rem]">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} role="alert" className="mt-2 text-xs text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
