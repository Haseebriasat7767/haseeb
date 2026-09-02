import {
  DoubleSide,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  type Material,
  type WebGLProgramParametersWithUniforms,
} from 'three';

/**
 * Procedural material factory. Materials are created once and shared
 * across meshes so Phase 2's generated geometry stays cheap to mount.
 */
function standard(params: ConstructorParameters<typeof MeshStandardMaterial>[0]) {
  return new MeshStandardMaterial(params);
}

// ─────────────────────────────────────────────────────────────────────────
// Procedural surface variation
//
// Every "natural" material (stone, concrete, wood, bark, foliage, grass,
// soil) gets a subtle deterministic tint/roughness variation driven by
// world position, injected via `onBeforeCompile`. This is real per-fragment
// GLSL noise — a handful of sin/fract operations, no texture fetch, no
// extra draw call, no render target — not a texture map and not
// `Math.random()`. Two coordinate hashes are blended so the pattern never
// repeats in an obviously tiled way, and the whole thing is cheap enough
// (a few ALU instructions) to run identically on every quality tier; the
// existing tier system keeps controlling the parameters that actually cost
// GPU time (DPR, shadow maps, antialiasing, geometry/cluster counts).
// ─────────────────────────────────────────────────────────────────────────

/** Shared GLSL: a smooth 3D value-noise built from a deterministic hash. */
const NOISE_GLSL = `
varying vec3 vAureliaWorldPos;
uniform float uVarScale;
uniform float uVarColor;
uniform float uVarRough;
uniform float uVarSeed;
uniform vec3 uVarAnisotropy;

float aureliaHash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(uVarSeed * 0.017));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float aureliaNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = aureliaHash(i + vec3(0.0, 0.0, 0.0));
  float n100 = aureliaHash(i + vec3(1.0, 0.0, 0.0));
  float n010 = aureliaHash(i + vec3(0.0, 1.0, 0.0));
  float n110 = aureliaHash(i + vec3(1.0, 1.0, 0.0));
  float n001 = aureliaHash(i + vec3(0.0, 0.0, 1.0));
  float n101 = aureliaHash(i + vec3(1.0, 0.0, 1.0));
  float n011 = aureliaHash(i + vec3(0.0, 1.0, 1.0));
  float n111 = aureliaHash(i + vec3(1.0, 1.0, 1.0));
  float nx00 = mix(n000, n100, f.x);
  float nx10 = mix(n010, n110, f.x);
  float nx01 = mix(n001, n101, f.x);
  float nx11 = mix(n011, n111, f.x);
  float nxy0 = mix(nx00, nx10, f.y);
  float nxy1 = mix(nx01, nx11, f.y);
  return mix(nxy0, nxy1, f.z);
}
`;

type VariationOptions = {
  /** World-space period, in metres, of one noise cell. */
  scale: number;
  /** Max fractional colour delta (0–1); kept small so it reads as character, not static. */
  colorVariation: number;
  /** Max additive roughness delta. */
  roughnessVariation?: number;
  /** A distinct integer per material so identical geometry never samples identically. */
  seed: number;
  /**
   * Per-axis noise-space compression before sampling — e.g. `[1, 0.12, 1]`
   * stretches cells tall along Y, which is what reads as directional grain
   * on wood and bark rather than blotchy stone-like patches.
   */
  anisotropy?: [number, number, number];
};

/**
 * Patches a standard/physical material's shader with the noise above,
 * nudging albedo and roughness per fragment from true world position.
 * Deterministic: the same material + options always compiles to the same
 * shader and therefore always looks the same. No extra GPU resource is
 * allocated — the injected code lives inside the material's own compiled
 * program, so the existing `material.dispose()` calls already release it.
 */
