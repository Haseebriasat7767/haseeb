'use client';

import { useEffect, useMemo } from 'react';
import {
  BufferAttribute,
  CylinderGeometry,
  DoubleSide,
  Euler,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix4,
  MeshDepthMaterial,
  MeshStandardMaterial,
  RGBADepthPacking,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
} from 'three';
import { BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getMaterials } from '@/lib/three/materials';
import type { DetailTier } from '../villa/VillaTypes';
import type { PalmSpec } from './TowerTypes';

/**
 * The frond sheet, and how a frond is drawn.
 *
 * ## What was wrong
 *
 * Each frond was one flat `BoxGeometry`. The comment here used to admit the
 * problem and pick the wrong fix: a frond at true width "reads as a dark
 * stick", so the blade was widened to stand in for the leaflets that were
 * not being drawn. A wide flat blade does not read as a leaf, it reads as a
 * plank — and a dozen planks radiating from a point read as a star. From the
 * arrival camera the beach was a field of them, and it was the single most
 * cartoon-like thing in the frame.
 *
 * A palm frond is a comb of a hundred leaflets with as much air as leaf.
 * That is a silhouette with holes in it, which is what an alpha cutout is
 * for — the same trick the broadleaf canopies already use, and the reason
 * they read where the palms did not. `tools/blender/palm.py` bakes two
 * fronds; each is drawn as a ribbon of quads that arches under its own
 * weight, so the leaf curves instead of sticking out straight.
 */
const PALM_SHEET = '/assets/foliage/palm.png';
/** Variants stacked in the sheet. */
const PALM_VARIANTS = 2;
/** Segments along one frond. Enough to arch; a frond is not a spline. */
const FROND_SEGMENTS = 6;
/**
 * Lower than the foliage cards use.
 *
 * A leaflet is a few texels wide and the mip chain greys it out with
 * distance; cut at 0.38 that grey becomes a dashed line, and a palm at forty
 * metres is a string of dots hanging off a stick. Cut lower, the mips are
 * allowed to blur the leaflets into a soft mass — which is what a palm crown
 * looks like at forty metres anyway.
 */
const FROND_ALPHA_CUTOFF = 0.28;
/**
 * How far the two halves of a frond lift from the rachis, as a fraction of
 * the half width.
 *
 * A coconut frond is a shallow V in section, not a sheet of paper. Flat, it
 * has one tone across its whole width whatever the light does, and from
 * underneath it disappears to nothing. Folded, the two halves catch the sun
 * differently and the frond has a spine — which is most of what makes a
 * crown read as a crown rather than as a pile of cutouts.
 */
const FROND_FOLD = 0.34;

let sheet: ReturnType<TextureLoader['load']> | null = null;

function getPalmSheet() {
  if (sheet) return sheet;
  sheet = new TextureLoader().load(PALM_SHEET);
  sheet.colorSpace = SRGBColorSpace;
  sheet.magFilter = LinearFilter;
  sheet.minFilter = LinearMipmapLinearFilter;
  sheet.anisotropy = 8;
  return sheet;
}

/** Trunk facets per tier. A palm at forty metres does not need twelve. */
const TRUNK_SIDES: Record<DetailTier, number> = { low: 5, medium: 7, high: 9 };

