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
  Quaternion,
  RGBADepthPacking,
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
const FROND_SEGMENTS = 5;
/** Matches the foliage cards: the same kind of asset, the same failure. */
const FROND_ALPHA_CUTOFF = 0.38;

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
  const positions = new Float32Array(rings * 2 * 3);
  const normals = new Float32Array(rings * 2 * 3);
  const uvs = new Float32Array(rings * 2 * 2);
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
    const halfW = (width / 2) * (1 - t * 0.18);
    for (let side = 0; side < 2; side += 1) {
      const index = s * 2 + side;
      const z = side === 0 ? -halfW : halfW;
      positions.set([x, y, z], index * 3);
      // The ribbon is close enough to horizontal that an up normal is right
      // and much cheaper than a real frame; a leaf lit from underneath by
      // its own geometry looks worse than one lit from above.
      normals.set([0, 1, 0], index * 3);
      uvs.set([t, v0 + (side === 0 ? 0 : cell)], index * 2);
    }
    if (s > 0) {
      const a = (s - 1) * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
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

  // The lean, as a rotation applied about the base rather than the centre.
  const tilt = new Quaternion().setFromEuler(
    new Euler(Math.sin(leanAngle) * lean, 0, Math.cos(leanAngle) * lean),
  );

  const trunk = new CylinderGeometry(trunkRadius * 0.62, trunkRadius, trunkHeight, sides, 1);
  trunk.translate(0, trunkHeight / 2, 0);
  trunk.applyMatrix4(new Matrix4().makeRotationFromQuaternion(tilt));
  trunk.translate(ox, oy, oz);

  // Where the crown actually sits once the trunk has leaned over.
  const head = new Vector3(0, trunkHeight, 0).applyQuaternion(tilt).add(new Vector3(ox, oy, oz));

  const fronds: BufferGeometry[] = [];
  for (let i = 0; i < frondsPerTree; i += 1) {
    const r = rand(seed + i * 53);
    const r2 = rand(seed + i * 97);
    // Radial spread with jitter, so no two trees fan the same way.
    const yaw = (i / frondsPerTree) * Math.PI * 2 + (r - 0.5) * 0.5;
    // From a little above horizontal down to a heavy droop.
    const pitch = -0.42 + r2 * 1.25;
    const length = frondLength * (0.66 + r * 0.44);

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

  return { trunk, fronds };
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
        material={materials.bark}
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
