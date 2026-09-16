import { describe, expect, it } from 'vitest';
import { CUBE_FACES, CUBE_FACE_FOV } from '@/lib/pano/cube-faces';
import { CUBE_FACE_ORDER } from '@/lib/pano/panoLoader';
import { CUBE_FACES as CUBE_FACES_MJS } from '@/scripts/lib/cubemap-faces.mjs';

type Vec = readonly [number, number, number];

const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const length = (a: Vec) => Math.hypot(...a);

const face = (id: string) => {
  const found = CUBE_FACES.find((entry) => entry.id === id);
  if (!found) throw new Error(`no face ${id}`);
  return { dir: found.dir as unknown as Vec, up: found.up as unknown as Vec };
};

describe('cube face orientation', () => {
  it('uses each of the six canonical axes exactly once', () => {
    // Deliberately not "all six are mutually orthogonal" — opposite faces
    // are anti-parallel, so that assertion is simply false.
    const dirs = CUBE_FACES.map((entry) => entry.dir.join(','));
    expect(new Set(dirs).size).toBe(6);
    for (const entry of CUBE_FACES) {
      expect(length(entry.dir as unknown as Vec)).toBeCloseTo(1, 12);
      expect(entry.dir.filter((component) => component !== 0)).toHaveLength(1);
    }
  });

  it('gives every face a unit up that is perpendicular to its direction', () => {
    for (const entry of CUBE_FACES) {
      const dir = entry.dir as unknown as Vec;
      const up = entry.up as unknown as Vec;
      expect(length(up)).toBeCloseTo(1, 12);
      expect(dot(dir, up)).toBeCloseTo(0, 12);
    }
  });

  it('matches the WebGLCubeRenderTarget basis face for face', () => {
    // The assertion that actually catches a gimbal-locked Euler table: a
    // yaw/pitch derivation gets all six directions right and puts py and ny
    // 180° out of roll, which only shows up in the up vectors.
    //
    // Pinned from three's CubeCamera source (WebGL coordinate system), not
    // re-derived here — re-deriving it would reproduce whatever mistake the
    // implementation made.
    const expected: Record<string, { dir: Vec; up: Vec }> = {
      px: { dir: [1, 0, 0], up: [0, 1, 0] },
      nx: { dir: [-1, 0, 0], up: [0, 1, 0] },
      py: { dir: [0, 1, 0], up: [0, 0, -1] },
      ny: { dir: [0, -1, 0], up: [0, 0, 1] },
      pz: { dir: [0, 0, 1], up: [0, 1, 0] },
      nz: { dir: [0, 0, -1], up: [0, 1, 0] },
    };

    for (const [id, want] of Object.entries(expected)) {
      const got = face(id);
      expect(got.dir).toEqual(want.dir);
      expect(got.up).toEqual(want.up);

      // The third basis vector must be unit too — that is what makes the
      // triple a rotation rather than a reflection or a degenerate frame.
      const right = cross(got.up, got.dir);
      expect(length(right)).toBeCloseTo(1, 12);
    }
  });

  it('rejects the yaw/pitch derivation it replaced', () => {
    // Proof that the assertion above earns its place. Applying the old
    // YXZ table's rotation to the camera's default up (0,1,0):
    //   py: Rx(+π/2)·(0,1,0) = (0, 0,  1)
    //   ny: Rx(-π/2)·(0,1,0) = (0, 0, -1)
    // Both are the negation of what the cube basis requires, so the pole
    // faces come out rotated half a turn. The side faces survive by luck,
    // because yaw alone leaves up at +Y.
    const eulerUp = (pitch: number): Vec => [0, Math.cos(pitch), Math.sin(pitch)];

    expect(eulerUp(Math.PI / 2)[2]).toBeCloseTo(1, 12);
    expect(face('py').up[2]).toBe(-1);

    expect(eulerUp(-Math.PI / 2)[2]).toBeCloseTo(-1, 12);
    expect(face('ny').up[2]).toBe(1);
  });

  it('is the order CubeTextureLoader reads its URLs in', () => {
    expect(CUBE_FACES.map((entry) => entry.id)).toEqual([...CUBE_FACE_ORDER]);
  });

  it('keeps the .mjs mirror in step with the typed table', () => {
    // The render scripts are .mjs so they stay out of the app's type graph,
    // which means a second list of face ids exists. This is the only thing
    // stopping the two from drifting — and a drifted order writes six
    // correctly rendered faces to six wrong filenames.
    expect(CUBE_FACES_MJS).toEqual(CUBE_FACES.map((entry) => entry.id));
  });

  it('pins the face fov at 90 degrees', () => {
    // Six faces at any other angle do not tile.
    expect(CUBE_FACE_FOV).toBe(90);
  });
});
