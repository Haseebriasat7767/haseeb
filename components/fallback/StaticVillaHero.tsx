import { VILLA_CONFIG, createVillaLayout } from '@/components/three/villa/VillaGeometry';
import type { BoxSpec } from '@/components/three/villa/VillaTypes';
import { cn } from '@/lib/utils/cn';

/**
 * The residence for a visitor with no WebGL — drawn, not rendered.
 *
 * ## Why this exists
 *
 * Without WebGL the viewport showed a grid pattern, a paragraph and two
 * buttons. Everything it said was true and none of it was the building.
 * A buyer on a locked-down corporate laptop or an older phone left with
 * no idea what the residence looks like, which on a page whose subject is
 * the architecture is the whole proposition lost.
 *
 * ## It is the same building, not an illustration of one
 *
 * Every rectangle below is projected from `createVillaLayout` — the same
 * pure function the 3D scene is built from. Move a wall in the config and
 * this elevation moves with it. Nothing here is drawn by hand, so it
 * cannot drift into showing a building the model does not contain.
 *
 * `VillaGeometry` holds no three.js runtime import (only types), and is
 * already in the client bundle because `FloorPlan` reads the same layout
 * pipeline — so this costs a fallback nothing it was not already paying.
 *
 * ## Why an elevation rather than a plan
 *
 * The one sentence this image has to carry is the one the site leads with:
 * two stone wings with the light between them. A plan shows rooms; the
 * front elevation shows the gap.
 */

/** The front elevation, in metres, as flat rectangles ordered back to front. */
type Face = { x: number; y: number; width: number; height: number; depth: number; key: string };

function facesFrom(boxes: readonly BoxSpec[]): Face[] {
  return boxes.map((box) => {
    const [px, py, pz] = box.position;
    const [sx, sy, sz] = box.scale;
    return {
      key: box.key,
      x: px - sx / 2,
      y: py - sy / 2,
      width: sx,
      height: sy,
      // World +Z runs toward the front elevation, so a larger z is nearer
      // the viewer and paints later. Same convention the floor plans use.
      depth: pz + sz / 2,
    };
  });
}

/**
 * The massing, and deliberately only the massing.
 *
 * Fins, reveals, frames and mullions are thousands of slivers that read as
 * noise at this size and would bury the silhouette they sit on. The
 * volumes below are what makes the building legible in one glance.
 */
function elevationFaces(): Face[] {
  // `low` rather than `high`: the detail tiers differ in fixtures and
  // trim, not in massing, and the cheap one is plenty for a silhouette.
  const layout = createVillaLayout(VILLA_CONFIG, 'low');

  return [
    ...facesFrom(layout.foundation.plinth),
    ...facesFrom(layout.terrace.deck),
    ...facesFrom(layout.groundFloor.mass),
    ...facesFrom(layout.upperFloor.mass),
    ...facesFrom(layout.upperFloor.cantilever),
    ...facesFrom(layout.roof.slabs),
    ...facesFrom(layout.roof.parapets),
  ].sort((a, b) => a.depth - b.depth);
}

export function StaticVillaHero({ className }: { className?: string }) {
  const faces = elevationFaces();

  // The drawing's own extent, measured rather than assumed, so a change to
  // the villa's width or height reframes the picture instead of cropping it.
  const minX = Math.min(...faces.map((f) => f.x));
  const maxX = Math.max(...faces.map((f) => f.x + f.width));
  const maxY = Math.max(...faces.map((f) => f.y + f.height));
  const pad = 6;
  const groundY = 0;
  const viewWidth = maxX - minX + pad * 2;
  const viewHeight = maxY - groundY + pad * 2;

  // SVG y grows downward and the building's does not, so every face is
  // flipped about the ground line as it is drawn.
  const flip = (y: number, height: number) => maxY + pad - y - height;

  // Depth drives tone: the rear bar sits back and reads darker, the wings
  // come forward and catch the light. It is the cheapest possible stand-in
  // for the aerial perspective the real render gets for free.
  const depths = faces.map((f) => f.depth);
  const nearest = Math.max(...depths);
  const farthest = Math.min(...depths);
  const toneFor = (depth: number) => {
    const t = nearest === farthest ? 1 : (depth - farthest) / (nearest - farthest);
    return 0.18 + t * 0.34;
  };

  return (
    <div className={cn('bg-ink absolute inset-0 overflow-hidden', className)}>
      <svg
        viewBox={`${minX - pad} 0 ${viewWidth} ${viewHeight}`}
        preserveAspectRatio="xMidYMax meet"
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-labelledby="villa-hero-title villa-hero-desc"
      >
        <title id="villa-hero-title">The residence, drawn in elevation</title>
        <desc id="villa-hero-desc">
          A front elevation of the residence: two stone wings stepped onto the ridge with a
          full-height glazed volume in the gap between them, the upper floor cantilevered over the
          terrace, and the ridge line at eighty-six metres above sea level.
        </desc>

        <defs>
          <linearGradient id="villa-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-obsidian)" />
            <stop offset="72%" stopColor="var(--color-ink)" />
          </linearGradient>
          {/* The light in the gap. Warm, low and wide — the golden hour the
              rest of the site opens on, standing in for a render of it. */}
          <radialGradient id="villa-gap" cx="50%" cy="76%" r="42%">
            <stop offset="0%" stopColor="var(--color-gold)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="var(--color-gold)" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect x={minX - pad} y={0} width={viewWidth} height={viewHeight} fill="url(#villa-sky)" />
        <rect x={minX - pad} y={0} width={viewWidth} height={viewHeight} fill="url(#villa-gap)" />

        {faces.map((face) => (
          <rect
            key={face.key}
            x={face.x}
            y={flip(face.y, face.height)}
            width={face.width}
            height={face.height}
            fill="var(--color-alabaster)"
            fillOpacity={toneFor(face.depth)}
            stroke="var(--color-alabaster)"
            strokeOpacity={0.14}
            strokeWidth={0.05}
          />
        ))}

        {/* The ridge. A real figure — `SITE` publishes 86 m above sea level —
            drawn as the line the building sits on rather than a label. */}
        <line
          x1={minX - pad}
          y1={maxY + pad - groundY}
          x2={maxX + pad}
          y2={maxY + pad - groundY}
          stroke="var(--color-gold)"
          strokeOpacity={0.55}
          strokeWidth={0.08}
        />
      </svg>

      {/* Grain. A flat vector elevation reads as a diagram; a little noise
          over it reads as a plate. Pure CSS, no image request. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-overlay"
        style={{
          backgroundImage:
            'radial-gradient(rgba(250,250,250,.6) 0.5px, transparent 0.5px),' +
            'radial-gradient(rgba(250,250,250,.4) 0.5px, transparent 0.5px)',
          backgroundSize: '3px 3px, 5px 5px',
          backgroundPosition: '0 0, 2px 2px',
        }}
      />
    </div>
  );
}
