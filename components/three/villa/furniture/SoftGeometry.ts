import {
  BufferAttribute,
  BufferGeometry,
  IcosahedronGeometry,
  LatheGeometry,
  Vector2,
  Vector3,
} from 'three';

/**
 * Geometry for things that are not buildings.
 *
 * ## Why this module exists
 *
 * Everything in Aurelia outside the landscape was built from one rectangular
 * prism with a chamfer on its edges. For architecture that is not an
 * approximation — a wall, a slab and a parapet really are prisms, and the
 * chamfer really is the arris a mason cuts. For furniture it is a
 * misdescription so complete that no amount of tuning rescues it: a seat
 * cushion is a soft body that sags under its own weight and bulges at its
 * seams, a sofa arm is a swept round, a table lamp is a turned profile, a
 * pillow has no straight edges anywhere on it. Rendered as boxes with the
 * corners knocked off, every one of them reads as a placeholder, and a room
 * full of placeholders reads as a 3D scene rather than as a photograph —
 * which is exactly what the frames showed.
 *
 * So furniture gets its own primitives. Three of them cover almost
 * everything a furnished house contains.
 */

/**
 * A rounded box, generated as the offset surface of a smaller box.
 *
 * ## The construction
 *
 * Take any unit vector `n`. Clamp `n` scaled arbitrarily large into the box
 * `[-inner, +inner]` — which lands on the nearest point of that inner box in
 * the direction `n` — and step `radius` along `n` from there. Sweeping `n`
 * over a sphere traces the exact surface lying `radius` away from the inner
 * box at every point: flat across the faces, a true cylindrical quarter
 * round along the edges, a spherical octant at each corner.
 *
 * Two properties make this the right primitive rather than a subdivided
 * chamfer. The radius is genuinely round at any size, so a five-centimetre
 * cushion break and a two-millimetre joinery arris come from the same
 * function. And `n` *is* the surface normal at the point it generates, so
 * the geometry ships with exact smooth normals and needs no averaging pass
 * — which is what keeps a soft form from developing the faceted highlight
 * that gives cheap rounded geometry away.
 *
 * The direction set is an icosphere, so samples are near-uniform over the
 * sphere and the tessellation does not bunch at poles the way a lat-long
 * sphere would.
 */
export type SoftBoxOptions = {
  /** Corner radius in metres. Clamped to half the smallest dimension. */
  radius: number;
  /**
   * Icosphere subdivisions for the direction set. 1 is 80 triangles and
   * enough for something seen across a room; 3 is 1280 and reserved for
   * what a hero camera gets close to.
   */
  detail?: number;
  /**
   * How much the form sags under its own weight, as a fraction of its
   * height. This is the single cue that separates a cushion from a block:
   * a seat cushion is thinner in the middle than at its piped edge, and a
   * pillow is thinner still. Zero leaves the form firm, which is right for
   * a table top or a carcass.
   */
  sag?: number;
  /**
   * Amplitude of the soft creasing over the surface, in metres. Fabric
   * never resolves to a perfect surface; a few millimetres of low-frequency
   * relief is the difference between upholstery and painted plastic.
   */
  crease?: number;
  /** Distinct integer per piece, so no two cushions crease identically. */
  seed?: number;
  /**
   * Fraction the top face is drawn in relative to the bottom, per
   * horizontal axis. Furniture is very often tapered — a lamp base, a
   * bolster, a seat that narrows toward the back.
   */
  taper?: number;
};

/** Deterministic hash in [0,1). No `Math.random` anywhere in this project. */
function hash3(x: number, y: number, z: number, seed: number): number {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed * 0.137) * 43758.5453;
  return s - Math.floor(s);
}

/** Smooth value noise over the surface, used for the creasing. */
function creaseField(x: number, y: number, z: number, seed: number): number {
  const at = (fx: number, fy: number, fz: number) => {
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const iz = Math.floor(fz);
    const tx = fx - ix;
    const ty = fy - iy;
    const tz = fz - iz;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const sz = tz * tz * (3 - 2 * tz);
    let total = 0;
    for (let dx = 0; dx <= 1; dx += 1) {
      for (let dy = 0; dy <= 1; dy += 1) {
        for (let dz = 0; dz <= 1; dz += 1) {
          const weight = (dx ? sx : 1 - sx) * (dy ? sy : 1 - sy) * (dz ? sz : 1 - sz);
          total += hash3(ix + dx, iy + dy, iz + dz, seed) * weight;
        }
      }
    }
    return total;
  };
  return at(x * 3.1, y * 3.1, z * 3.1) * 0.65 + at(x * 7.7, y * 7.7, z * 7.7) * 0.35 - 0.5;
}

