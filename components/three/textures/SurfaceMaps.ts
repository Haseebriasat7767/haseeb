import {
  CanvasTexture,
  LinearMipmapLinearFilter,
  LinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three';

/**
 * Albedo, roughness and normal maps for the residence's material families.
 *
 * ## Why these are generated rather than downloaded
 *
 * Phase 7G called for CC0 scans from ambientCG or Poly Haven. The build
 * environment's egress proxy denies CONNECT to both (403, policy denial),
 * so no external texture could be fetched — see the phase report. Rather
 * than ship the phase with nothing, the map *pipeline* is built in full and
 * fed from the same canvas technique the Phase 7E foliage atlas uses.
 *
 * That distinction is worth being precise about, because it decides what
 * this does and does not buy. A generated plaster will never carry the
 * incidental character of a real one — the trowel that skipped, the patch
 * that dried differently. What it does carry is the thing that was actually
 * missing: real per-texel detail with a real mip chain. The Phase 7B
 * procedural relief had to fade out beyond nine metres because analytic
 * noise cannot be filtered and aliased into moire; a sampled map is
 * filtered by the hardware, so the same detail survives to any distance.
 *
 * Swapping in real scans later is a small change: build `SurfaceMaps` from
 * `TextureLoader` instead of from a canvas and keep everything else —
 * the metre-scale tiling, the per-family repeat, the normal strengths.
 *
 * ## Scale
 *
 * `ChamferedBox` has emitted world-axis UVs in metres since Phase 7B, so
 * one UV unit is one metre of real surface on every box in the building.
 * Each family therefore declares the physical size of the patch it depicts
 * and the repeat falls out as its reciprocal — which is what keeps a plank
 * the same width on a floor and on a cabinet door.
 */

/** Side of every generated map, in pixels. */
const SIZE = 512;

export type SurfaceFamily =
  'plaster' | 'stone' | 'oak' | 'marble' | 'linen' | 'wool' | 'leather' | 'paving';

export type SurfaceMaps = {
  map: CanvasTexture;
  roughnessMap: CanvasTexture;
  normalMap: CanvasTexture;
  /** Metres of real surface one tile of these maps covers. */
  metres: number;
  /** Sensible normal-map strength for this family. */
  normalScale: number;
};

// ── Noise ────────────────────────────────────────────────────────────────

/**
 * A wrapping integer hash. Wrapping is what makes every map below tile
 * seamlessly: sample coordinates are taken modulo the period, so the noise
 * at u=1 is by construction the noise at u=0.
 */
function hash2(ix: number, iy: number, period: number, seed: number): number {
  const x = ((ix % period) + period) % period;
  const y = ((iy % period) + period) % period;
  const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Smooth value noise over a wrapping lattice. */
function noise2(u: number, v: number, period: number, seed: number): number {
  const ix = Math.floor(u);
  const iy = Math.floor(v);
  const fx = u - ix;
  const fy = v - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, period, seed);
  const b = hash2(ix + 1, iy, period, seed);
  const c = hash2(ix, iy + 1, period, seed);
  const d = hash2(ix + 1, iy + 1, period, seed);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}

/** Fractal sum of the above, still wrapping at `period`. */
function fbm(u: number, v: number, period: number, seed: number, octaves: number): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o += 1) {
    sum += noise2(u * freq, v * freq, period * freq, seed + o * 17) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

// ── Family recipes ───────────────────────────────────────────────────────

type Sample = {
  /** Surface height, 0–1. Drives the normal map. */
  height: number;
  /** Multiplier on the family's base colour, around 1. */
  tone: number;
  /** Roughness, 0–1. */
  rough: number;
};

type Recipe = {
  /**
   * The family's own hue, as sRGB bytes.
   *
   * Normalised at bake time so the map's mean sits near white rather than
   * at this absolute value. That matters: six phases of tuning went into
   * the per-material colours in `materials.ts`, and an albedo map that
   * replaced them outright would throw all of it away. The map instead
   * carries the family's *hue ratio* and its tonal variation, and the
   * material's own colour still decides what the surface is.
   */
  base: [number, number, number];
  metres: number;
  normalScale: number;
  sample: (u: number, v: number) => Sample;
};

/** Lattice cells across one tile. Higher is finer detail. */
const P = 16;

function makeRecipes(): Record<SurfaceFamily, Recipe> {
  return {
    /**
     * Polished plaster: micro variation only. The brief is explicit that
     * this must not read as concrete, so the height field is shallow and
     * the tonal range is a couple of per cent — it should only appear under
     * grazing light.
     */
    plaster: {
      base: [206, 199, 186],
      metres: 1.6,
      normalScale: 0.1,
      sample: (u, v) => {
        const fine = fbm(u * P * 2.5, v * P * 2.5, P * 2.5, 11, 4);
        const broad = fbm(u * 3, v * 3, 3, 23, 2);
        return {
          height: 0.5 + (fine - 0.5) * 0.3 + (broad - 0.5) * 0.25,
          tone: 1 + (broad - 0.5) * 0.022 + (fine - 0.5) * 0.01,
          rough: 0.88 + (fine - 0.5) * 0.04,
        };
      },
    },

    /**
     * Honed limestone: broad quarried tone across half a metre, with fine
     * pitting over it. Deliberately clean — luxury stone is controlled, and
     * dirt is what makes architectural CG look like a game level.
     */
    stone: {
      base: [180, 168, 145],
      metres: 1.2,
      normalScale: 0.18,
      sample: (u, v) => {
        const bed = fbm(u * 2.2, v * 2.2, 2.2, 31, 3);
        const pores = fbm(u * P * 4, v * P * 4, P * 4, 37, 2);
        const pit = pores < 0.22 ? (0.22 - pores) * 1.1 : 0;
        return {
          height: 0.55 + (bed - 0.5) * 0.22 - pit * 0.35,
          tone: 1 + (bed - 0.5) * 0.06 - pit * 0.05,
          rough: 0.66 + (bed - 0.5) * 0.1 + pit * 0.14,
        };
      },
    },

    /**
     * European oak, laid in boards. The grain runs along U and the boards
     * are separated across V, so the plank direction is carried by the
     * texture itself rather than by hoping the projection lands well.
     */
    oak: {
      base: [136, 119, 97],
      metres: 2.2,
      normalScale: 0.26,
      sample: (u, v) => {
        // Boards: eight across the tile, each shifted along its length so
        // the butt joints do not line up into a visible grid.
        const boards = 8;
        const bi = Math.floor(v * boards);
        const shift = hash2(bi, 0, boards, 51);
        const uu = u + shift;
        const acrossBoard = v * boards - bi;

        // Grain: noise stretched hard along the board's length.
        const grain = fbm(uu * 5, v * boards * 26, 5, 57 + bi, 4);
        const figure = Math.sin((grain + acrossBoard * 0.6) * 22) * 0.5 + 0.5;
        // The joint between boards, and the chamfer either side of it.
        const joint = Math.min(acrossBoard, 1 - acrossBoard);
        const jointDepth = joint < 0.035 ? 1 - joint / 0.035 : 0;
        const boardTone = (hash2(bi, 3, boards, 61) - 0.5) * 0.13;

        return {
          height: 0.62 + figure * 0.12 - jointDepth * 0.55,
          tone: 1 + boardTone + (figure - 0.5) * 0.16 - jointDepth * 0.25,
          rough: 0.5 + (1 - figure) * 0.1 + jointDepth * 0.2,
        };
      },
    },

    /**
     * Statuario-like marble: a pale ground with soft grey veining. Kept
     * low-contrast on purpose — the high-contrast black-and-white marble
     * that CG reaches for first is exactly what makes a bathroom look
     * rendered rather than built.
     */
    marble: {
      base: [222, 218, 210],
      metres: 2.4,
      normalScale: 0.09,
      sample: (u, v) => {
        // Turbulence-warped bands: a straight sine warped by noise is the
        // cheapest thing that reads as a mineral vein.
        const warp = fbm(u * 3, v * 3, 3, 71, 4) - 0.5;
        const warp2 = fbm(u * 7 + 3, v * 7, 7, 79, 3) - 0.5;
        const band = Math.sin((u * 1.6 + v * 2.4 + warp * 2.6 + warp2 * 0.9) * Math.PI * 2);
        const vein = Math.pow(Math.max(0, 1 - Math.abs(band) * 3.4), 2.2);
        const dust = fbm(u * P * 3, v * P * 3, P * 3, 83, 2);
        return {
          height: 0.5 + (dust - 0.5) * 0.18 - vein * 0.1,
          tone: 1 - vein * 0.2 + (dust - 0.5) * 0.03,
          rough: 0.2 + vein * 0.07 + (dust - 0.5) * 0.03,
        };
      },
    },

    /**
     * Linen: a plain weave. The over/under is what gives fabric its
     * characteristic response, but it has to stay small — the brief's
     * warning about visibly noisy fabric is the failure mode here.
     */
    linen: {
      base: [190, 180, 163],
      // A third of a metre per tile put the weave's pitch at nearly eight
      // millimetres, which is not linen — it is corduroy, and the rendered
      // sofa read exactly that way, in visible vertical ribs. Tiling three
      // times as often brings the thread down to roughly two millimetres,
      // where it stops being a stripe and starts being a surface.
      metres: 0.1,
      normalScale: 0.1,
      sample: (u, v) => {
        const threads = 44;
        // Warp and weft summed rather than multiplied: the product of two
        // sines is a diagonal checker, which is what made the first version
        // read as corduroy rather than as cloth.
        const warp = Math.sin(u * threads * Math.PI * 2);
        const weft = Math.sin(v * threads * Math.PI * 2);
        const weave = (warp + weft) * 0.25 + 0.5;
        const slub = fbm(u * 7, v * 7, 7, 89, 3);
        return {
          height: 0.5 + (weave - 0.5) * 0.22 + (slub - 0.5) * 0.14,
          tone: 1 + (weave - 0.5) * 0.025 + (slub - 0.5) * 0.035,
          rough: 0.94 + (weave - 0.5) * 0.02,
        };
      },
    },

    /** Wool pile: dense fine clumping with no directional structure. */
    wool: {
      base: [150, 141, 128],
      metres: 0.5,
      normalScale: 0.28,
      sample: (u, v) => {
        const pile = fbm(u * P * 3, v * P * 3, P * 3, 97, 3);
        const clump = fbm(u * 9, v * 9, 9, 101, 2);
        return {
          height: 0.5 + (pile - 0.5) * 0.5 + (clump - 0.5) * 0.2,
          tone: 1 + (pile - 0.5) * 0.06 + (clump - 0.5) * 0.05,
          rough: 0.97 + (pile - 0.5) * 0.03,
        };
      },
    },

    /**
     * Leather: a large smooth surface with a very shallow cellular grain.
     * The amplitude is deliberately near the floor — pebbling that reads
     * from across a room is upholstery vinyl, not hide.
     */
    leather: {
      base: [120, 109, 99],
      metres: 0.8,
      normalScale: 0.13,
      sample: (u, v) => {
        // A cheap cellular field: two offset noise layers differenced,
        // which produces the closed irregular cells hide grain has.
        const a = fbm(u * P, v * P, P, 103, 2);
        const b = fbm(u * P + 0.37, v * P + 0.61, P, 107, 2);
        const cells = Math.abs(a - b);
        const creases = fbm(u * 4, v * 4, 4, 109, 3);
        return {
          height: 0.55 - cells * 0.45 + (creases - 0.5) * 0.25,
          tone: 1 - cells * 0.1 + (creases - 0.5) * 0.07,
          rough: 0.55 + cells * 0.12 + (creases - 0.5) * 0.05,
        };
      },
    },

    /**
     * Sawn paving stone. Joints are deliberately absent: the driveway and
     * court lay real 1.2 m modules with real open joints as geometry, and
     * a texture drawing its own joints on top would fight them.
     */
    paving: {
      base: [143, 136, 124],
      metres: 1.2,
      normalScale: 0.2,
      sample: (u, v) => {
        const grain = fbm(u * 3.4, v * 3.4, 3.4, 113, 3);
        const saw = fbm(u * P * 5, v * P * 1.5, P * 5, 127, 2);
        return {
          height: 0.5 + (grain - 0.5) * 0.4 + (saw - 0.5) * 0.35,
          tone: 1 + (grain - 0.5) * 0.13 + (saw - 0.5) * 0.05,
          rough: 0.8 + (grain - 0.5) * 0.1 + (saw - 0.5) * 0.06,
        };
      },
    },
  };
}

// ── Baking ───────────────────────────────────────────────────────────────

function makeCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D | null } {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  return { canvas, ctx: canvas.getContext('2d') };
}

