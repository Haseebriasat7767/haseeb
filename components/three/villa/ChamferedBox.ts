import { BufferAttribute, BufferGeometry } from 'three';

/**
 * A rectangular volume whose twelve edges are cut back by a small flat
 * chamfer, and whose eight corners are closed by a triangle.
 *
 * This exists because nothing in the world has a zero-radius edge. Real
 * cast concrete, honed stone, a joinery carcass and a steel section all
 * terminate in a fillet or an arris a few millimetres across, and that
 * band is what catches a highlight and separates one face from the next.
 * A mathematically perfect corner reflects nothing at all along its
 * length, which is the single most reliable tell that a render was
 * assembled from primitives — and Aurelia was assembled entirely from two.
 *
 * The chamfer is *flat*, not round: one extra facet per edge, at 45°. That
 * is enough to produce the highlight and costs 44 triangles against the
 * plain box's 12, where a rounded edge would cost several times more and
 * start to read as soft-edged furniture rather than architecture.
 *
 * ## Why this is built at real size rather than scaled
 *
 * The rest of the villa shares one unit cube and applies each volume's
 * dimensions as a non-uniform scale. A chamfer cannot survive that: a
 * 4 mm cut on a unit cube stretched to 12 m × 0.3 m × 8 m becomes 48 mm
 * on one axis and 1.2 mm on another, so the edge that should be constant
 * around the volume instead varies by a factor of forty. Every geometry
 * here is therefore built at its true metre dimensions, with the chamfer
 * identical on all twelve edges, and the mesh carries no scale at all.
 * The cache below is what keeps that from costing an allocation per box.
 */

/** Corner of the box, in units of half-extent, for the eight octants. */
const OCTANTS: readonly [number, number, number][] = [
  [1, 1, 1],
  [1, 1, -1],
  [1, -1, 1],
  [1, -1, -1],
  [-1, 1, 1],
  [-1, 1, -1],
  [-1, -1, 1],
  [-1, -1, -1],
];

/**
 * How much of the smallest dimension the chamfer may consume. A mullion is
 * 30 mm deep, and an unclamped 4 mm cut from both sides of it would eat a
 * quarter of the section; this keeps thin members reading as members.
 */
const MAX_CHAMFER_FRACTION = 0.22;

/**
 * Below this, an element is too small for the chamfer to be resolvable at
 * any camera distance the residence is seen from, so it keeps the plain
 * box and the triangles are spent somewhere they show.
 */
const MIN_CHAMFERABLE_SIZE = 0.035;

type Vec3 = [number, number, number];

/**
 * Emits one triangle: three positions, a shared flat normal derived from
 * the winding, and box-projected UVs in metres.
 *
 * UVs are laid out per world axis at true scale — one unit of UV is one
 * metre of surface — so that when Phase 7G introduces material maps they
 * tile at architectural size on every face without a per-mesh unwrap.
 */
function pushTriangle(
  positions: number[],
  normals: number[],
  uvs: number[],
  first: Vec3,
  second: Vec3,
  third: Vec3,
): void {
  // Winding is derived, not authored. There are twelve edge chamfers and
  // eight corners here, each in a different octant, and hand-deriving the
  // vertex order for all twenty is exactly the kind of thing that ships one
  // inside-out facet nobody notices until it shows as a black wedge. The
  // outward direction of any facet on a box centred at the origin is simply
  // the direction of its own centroid, so the order is checked against that
  // and swapped when it disagrees.
  const cx = (first[0] + second[0] + third[0]) / 3;
  const cy = (first[1] + second[1] + third[1]) / 3;
  const cz = (first[2] + second[2] + third[2]) / 3;

  const a = first;
  let b = second;
  let c = third;
  {
    const px = b[0] - a[0];
    const py = b[1] - a[1];
    const pz = b[2] - a[2];
    const qx = c[0] - a[0];
    const qy = c[1] - a[1];
    const qz = c[2] - a[2];
    const facing = (py * qz - pz * qy) * cx + (pz * qx - px * qz) * cy + (px * qy - py * qx) * cz;
    if (facing < 0) {
      b = third;
      c = second;
    }
  }

  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];

  let nx = uy * vz - uz * vy;
  let ny = uz * vx - ux * vz;
  let nz = ux * vy - uy * vx;
  const length = Math.hypot(nx, ny, nz) || 1;
  nx /= length;
  ny /= length;
  nz /= length;

  // Project onto whichever pair of axes the face most faces away from, so
  // the mapping never collapses to zero area.
  const ax = Math.abs(nx);
  const ay = Math.abs(ny);
  const az = Math.abs(nz);
  const axis = ax >= ay && ax >= az ? 0 : ay >= az ? 1 : 2;

  for (const p of [a, b, c]) {
    positions.push(p[0], p[1], p[2]);
    normals.push(nx, ny, nz);
    if (axis === 0) uvs.push(p[2], p[1]);
    else if (axis === 1) uvs.push(p[0], p[2]);
    else uvs.push(p[0], p[1]);
  }
}

function pushQuad(
  positions: number[],
  normals: number[],
  uvs: number[],
  a: Vec3,
  b: Vec3,
  c: Vec3,
  d: Vec3,
): void {
  pushTriangle(positions, normals, uvs, a, b, c);
  pushTriangle(positions, normals, uvs, a, c, d);
}

/**
 * Builds the chamfered volume at true size, centred on the origin.
 *
 * Falls back to a plain six-sided box when the requested chamfer is zero
 * or the volume is too slender to carry one, so callers never have to
 * decide — the same function serves both cases and the topology stays
 * consistent for merging.
 */