function withVariation<T extends Material>(material: T, options: VariationOptions): T {
  const { scale, colorVariation, roughnessVariation = 0, seed, anisotropy = [1, 1, 1] } = options;

  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uVarScale = { value: scale };
    shader.uniforms.uVarColor = { value: colorVariation };
    shader.uniforms.uVarRough = { value: roughnessVariation };
    shader.uniforms.uVarSeed = { value: seed };
    shader.uniforms.uVarAnisotropy = { value: anisotropy };

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vAureliaWorldPos;`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\n  vAureliaWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${NOISE_GLSL}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
  {
    vec3 np = vAureliaWorldPos * uVarAnisotropy * uVarScale;
    float n = aureliaNoise(np) - 0.5;
    float n2 = aureliaNoise(np * 3.7 + 11.0) - 0.5;
    float tone = n * 0.7 + n2 * 0.3;
    diffuseColor.rgb *= 1.0 + tone * uVarColor;
  }`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
  roughnessFactor = clamp(
    roughnessFactor + (aureliaNoise(vAureliaWorldPos * uVarAnisotropy * uVarScale * 1.6 + 5.0) - 0.5) * uVarRough,
    0.04,
    1.0
  );`,
      );
  };

  // Every instance of this exact material shares one compiled program.
  material.customProgramCacheKey = () => `aurelia-var-${seed}-${scale}-${colorVariation}`;

  return material;
}

let cache: ReturnType<typeof createMaterials> | null = null;

function createMaterials() {
  return {
    /**
     * Refined architectural concrete — a fair-faced, newly-cast finish.
     * Fine-grained tonal noise reads as subtle formwork/aggregate character
     * at close range and disappears into a flat premium surface from the
     * hero camera distance.
     */
    concrete: withVariation(
      standard({ color: '#a1968a', roughness: 0.64, metalness: 0.02, envMapIntensity: 0.62 }),
      {
        scale: 1.1,
        colorVariation: 0.035,
        roughnessVariation: 0.09,
        seed: 11,
      },
    ),
    /**
     * Honed limestone / travertine — warm off-white, restrained natural
     * irregularity. Coarser noise cells than concrete so it reads as large
     * quarried slabs, not aggregate.
     */
    stone: withVariation(
      standard({ color: '#b0a48d', roughness: 0.68, metalness: 0, envMapIntensity: 0.68 }),
      {
        scale: 0.55,
        colorVariation: 0.055,
        roughnessVariation: 0.12,
        seed: 23,
      },
    ),
    /**
     * The surrounding ground. Previously a near-black plane, which is what
     * made the residence look like it was floating in a void; it is now
     * mown lawn, with enough tonal variation across it to read as a
     * landscaped property rather than a fill colour.
     */
    terrain: withVariation(
      standard({ color: '#57633a', roughness: 0.96, metalness: 0, envMapIntensity: 0.6 }),
      { scale: 0.055, colorVariation: 0.3, roughnessVariation: 0.12, seed: 131 },
    ),
    /** Legacy Phase 1 diagnostic massing only — kept simple deliberately. */
    glass: standard({
      color: '#0d1418',
      roughness: 0.08,
      metalness: 0.9,
      transparent: true,
      opacity: 0.72,
    }),
    /**
     * Architectural bronze hardware accents. Now that the scene carries a
     * generated environment map, this behaves as real metal — it reflects
     * the sky rather than resolving to a flat fill.
     */
    bronze: withVariation(standard({ color: '#b08e5c', roughness: 0.26, metalness: 0.95 }), {
      scale: 3,
      colorVariation: 0.02,
      roughnessVariation: 0.04,
      seed: 3,
    }),
    /**
     * Reveals, trim, soffits, slab shadow lines — satin dark anodized
     * aluminium. The environment map is what keeps this from reading as a
     * flat cutout in shadow now; the roughness noise is what a brushed
     * anodized finish looks like without a texture.
     */
    darkMetal: withVariation(standard({ color: '#2a2a30', roughness: 0.33, metalness: 0.9 }), {
      scale: 1.4,
      colorVariation: 0.02,
      roughnessVariation: 0.06,
      seed: 61,
    }),
    /**
     * Window frames, mullions, railings, and columns. Kept a little rougher
     * and less mirror-like than the bronze so slim members read as solid
     * profiles against the glazing rather than dissolving into it.
     */
    frameMetal: withVariation(standard({ color: '#463f36', roughness: 0.34, metalness: 0.82 }), {
      scale: 2,
      colorVariation: 0.018,
      roughnessVariation: 0.04,
      seed: 17,
    }),
    /**
     * Dark luxury timber, used only for the entrance leaf. Anisotropic
     * noise compressed along the vertical axis so it reads as grain running
     * the height of the door rather than a blotchy stain.
     */
    wood: withVariation(standard({ color: '#3f3025', roughness: 0.52, metalness: 0.05 }), {
      scale: 5,
      colorVariation: 0.05,
      roughnessVariation: 0.06,
      seed: 7,
      anisotropy: [1, 0.1, 1],
    }),
    /**
     * Architectural glazing. Clearcoat rather than transmission: it reads as
     * deep reflective glass without the render-target cost transmission adds
     * on mobile GPUs. Double-sided so interiors are not hollow from behind.
     * Kept free of the procedural-noise pass — glass should read flawless
     * and machined, not organic.
     */
    glazing: new MeshPhysicalMaterial({
      color: '#1b2b36',
      roughness: 0.035,
      metalness: 0.08,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      reflectivity: 0.9,
      // The environment map is doing the work here: the sky reflected off
      // the glazing at a grazing angle is what makes a facade read as glass
      // instead of as a dark panel.
      envMapIntensity: 1.5,
      transparent: true,
      opacity: 0.58,
      side: DoubleSide,
    }),
    /**
     * Glazing applied to the face of a solid volume. Opaque, because there is
     * no void behind it to see into — transparency would read as tinted film
     * over the wall rather than as a window.
     */
    glazingSurface: new MeshPhysicalMaterial({
      color: '#1b2b36',
      roughness: 0.05,
      metalness: 0.08,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      reflectivity: 0.9,
      envMapIntensity: 1.5,
    }),
    /**
     * Pool water. Clearcoat gives a wet specular response without the cost
     * of transmission/refraction — deliberately cheap, per the Phase 2C
     * constraint against reflection render targets or simulated water. A
     * very low-amplitude noise pass reads as gentle depth variation across
     * the surface rather than a perfectly flat plane of colour.
     */
    poolWater: withVariation(
      new MeshPhysicalMaterial({
        color: '#0e3a41',
        // Water is very nearly a mirror, and with a sky to reflect it can
        // finally behave like one — the reflected dome is what gives the
        // pool its colour, not the albedo underneath.
        roughness: 0.045,
        envMapIntensity: 1.35,
        // After dark the submerged lighting is carried by the water body
        // itself rather than by the basin walls, so the pool reads as a
        // soft luminous plane instead of a glowing outline.
        emissive: '#22403f',
        emissiveIntensity: 0,
        metalness: 0.04,
        clearcoat: 1,
        clearcoatRoughness: 0.06,
        transparent: true,
        opacity: 0.9,
      }),
      { scale: 0.3, colorVariation: 0.05, seed: 71 },
    ),
    /**
     * Dark plaster pool interior — basin, steps, and the infinity channel.
     * Carries an emissive term that stays at zero through the day and comes
     * up after dark, which is how the submerged perimeter lighting reads
     * without a single dynamic light inside the water.
     */
    poolInterior: withVariation(
      standard({
        color: '#12222a',
        roughness: 0.85,
        metalness: 0,
        emissive: '#16262b',
        emissiveIntensity: 0,
      }),
      {
        scale: 1.6,
        colorVariation: 0.03,
        roughnessVariation: 0.05,
        seed: 29,
      },
    ),
    /** Tree trunks and major branches — vertical grain, like the entrance wood. */
    bark: withVariation(standard({ color: '#453a2f', roughness: 0.9, metalness: 0 }), {
      scale: 2.4,
      colorVariation: 0.06,
      roughnessVariation: 0.05,
      seed: 41,
      anisotropy: [1, 0.18, 1],
    }),
    /** Sunlit foliage — canopy, shrubs, hedges. Muted sage, not garden green. */
    foliageMid: withVariation(standard({ color: '#5c6a4c', roughness: 0.86, metalness: 0 }), {
      scale: 0.9,
      colorVariation: 0.06,
      roughnessVariation: 0.05,
      seed: 53,
    }),
    /** Shadowed foliage, layered under `foliageMid` for depth without a texture. */
    foliageDark: withVariation(standard({ color: '#3a4433', roughness: 0.9, metalness: 0 }), {
      scale: 0.9,
      colorVariation: 0.06,
      roughnessVariation: 0.05,
      seed: 59,
    }),
    /** Ornamental grass — warmer and drier than the foliage greens. */
    grass: withVariation(standard({ color: '#6b7347', roughness: 0.86, metalness: 0 }), {
      scale: 1.3,
      colorVariation: 0.05,
      roughnessVariation: 0.04,
      seed: 67,
    }),
    /**
     * The mown lawn's blades. Deliberately *not* the ornamental `grass`
     * above: that one is a warm dry olive chosen to contrast with planting,
     * and instancing it across the whole property read as scattered yellow
     * needles over the ground rather than as turf. This sits a shade lighter
     * than `terrain` and nothing else, so the blades resolve as a nap on the
     * ground at distance instead of as separate objects on top of it.
     */
    lawnBlade: standard({
      color: '#63713e',
      roughness: 0.94,
      metalness: 0,
      envMapIntensity: 0.4,
    }),
    /** Exposed soil in planting beds and planter tops. */
    soil: withVariation(standard({ color: '#2b2318', roughness: 0.98, metalness: 0 }), {
      scale: 1.8,
      colorVariation: 0.05,
      roughnessVariation: 0.03,
      seed: 79,
    }),

    // ── Interior palette (Phase 2F) ──────────────────────────────────────
    // Deliberately additions to this same cache rather than a second one:
    // every interior surface still resolves through `getMaterials()` and is
    // released by the same `disposeMaterials()`.

    /**
     * Polished interior plaster — partitions, ceilings, and reveals. Very
     * low-amplitude, large-cell noise so a big flat wall reads as a hand-
     * finished surface rather than a solid fill, without ever looking dirty.
     */
    plaster: withVariation(standard({ color: '#cec7ba', roughness: 0.9, metalness: 0 }), {
      scale: 0.35,
      colorVariation: 0.022,
      roughnessVariation: 0.04,
      seed: 83,
    }),
    /**
     * Honed pale limestone flooring for the principal rooms. Larger, softer
     * cells than the exterior `stone` so it reads as big-format interior
     * slabs, and lower roughness for the sheen of a honed finish.
     */
    interiorStone: withVariation(standard({ color: '#b8b0a0', roughness: 0.52, metalness: 0.02 }), {
      scale: 0.4,
      colorVariation: 0.04,
      roughnessVariation: 0.07,
      seed: 89,
    }),
    /**
     * Interior joinery timber — cabinetry, built-ins, bedroom flooring.
     * Warmer and lighter than the entrance `wood`, with the same vertically
     * compressed anisotropy that reads as directional grain.
     */
    joinery: withVariation(standard({ color: '#6b503a', roughness: 0.46, metalness: 0.04 }), {
      scale: 4.5,
      colorVariation: 0.055,
      roughnessVariation: 0.06,
      seed: 97,
      anisotropy: [1, 0.12, 1],
    }),
    /**
     * Book-matched marble for island tops, vanities, and the fireplace
     * surround. Strongly anisotropic noise stretched along X is what draws
     * veining across a slab without a texture map.
     */
    marble: withVariation(standard({ color: '#e2ded5', roughness: 0.22, metalness: 0.03 }), {
      scale: 1.6,
      colorVariation: 0.09,
      roughnessVariation: 0.05,
      seed: 101,
      anisotropy: [0.25, 1.6, 1],
    }),
    /** Principal upholstery — sofas, beds, headboards. Warm greige linen. */
    upholstery: withVariation(standard({ color: '#9a917f', roughness: 0.95, metalness: 0 }), {
      scale: 6,
      colorVariation: 0.05,
      roughnessVariation: 0.04,
      seed: 103,
    }),
    /** Accent upholstery — occasional chairs, stools, bed throws. */
    upholsteryDark: withVariation(standard({ color: '#4a463f', roughness: 0.96, metalness: 0 }), {
      scale: 6,
      colorVariation: 0.06,
      roughnessVariation: 0.04,
      seed: 107,
    }),
    /** Deep-pile wool rugs. Coarse noise reads as pile at close range. */
    rug: withVariation(standard({ color: '#5f574a', roughness: 1, metalness: 0 }), {
      scale: 9,
      colorVariation: 0.08,
      roughnessVariation: 0.03,
      seed: 109,
    }),
    /** Sanitaryware and tableware — glazed white ceramic. */
    ceramic: standard({ color: '#eef0ee', roughness: 0.12, metalness: 0.02 }),
    /**
     * Lit fixture surfaces — pendants, cove strips, integrated joinery
     * lighting. Emissive only: it costs nothing beyond a normal material and
     * carries no bloom or post-processing, which stays out of Phase 2F.
     */
    lightGlow: standard({
      color: '#241d14',
      roughness: 0.6,
      metalness: 0,
      emissive: '#ffd9a8',
      emissiveIntensity: 1.5,
    }),
  };
}

/** Lazily-built shared material library. */
export function getMaterials() {
  cache ??= createMaterials();
  return cache;
}

/** Frees GPU resources — call when the whole experience unmounts. */
export function disposeMaterials() {
  if (!cache) return;
  for (const material of Object.values(cache)) material.dispose();
  cache = null;
}