function finish(canvas: HTMLCanvasElement, srgb: boolean, metres: number): CanvasTexture {
  const texture = new CanvasTexture(canvas);
  if (srgb) texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  // UVs are in metres, so the repeat is simply how many tiles fit in one.
  texture.repeat.set(1 / metres, 1 / metres);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Bakes one family into its three maps.
 *
 * The normal map is derived from the height field by central difference
 * across the wrapping lattice, which is both what a scanner's own pipeline
 * does and the reason the maps tile without a visible seam.
 */
function bake(recipe: Recipe): SurfaceMaps {
  const albedo = makeCanvas();
  const roughness = makeCanvas();
  const normal = makeCanvas();

  const height = new Float32Array(SIZE * SIZE);
  const albedoData = albedo.ctx?.createImageData(SIZE, SIZE);
  const roughData = roughness.ctx?.createImageData(SIZE, SIZE);
  const normalData = normal.ctx?.createImageData(SIZE, SIZE);
  if (!albedoData || !roughData || !normalData) {
    // Without a 2D context there is nothing to bake; the caller still gets
    // usable (blank) textures and the material falls back to flat colour.
    return {
      map: finish(albedo.canvas, true, recipe.metres),
      roughnessMap: finish(roughness.canvas, false, recipe.metres),
      normalMap: finish(normal.canvas, false, recipe.metres),
      metres: recipe.metres,
      normalScale: recipe.normalScale,
    };
  }

  // Sits the map's mean near white, leaving headroom in both directions.
  const hueScale = 236 / ((recipe.base[0] + recipe.base[1] + recipe.base[2]) / 3);

  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const s = recipe.sample(x / SIZE, y / SIZE);
      const i = y * SIZE + x;
      height[i] = s.height;

      const o = i * 4;
      albedoData.data[o] = Math.max(0, Math.min(255, recipe.base[0] * hueScale * s.tone));
      albedoData.data[o + 1] = Math.max(0, Math.min(255, recipe.base[1] * hueScale * s.tone));
      albedoData.data[o + 2] = Math.max(0, Math.min(255, recipe.base[2] * hueScale * s.tone));
      albedoData.data[o + 3] = 255;

      const r = Math.max(0, Math.min(1, s.rough)) * 255;
      roughData.data[o] = r;
      roughData.data[o + 1] = r;
      roughData.data[o + 2] = r;
      roughData.data[o + 3] = 255;
    }
  }

  // Height to tangent-space normal. The strength here is the *encoding*
  // gain; per-material response is set by `normalScale` on the material,
  // which is what the brief asks be tested rather than maxed.
  const gain = SIZE * 0.02;
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const left = height[y * SIZE + ((x - 1 + SIZE) % SIZE)]!;
      const right = height[y * SIZE + ((x + 1) % SIZE)]!;
      const up = height[((y - 1 + SIZE) % SIZE) * SIZE + x]!;
      const down = height[((y + 1) % SIZE) * SIZE + x]!;

      let nx = (left - right) * gain;
      let ny = (up - down) * gain;
      let nz = 1;
      const length = Math.hypot(nx, ny, nz) || 1;
      nx /= length;
      ny /= length;
      nz /= length;

      const o = (y * SIZE + x) * 4;
      normalData.data[o] = (nx * 0.5 + 0.5) * 255;
      normalData.data[o + 1] = (ny * 0.5 + 0.5) * 255;
      normalData.data[o + 2] = (nz * 0.5 + 0.5) * 255;
      normalData.data[o + 3] = 255;
    }
  }

  albedo.ctx?.putImageData(albedoData, 0, 0);
  roughness.ctx?.putImageData(roughData, 0, 0);
  normal.ctx?.putImageData(normalData, 0, 0);

  return {
    map: finish(albedo.canvas, true, recipe.metres),
    roughnessMap: finish(roughness.canvas, false, recipe.metres),
    normalMap: finish(normal.canvas, false, recipe.metres),
    metres: recipe.metres,
    normalScale: recipe.normalScale,
  };
}

const cache = new Map<SurfaceFamily, SurfaceMaps>();

/** The maps for one family, baked once and shared by every material using it. */
export function getSurfaceMaps(family: SurfaceFamily): SurfaceMaps {
  let maps = cache.get(family);
  if (!maps) {
    maps = bake(makeRecipes()[family]);
    cache.set(family, maps);
  }
  return maps;
}

/** Releases every baked map when the experience unmounts. */
export function disposeSurfaceMaps(): void {
  for (const maps of cache.values()) {
    maps.map.dispose();
    maps.roughnessMap.dispose();
    maps.normalMap.dispose();
  }
  cache.clear();
}