export function createSoftBox(
  width: number,
  height: number,
  depth: number,
  options: SoftBoxOptions,
): BufferGeometry {
  const { radius, detail = 2, sag = 0, crease = 0, seed = 1, taper = 0 } = options;

  const half = [width / 2, height / 2, depth / 2] as const;
  const limit = Math.min(width, height, depth) / 2;
  const r = Math.max(0.001, Math.min(radius, limit * 0.98));

  const inner = [
    Math.max(0, half[0] - r),
    Math.max(0, half[1] - r),
    Math.max(0, half[2] - r),
  ] as const;

  const source = new IcosahedronGeometry(1, detail);
  const direction = source.getAttribute('position');
  const count = direction.count;

  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);

  const n = new Vector3();
  for (let i = 0; i < count; i += 1) {
    n.fromBufferAttribute(direction, i).normalize();

    // The nearest point of the inner box in this direction, then a step of
    // one radius along the direction itself.
    let x = Math.max(-inner[0], Math.min(inner[0], n.x * 1e4)) + n.x * r;
    let y = Math.max(-inner[1], Math.min(inner[1], n.y * 1e4)) + n.y * r;
    let z = Math.max(-inner[2], Math.min(inner[2], n.z * 1e4)) + n.z * r;

    // Taper, applied about the vertical: narrower at the top.
    if (taper !== 0) {
      const t = (y / half[1] + 1) / 2;
      const scale = 1 - taper * t;
      x *= scale;
      z *= scale;
    }

    // Sag. Deepest at the centre of the plan and vanishing at the edges, so
    // the form dips in the middle while its perimeter stays where the seam
    // holds it — which is what a filled cushion actually does.
    if (sag !== 0) {
      const rx = inner[0] > 0 ? x / half[0] : 0;
      const rz = inner[2] > 0 ? z / half[2] : 0;
      const dish = Math.max(0, 1 - (rx * rx + rz * rz));
      y -= dish * sag * height * (y > 0 ? 1 : 0.25);
    }

    if (crease !== 0) {
      const amount = creaseField(x, y, z, seed) * crease;
      x += n.x * amount;
      y += n.y * amount;
      z += n.z * amount;
    }

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    normals[i * 3] = n.x;
    normals[i * 3 + 1] = n.y;
    normals[i * 3 + 2] = n.z;

    // World-axis box projection in metres, matching `ChamferedBox`, so the
    // material library's metre-scale maps tile identically on furniture and
    // on building fabric.
    const ax = Math.abs(n.x);
    const ay = Math.abs(n.y);
    const az = Math.abs(n.z);
    if (ax >= ay && ax >= az) {
      uvs[i * 2] = z;
      uvs[i * 2 + 1] = y;
    } else if (ay >= az) {
      uvs[i * 2] = x;
      uvs[i * 2 + 1] = z;
    } else {
      uvs[i * 2] = x;
      uvs[i * 2 + 1] = y;
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
  const index = source.getIndex();
  if (index) geometry.setIndex(index.clone());
  source.dispose();

  // Sag and creasing move vertices off the offset surface, so the exact
  // normals above stop being exact. Recomputing costs one pass at build
  // time and is what keeps a sagged cushion from lighting like a firm one.
  if (sag !== 0 || crease !== 0) geometry.computeVertexNormals();

  return geometry;
}

/**
 * A turned form, from a profile revolved about the vertical.
 *
 * Lamps, vases, pots, planters, table pedestals, bowls and shades are all
 * lathe work in reality, and all of them were cylinders or boxes here. A
 * profile costs a handful of points to author and produces a silhouette
 * that no combination of prisms reaches — a lamp base that swells and
 * tucks, a shade whose taper is slightly concave, a pot with a rolled rim.
 *
 * Points run bottom to top as `[radius, height]` pairs in metres.
 */
export function createTurned(
  profile: readonly (readonly [number, number])[],
  segments = 24,
): BufferGeometry {
  const points = profile.map(([radius, y]) => new Vector2(Math.max(0.0005, radius), y));
  const geometry = new LatheGeometry(points, segments);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * A hanging fabric panel, as a surface that actually falls in folds.
 *
 * Curtains were drawn as flat slabs, which is the one thing a curtain never
 * is: cloth hung from a track gathers, and the light running down the
 * crests and dying in the troughs is the whole reason a window with
 * curtains reads as a room rather than as an opening. The surface here is
 * ruled — flat across the top where the heading is fixed, opening into
 * folds down its drop — with the fold depth varying along the run so no two
 * pleats are identical.
 *
 * `axis` is the horizontal direction the panel runs along; the folds
 * displace along the other horizontal axis.
 */
export function createFolds(options: {
  /** Length of the run, in metres. */
  width: number;
  /** Drop from heading to hem. */
  height: number;
  /** Peak fold depth at the hem. */
  depth: number;
  /** Number of pleats across the run. */
  pleats: number;
  /** Columns per pleat, and rows down the drop. */
  columns?: number;
  rows?: number;
  seed?: number;
}): BufferGeometry {
  const { width, height, depth, pleats, columns = 5, rows = 10, seed = 1 } = options;

  const cols = Math.max(8, Math.round(pleats * columns));
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let j = 0; j <= rows; j += 1) {
    const v = j / rows;
    // Folds open from nothing at the heading to their full depth at the
    // hem, which is how a gathered panel hangs.
    const open = Math.pow(v, 0.65);
    for (let i = 0; i <= cols; i += 1) {
      const u = i / cols;
      const x = (u - 0.5) * width;

      // Pleat depth varies along the run and drifts slowly down the drop,
      // so the folds neither march in lockstep nor stay perfectly vertical.
      const jitter = 0.72 + hash3(i, 0, 0, seed) * 0.56;
      const drift = (hash3(i, j, 1, seed) - 0.5) * 0.22;
      const phase = u * pleats * Math.PI * 2 + drift + v * 0.35;
      const z = Math.sin(phase) * depth * open * jitter;

      positions.push(x, (0.5 - v) * height, z);
      uvs.push(u * width, v * height);
    }
  }

  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      const a = j * (cols + 1) + i;
      const b = a + 1;
      const c = a + (cols + 1);
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