/** Deterministic hash, matching the one the layout uses. */
function rand(seed: number): number {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Builds one palm's trunk and one palm's fronds as separate geometry lists,
 * so the whole planting scheme merges into exactly two meshes.
 *
 * The trunk is a tapered cylinder given a slight lean; the fronds are thin
 * tapered blades radiating from its head, each one tilted down by a
 * different amount. Palms are the one tree whose silhouette is almost
 * entirely in the crown, so the frond angles are where the effort goes —
 * an even radial fan reads as a parasol, and what makes it read as a palm
 * is that some fronds stand up, some sit level, and the older ones hang
 * well below horizontal.
 */
/**
 * One frond: a ribbon of quads running out from the crown and arching down.
 *
 * The arch is the point. A straight blade at any angle reads as a spoke; a
 * frond that leaves the crown rising and falls away under its own weight is
 * the shape everybody recognises, and it costs five quads.
 */
function frondRibbon(length: number, width: number, sag: number, variant: number) {
  const rings = FROND_SEGMENTS + 1;
  // Three vertices a ring: the rachis, and a lifted edge either side of it.
  const cols = 3;
  const positions = new Float32Array(rings * cols * 3);
  const normals = new Float32Array(rings * cols * 3);
  const uvs = new Float32Array(rings * cols * 2);
  const indices: number[] = [];

  // The sheet stacks its variants top to bottom, and V runs up from the
  // bottom of a texture — so variant 0 is the TOP row and the highest V.
  const cell = 1 / PALM_VARIANTS;
  const v0 = 1 - cell * (variant + 1);

  for (let s = 0; s < rings; s += 1) {
    const t = s / FROND_SEGMENTS;
    const x = length * t;
    // Quadratic droop, and a little taper so the tip is not a blunt end.
    const y = -sag * t * t;
    const halfW = (width / 2) * (1 - t * 0.16);
    const lift = halfW * FROND_FOLD;
    for (let col = 0; col < cols; col += 1) {
      const index = s * cols + col;
      // -1, 0, +1 across the frond.
      const across = col - 1;
      positions.set([x, y + Math.abs(across) * lift, across * halfW], index * 3);
      // Each half tilts away from the spine, so the two catch the light
      // differently instead of shading as one plane.
      const nz = across === 0 ? 0 : Math.sign(across) * FROND_FOLD;
      const inv = 1 / Math.hypot(1, nz);
      normals.set([0, inv, nz * inv], index * 3);
      uvs.set([t, v0 + cell * ((across + 1) / 2)], index * 2);
    }
    if (s > 0) {
      const a = (s - 1) * cols;
      const b = s * cols;
      for (let col = 0; col < cols - 1; col += 1) {
        indices.push(a + col, a + col + 1, b + col + 1, a + col, b + col + 1, b + col);
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

function buildPalm(
  spec: PalmSpec,
  sides: number,
  frondsPerTree: number,
): {
  trunk: BufferGeometry;
  fronds: BufferGeometry[];
} {
  const { position, trunkHeight, trunkRadius, lean, leanAngle, frondLength, seed } = spec;
  const [ox, oy, oz] = position;

  // The lean, as a BEND rather than a tilt.
  //
  // It used to be a rigid rotation about the base, which makes a leaning pole
  // — and a grove of leaning poles all rotated by a similar amount reads as
  // scaffolding. A coconut palm curves: it leaves the ground close to
  // vertical and sweeps over, so the lean accumulates with height and the top
  // of the trunk is the only part that is really tipped. The displacement is
  // quadratic in height, which is what a stem loaded at its tip does.
  const bend = Math.sin(leanAngle);
  const bendX = Math.cos(leanAngle) * lean * trunkHeight * 1.35;
  const bendZ = bend * lean * trunkHeight * 1.35;
  /** Where the trunk's axis has got to, a fraction `t` up its height. */
  const sway = (t: number) => ({ x: bendX * t * t, z: bendZ * t * t });

  // Ring scars, and a real taper.
  //
  // A coconut trunk is not a cone: it swells at the base, thins quickly, and
  // carries a band at every frond that has ever fallen off it. Those bands
  // are the only thing that gives a trunk scale at distance — without them
  // it is a smooth pole and reads as one whatever colour it is painted.
  const rings = Math.max(6, Math.round(trunkHeight * 2.2));
  const trunk = new CylinderGeometry(trunkRadius * 0.72, trunkRadius, trunkHeight, sides, rings);
  const pos = trunk.getAttribute('position');
  for (let v = 0; v < pos.count; v += 1) {
    const y = pos.getY(v);
    const t = y / trunkHeight + 0.5;
    // A slight flare in the lowest fifth, then the scar banding.
    const flare = 1 + Math.max(0, 0.18 - t) * 1.5;
    const band = 1 + Math.sin(t * trunkHeight * 3.4) * 0.022;
    const offset = sway(t);
    pos.setX(v, pos.getX(v) * flare * band + offset.x);
    pos.setZ(v, pos.getZ(v) * flare * band + offset.z);
  }
  trunk.computeVertexNormals();
  trunk.translate(0, trunkHeight / 2, 0);
  trunk.translate(ox, oy, oz);

  // Where the crown sits once the trunk has swept over.
  const top = sway(1);
  const head = new Vector3(ox + top.x, oy + trunkHeight, oz + top.z);

  // A few nuts under the crown. Two dozen triangles, and the one detail that
  // says "coconut palm" rather than "palm" — a grove with none is a grove
  // nobody has looked at closely.
  const nuts: BufferGeometry[] = [trunk];
  const nutCount = 3 + Math.floor(rand(seed + 601) * 4);
  for (let n = 0; n < nutCount; n += 1) {
    const a = rand(seed + n * 71) * Math.PI * 2;
    const reach = trunkRadius * (1.5 + rand(seed + n * 89) * 1.1);
    const nut = new SphereGeometry(trunkRadius * (0.42 + rand(seed + n * 103) * 0.14), 7, 5);
    nut.translate(
      head.x + Math.cos(a) * reach,
      head.y - trunkRadius * (1.1 + rand(seed + n * 113) * 1.4),
      head.z + Math.sin(a) * reach,
    );
    nuts.push(nut);
  }
  const trunkWithNuts = mergeGeometries(nuts, false) ?? trunk;
  nuts.forEach((g) => {
    if (g !== trunk) g.dispose();
  });

  const fronds: BufferGeometry[] = [];
  for (let i = 0; i < frondsPerTree; i += 1) {
    const r = rand(seed + i * 53);
    const r2 = rand(seed + i * 97);
    // Radial spread with jitter, so no two trees fan the same way.
    const yaw = (i / frondsPerTree) * Math.PI * 2 + (r - 0.5) * 0.5;
    // A fountain, not a parasol.
    //
    // The old spread ran from 24 degrees above horizontal to 48 below, which
    // is a rosette — every frond in roughly the same plane, splayed. A palm
    // crown has a few fronds standing nearly upright in the middle, a mass
    // spreading out around them, and the oldest ones hanging well below the
    // horizontal. Cubing the parameter puts most fronds in the spread and a
    // few at each extreme, which is the distribution a real crown has.
    const shaped = (r2 - 0.5) * 2;
    const pitch = 0.28 + shaped * shaped * shaped * 0.92 + shaped * 0.34;
    const length = frondLength * (0.74 + r * 0.36);

    // The sheet's cell is 4:1, so the width follows the length rather than
    // being chosen: a frond drawn at the wrong aspect is a frond with its
    // leaflets stretched.
    const width = length / 4;
    // How far the tip falls below the line the frond leaves the crown on.
    const sag = length * (0.28 + r * 0.3);
    const variant = Math.floor(rand(seed + i * 131) * PALM_VARIANTS) % PALM_VARIANTS;

    const blade = frondRibbon(length, width, sag, variant);
    // Authored from the origin outward, so the rotation swings it about the
    // crown rather than about its own middle.
    blade.applyMatrix4(new Matrix4().makeRotationFromEuler(new Euler(0, yaw, -pitch, 'YZX')));
    blade.translate(head.x, head.y, head.z);
    fronds.push(blade);
  }

  return { trunk: trunkWithNuts, fronds };
}

/**
 * A stand of palms, drawn as two merged meshes regardless of how many trees
 * there are. Trunks take the villa's bark material; the fronds take a
 * lighter, more yellow-green leaf than the villa's broadleaf canopy.
 */
export function Palms({
  specs,
  detail = 'high',
  name = 'palms',
  castShadow = true,
}: {
  specs: readonly PalmSpec[];
  detail?: DetailTier;
  name?: string;
  castShadow?: boolean;
}) {
  const materials = getMaterials();
  const sides = TRUNK_SIDES[detail];

  // Alpha-cut, not blended, and both-sided — the same three decisions the
  // foliage cards make, for the same three reasons. Opaque-with-alphaTest
  // keeps the fronds in the depth prepass and out of the transparency sort;
  // a single-sided frond goes black the moment the sun is behind the tree.
  const frondMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        map: getPalmSheet(),
        side: DoubleSide,
        alphaTest: FROND_ALPHA_CUTOFF,
        transparent: false,
        roughness: 0.86,
        metalness: 0,
        envMapIntensity: 0.55,
      }),
    [],
  );

  // Shadows need the cutout too, or every frond casts its bounding quad and
  // the beach is striped with rectangles nothing in the scene explains.
  const frondDepth = useMemo(() => {
    const depth = new MeshDepthMaterial({
      depthPacking: RGBADepthPacking,
      map: getPalmSheet(),
      alphaTest: FROND_ALPHA_CUTOFF,
    });
    return depth;
  }, []);

  useEffect(
    () => () => {
      frondMaterial.dispose();
      frondDepth.dispose();
    },
    [frondMaterial, frondDepth],
  );
  // A palm's crown is its whole silhouette, so the frond count is the last
  // thing to cut — but on the low tier it is still the largest saving here.
  const frondScale = detail === 'low' ? 0.6 : detail === 'medium' ? 0.8 : 1;

  const geometry = useMemo(() => {
    if (specs.length === 0) return null;

    const trunks: BufferGeometry[] = [];
    const blades: BufferGeometry[] = [];

    for (const spec of specs) {
      const count = Math.max(5, Math.round(spec.frondCount * frondScale));
      const built = buildPalm(spec, sides, count);
      trunks.push(built.trunk);
      blades.push(...built.fronds);
    }

    const trunk = mergeGeometries(trunks, false);
    const frond = mergeGeometries(blades, false);
    trunks.forEach((g) => g.dispose());
    blades.forEach((g) => g.dispose());

    return { trunk, frond };
  }, [specs, sides, frondScale]);

  useEffect(
    () => () => {
      geometry?.trunk?.dispose();
      geometry?.frond?.dispose();
    },
    [geometry],
  );

  if (!geometry?.trunk || !geometry.frond) return null;

  return (
    <group name={name}>
      <mesh
        name={`${name}-trunks`}
        geometry={geometry.trunk}
        material={materials.palmTrunk}
        castShadow={castShadow}
        receiveShadow
      />
      <mesh
        name={`${name}-fronds`}
        geometry={geometry.frond}
        material={frondMaterial}
        customDepthMaterial={frondDepth}
        castShadow={castShadow}
        receiveShadow
      />
    </group>
  );
}

export default Palms;
