import { Eyebrow } from '@/components/ui/Eyebrow';
import { Button } from '@/components/ui/Button';
import { StaticVillaHero } from '@/components/fallback/StaticVillaHero';

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
      className="bg-ink absolute inset-0 flex items-end justify-center overflow-hidden"
    >
      {/* The building, drawn from the same layout the 3D scene is built
          from. This replaced a grid pattern: a visitor without WebGL could
          read what the residence was and never see it, which on a page
          whose subject is the architecture is the proposition lost. */}
      <StaticVillaHero />

      {/* The copy sits over the lower half of the elevation, where the
          drawing is darkest, with its own ground so the type never lands
          on the lit gap between the wings. */}
      <div
        aria-hidden="true"
        className="from-obsidian via-obsidian/92 absolute inset-x-0 bottom-0 h-4/5 bg-gradient-to-t to-transparent"
      />
      <div className="px-gutter relative flex max-w-lg flex-col items-center gap-5 pb-10 text-center sm:pb-14">
        <Eyebrow>{copy.eyebrow}</Eyebrow>
        <p className="font-display text-alabaster text-2xl leading-tight sm:text-3xl">
          {copy.title}
        </p>
        <p className="text-mist text-sm leading-relaxed">{copy.body}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <Button href="/residence?tab=plan" variant="outline">
            View floor plan
          </Button>
          <Button href="/residence?tab=gallery" variant="outline">
            View gallery
          </Button>
        </div>
      </div>
    </div>
  );
}
