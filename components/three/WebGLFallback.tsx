import { Eyebrow } from '@/components/ui/Eyebrow';
import { Button } from '@/components/ui/Button';

type WebGLFallbackProps = {
  /** Distinguishes "no WebGL at all" from "the scene failed to start". */
  reason?: 'unsupported' | 'error';
};

const COPY = {
  unsupported: {
    eyebrow: 'Static Presentation',
    title: 'Real-time rendering is unavailable on this device.',
    body: 'Your browser does not expose WebGL, so the interactive residence cannot be rendered. Everything else on this page — floor plans, gallery, specifications, and the enquiry form — remains fully available.',
  },
  error: {
    eyebrow: 'Static Presentation',
    title: 'The interactive residence could not be started.',
    body: 'Rendering was interrupted on this device. You can continue exploring the residence through the floor plans, gallery, and written material. Try reloading, or view on a device with WebGL support.',
  },
} as const;

/**
 * Elegant, on-brand substitute for the 3D canvas — an intentional
 * architectural plate rather than an error box.
 *
 * Includes alternative navigation so a visitor without WebGL is not stranded
 * on a page whose main content is the 3D view.
 */
export function WebGLFallback({ reason = 'unsupported' }: WebGLFallbackProps) {
  const copy = COPY[reason];

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-ink absolute inset-0 flex items-center justify-center overflow-hidden"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(244,241,236,.25) 1px, transparent 1px),' +
            'linear-gradient(to bottom, rgba(244,241,236,.25) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />
      <div className="px-gutter relative flex max-w-md flex-col items-center gap-6 text-center">
        <Eyebrow>{copy.eyebrow}</Eyebrow>
        <p className="font-display text-alabaster text-2xl leading-tight sm:text-3xl">
          {copy.title}
        </p>
        <p className="text-mist text-sm leading-relaxed">{copy.body}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <Button href="/floor-plan" variant="outline">
            View floor plan
          </Button>
          <Button href="/gallery" variant="outline">
            View gallery
          </Button>
        </div>
      </div>
    </div>
  );
}