export function createChamferedBox(
  width: number,
  height: number,
  depth: number,
  chamfer: number,
  /**
   * Facets across each edge. One is the flat 45-degree arris this file was
   * built for — right for architecture, where an edge is cut, not curved.
   * Three or more sweeps a quarter round instead, which is what upholstery,
   * cushions and soft goods need: a sofa arm has a radius, and no number of
   * flat chamfers on a rectangular prism will ever read as one.
   */
  segments = 1,
): BufferGeometry {
  const hx = width / 2;
  const hy = height / 2;
  const hz = depth / 2;

  const smallest = Math.min(width, height, depth);
  const c =
    chamfer <= 0 || smallest < MIN_CHAMFERABLE_SIZE
      ? 0
      : Math.min(chamfer, smallest * MAX_CHAMFER_FRACTION);

  const ix = hx - c;
  const iy = hy - c;
  const iz = hz - c;

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

  // ── Six main faces, inset by the chamfer on all four sides ─────────────
  // Wound so each face's normal points outward along its own axis.
  pushQuad(positions, normals, uvs, [hx, -iy, -iz], [hx, iy, -iz], [hx, iy, iz], [hx, -iy, iz]);
  pushQuad(positions, normals, uvs, [-hx, -iy, iz], [-hx, iy, iz], [-hx, iy, -iz], [-hx, -iy, -iz]);
  pushQuad(positions, normals, uvs, [-ix, hy, -iz], [-ix, hy, iz], [ix, hy, iz], [ix, hy, -iz]);
  pushQuad(positions, normals, uvs, [-ix, -hy, iz], [-ix, -hy, -iz], [ix, -hy, -iz], [ix, -hy, iz]);
  pushQuad(positions, normals, uvs, [-ix, -iy, hz], [ix, -iy, hz], [ix, iy, hz], [-ix, iy, hz]);
  pushQuad(positions, normals, uvs, [ix, -iy, -hz], [-ix, -iy, -hz], [-ix, iy, -hz], [ix, iy, -hz]);

  if (c > 0) {
    const steps = Math.max(1, Math.round(segments));

    // Offsets along a quarter circle, from one face's plane to the next.
    // At one step this yields the single 45-degree facet; above that it is
    // a real fillet.
    const arc: [number, number][] = [];
    for (let i = 0; i <= steps; i += 1) {
      const angle = (i / steps) * (Math.PI / 2);
      arc.push([Math.cos(angle), Math.sin(angle)]);
    }

    // ── Twelve edge fillets ─────────────────────────────────────────────
    // Each runs the length of one axis between two adjacent main faces,
    // swept through the arc above.
    for (const [sy, sz] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ] as const) {
      for (let i = 0; i < steps; i += 1) {
        const [a0, b0] = arc[i]!;
        const [a1, b1] = arc[i + 1]!;
        pushQuad(
          positions,
          normals,
          uvs,
          [-ix, sy * (iy + c * b0), sz * (iz + c * a0)],
          [ix, sy * (iy + c * b0), sz * (iz + c * a0)],
          [ix, sy * (iy + c * b1), sz * (iz + c * a1)],
          [-ix, sy * (iy + c * b1), sz * (iz + c * a1)],
        );
      }
    }

    for (const [sx, sz] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ] as const) {
      for (let i = 0; i < steps; i += 1) {
        const [a0, b0] = arc[i]!;
        const [a1, b1] = arc[i + 1]!;
        pushQuad(
          positions,
          normals,
          uvs,
          [sx * (ix + c * a0), -iy, sz * (iz + c * b0)],
          [sx * (ix + c * a0), iy, sz * (iz + c * b0)],
          [sx * (ix + c * a1), iy, sz * (iz + c * b1)],
          [sx * (ix + c * a1), -iy, sz * (iz + c * b1)],
        );
      }
    }

    for (const [sx, sy] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ] as const) {
      for (let i = 0; i < steps; i += 1) {
        const [a0, b0] = arc[i]!;
        const [a1, b1] = arc[i + 1]!;
        pushQuad(
          positions,
          normals,
          uvs,
          [sx * (ix + c * a0), sy * (iy + c * b0), -iz],
          [sx * (ix + c * a0), sy * (iy + c * b0), iz],
          [sx * (ix + c * a1), sy * (iy + c * b1), iz],
          [sx * (ix + c * a1), sy * (iy + c * b1), -iz],
        );
      }
    }

    // ── Eight corner patches ────────────────────────────────────────────
    // A spherical octant, tessellated as rings of quads with a triangle fan
    // at the pole, closing the three fillets that meet at each corner.
    for (const [sx, sy, sz] of OCTANTS) {
      const at = (theta: number, phi: number): Vec3 => [
        sx * (ix + c * Math.cos(phi) * Math.cos(theta)),
        sy * (iy + c * Math.sin(phi)),
        sz * (iz + c * Math.cos(phi) * Math.sin(theta)),
      ];

      for (let i = 0; i < steps; i += 1) {
        const p0 = (i / steps) * (Math.PI / 2);
        const p1 = ((i + 1) / steps) * (Math.PI / 2);
        for (let j = 0; j < steps; j += 1) {
          const t0 = (j / steps) * (Math.PI / 2);
          const t1 = ((j + 1) / steps) * (Math.PI / 2);
          if (i === steps - 1) {
            // The top ring collapses to the pole.
            pushTriangle(positions, normals, uvs, at(t0, p0), at(t1, p0), at(t0, p1));
          } else {
            pushQuad(positions, normals, uvs, at(t0, p0), at(t1, p0), at(t1, p1), at(t0, p1));
          }
        }
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  return geometry;
}
