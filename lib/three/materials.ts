import {
  CubeTexture,
  DoubleSide,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  type Material,
  type Texture,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { getSurfaceMaps, type SurfaceFamily } from '@/components/three/textures/SurfaceMaps';

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
uniform float uVarNormalScale;
uniform float uVarNormal;

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

// Micro-relief as a sum of four travelling waves in skewed directions.
//
// The obvious way to tilt a normal from procedural noise is to take a
// finite difference of the value-noise field above — four samples, each
// eight hash evaluations. That was the first implementation here and it
// was sixty-four extra hash operations on every fragment of every surface
// in the scene, which is a real cost even on hardware and made the
// software rasterizer used for verification unusable.
//
// A sum of sines needs no differencing at all: the gradient of
// a*sin(dot(p, d)*k) is a*k*d*cos(dot(p, d)*k), so the
// slope falls out of the same four cosines that would evaluate the height.
// Four incommensurate directions, none axis-aligned, keep it from reading
// as the corduroy that a naive axis-aligned wave field produces.
vec3 aureliaSurfaceGradient(vec3 p) {
  const vec3 d1 = vec3(0.87, 0.31, 0.38);
  const vec3 d2 = vec3(-0.29, 0.81, 0.51);
  const vec3 d3 = vec3(0.41, -0.45, 0.79);
  const vec3 d4 = vec3(0.63, 0.55, -0.55);

  // Four waves in fixed directions are periodic, and at the frequencies a
  // material finish actually lives at that period is plainly visible as a
  // woven cross-hatch across a large slab. One low-frequency noise sample
  // rolls the phase of the whole field and destroys the repeat, for an
  // eighth of what differencing the noise field itself would cost.
  //
  // Because the phase now varies with position the gradient is strictly
  // approximate; the warp runs some twenty times slower than the carrier,
  // so the error stays far below the amplitude of the relief it describes.
  float s = uVarSeed + aureliaNoise(p * 0.16) * 6.2831853;
  return d1 * (1.00 * cos(dot(p, d1) * 1.0 + s))
       + d2 * (1.38 * cos(dot(p, d2) * 2.3 + s * 1.7))
       + d3 * (1.44 * cos(dot(p, d3) * 4.1 + s * 2.9))
       + d4 * (1.58 * cos(dot(p, d4) * 7.9 + s * 3.7));
}

// Tilts a surface normal along that gradient.
//
// This is what a normal map does, computed rather than sampled: the
// component along the existing normal is removed so the surface is tilted
// rather than inflated, and the result is renormalised.
vec3 aureliaPerturb(vec3 worldPos, vec3 nView, float strength) {
  if (strength <= 0.0) return nView;

  // Fade the relief out with distance.
  //
  // Procedural micro-relief has no mip chain, so once a surface feature
  // falls below a pixel it does not average away the way a sampled normal
  // map would — it aliases, and across the villa's large flat planes that
  // showed as a moire cross-hatch over the roof and the terrace. Real
  // texture maps in a later phase will filter properly; until then the
  // honest fix is to stop asserting detail the frame cannot resolve. Close
  // up, where the relief is the whole point, nothing is lost.
  float viewDistance = length(cameraPosition - worldPos);
  strength *= 1.0 - smoothstep(9.0, 34.0, viewDistance);
  if (strength <= 0.0) return nView;

  vec3 grad = aureliaSurfaceGradient(worldPos * uVarAnisotropy * uVarNormalScale);

  // The gradient is a world-space direction and the normal being perturbed
  // is in view space, so it has to be carried across. For a standard camera
  // the view matrix's upper 3x3 is a rotation, which transforms directions
  // directly.
  vec3 gradView = mat3(viewMatrix) * (grad * uVarAnisotropy);
  gradView -= nView * dot(gradView, nView);
  return normalize(nView - gradView * strength);
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
  /**
   * How far the surface normal is tilted by the detail field. This is the
   * micro-relief that was missing entirely: without it a surface is
   * mathematically flat however much its colour varies, so concrete has no
   * aggregate, stone has no grain and plaster has no trowel. Values are
   * small — 0.02 is a barely-perceptible plaster, 0.2 is coarse render.
   * Zero leaves the normal untouched and compiles out nothing, so it is
   * the default for anything genuinely smooth.
   */
  normalStrength?: number;
  /**
   * World-space frequency of that relief, independent of `scale`. Surface
   * grain and tonal variation live at different sizes on almost every real
   * material — limestone mottles over half a metre but is pitted over
   * millimetres — and tying them together is what makes procedural
   * surfaces read as one repeating pattern.
   */
  normalScale?: number;
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
  const {
    scale,
    colorVariation,
    roughnessVariation = 0,
    seed,
    anisotropy = [1, 1, 1],
    normalStrength = 0,
    normalScale = scale * 8,
  } = options;

  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uVarScale = { value: scale };
    shader.uniforms.uVarColor = { value: colorVariation };
    shader.uniforms.uVarRough = { value: roughnessVariation };
    shader.uniforms.uVarSeed = { value: seed };
    shader.uniforms.uVarAnisotropy = { value: anisotropy };
    shader.uniforms.uVarNormalScale = { value: normalScale };
    shader.uniforms.uVarNormal = { value: normalStrength };

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
      // After `normal_fragment_begin`, `normal` holds the interpolated
      // (and, for a double-sided face, flipped) shading normal — the same
      // point three's own normal maps hook into.
      .replace(
        '#include <normal_fragment_begin>',
        `#include <normal_fragment_begin>
  normal = aureliaPerturb(vAureliaWorldPos, normal, uVarNormal);`,
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
  material.customProgramCacheKey = () =>
    `aurelia-var-${seed}-${scale}-${colorVariation}-${normalStrength}-${normalScale}`;

  return material;
}

/**
 * The sky, as a cube texture, for surfaces that need to know what colour the
 * air in front of them is.
 *
 * `ProceduralSky` already bakes one of these for the path tracer. Holding a
 * reference to it here lets a rasterized material sample the sky along its
 * own view ray, which is the difference between fog that is approximately
 * the right colour and haze that is exactly it.
 */
const skyCube: { value: Texture | null } = { value: null };

/**
 * A single black texel per face, bound whenever no sky has been baked yet.
 *
 * A `samplerCube` uniform must be bound to something for the program to be
 * valid, and the aerial-perspective mix below is driven to zero in the same
 * frames this stands in, so it is never actually seen.
 */
let fallbackCube: CubeTexture | null = null;

function getFallbackCube(): CubeTexture {
  if (fallbackCube) return fallbackCube;
  const faces = Array.from({ length: 6 }, () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas;
  });
  fallbackCube = new CubeTexture(faces);
  fallbackCube.needsUpdate = true;
  return fallbackCube;
}

/** Uniform objects handed to every aerial-perspective program, so one
 *  assignment updates all of them. */
const aerialUniforms = {
  map: { value: null as Texture | null },
  strength: { value: 0 },
};

/**
 * Publishes the baked sky so aerial perspective has something to sample.
 * Called by `ProceduralSky` each time the hour changes; passing null (on
 * unmount) disables the effect rather than leaving a stale sky behind.
 */
export function setSkyCube(texture: Texture | null): void {
  skyCube.value = texture;
  aerialUniforms.map.value = texture ?? getFallbackCube();
  aerialUniforms.strength.value = texture ? 1 : 0;
}

/**
 * Aerial perspective: distance dissolving a surface into the sky in front
 * of it.
 *
 * ## Why the ground needed this specifically
 *
 * The terrain is a finite plane. Rendered without haze it ends in a dead
 * straight line against the sky, and that line is the single most reliable
 * tell in the whole exterior — it says "this is a ground plane in a 3D
 * scene" more loudly than any material problem, because no real landscape
 * has an edge.
 *
 * Scene fog already exists and already runs on everything, but fog is one
 * colour in every direction, and the sky is not. At golden hour the sun's
 * quarter of the dome is warm and the opposite quarter is a cool grey, so a
 * single fog colour is visibly wrong across half of any wide shot: the
 * distant ground either glows warm against a cool sky or goes grey against
 * a warm one, and either way the seam it was meant to hide is still there.
 *
 * Sampling the baked sky along the fragment's own view direction gives the
 * exact colour of the sky *directly behind* that piece of ground. Blend to
 * it and the horizon does not soften — it stops existing, because the last
 * visible ground is by construction the same colour as the sky above it.
 *
 * The material carrying this turns three's own fog off; the two are the
 * same effect and would otherwise compound.
 */
function withAerialPerspective<T extends MeshStandardMaterial>(
  material: T,
  /** Metres at which haze begins. */
  start: number,
  /** Metres at which the surface is entirely sky. */
  end: number,
): T {
  material.fog = false;

  const existing = material.onBeforeCompile;

  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    existing?.(shader, undefined as never);

    shader.uniforms.uSkyCube = aerialUniforms.map;
    shader.uniforms.uAerial = aerialUniforms.strength;
    shader.uniforms.uAerialStart = { value: start };
    shader.uniforms.uAerialEnd = { value: end };

    if (!shader.vertexShader.includes('vAureliaWorldPos')) {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\nvarying vec3 vAureliaWorldPos;`)
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>\n  vAureliaWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
        );
    }

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform samplerCube uSkyCube;
uniform float uAerial;
uniform float uAerialStart;
uniform float uAerialEnd;`,
      )
      .replace(
        '#include <opaque_fragment>',
        `#include <opaque_fragment>
  {
    vec3 toEye = vAureliaWorldPos - cameraPosition;
    float haze = smoothstep(uAerialStart, uAerialEnd, length(toEye)) * uAerial;
    if (haze > 0.0) {
      // The sky along this fragment's own view ray, which is precisely what
      // would be visible if the ground were not in the way.
      vec3 sky = textureCube(uSkyCube, normalize(toEye)).rgb;
      gl_FragColor.rgb = mix(gl_FragColor.rgb, sky, haze);
    }
  }`,
      );
  };

  const previousKey = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () =>
    `${previousKey ? previousKey() : 'aurelia'}-aerial-${start}-${end}`;

  return material;
}

/**
 * The signature of a maintained lawn: the mow itself.
 *
 * ## Why this and not more grass
 *
 * The lawn was the largest dead area left in the exterior — a broad field of
 * one green, with instanced blades near the house and nothing beyond them.
 * The obvious response is more blades, and it is the wrong one: blades stop
 * resolving past fifteen metres or so, and sowing them further only spends
 * the budget on noise nobody can see.
 *
 * What actually reads at that distance is the *mow*. A cylinder mower lays
 * the grass over in the direction it travelled, and grass lying away from
 * you reflects differently from grass lying toward you, so a mown lawn is
 * banded in broad alternating stripes. That banding is present in almost
 * every photograph of a maintained property, it is legible at any distance,
 * and it is the single clearest signal separating landscaping from a field.
 *
 * Kept deliberately quiet — a few percent, over bands several metres wide,
 * with the band edges softened and drifting so they never read as a
 * repeating pattern. The aim is that a viewer registers "this lawn is
 * looked after" without ever consciously seeing a stripe.
 */
// Self-contained: this block is injected ahead of the shared noise helpers
// (the ashlar and variation passes both anchor on the same include, and the
// last one to patch ends up first), so it cannot call them.
const MOWN_GLSL = `
uniform float uMowWidth;
uniform float uMowStrength;
uniform float uMowAngle;

float aureliaMowWander(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  vec4 h = vec4(
    dot(i + vec2(0.0, 0.0), vec2(127.1, 311.7)),
    dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7)),
    dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7)),
    dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))
  );
  h = fract(sin(h) * 43758.5453);
  return mix(mix(h.x, h.y, f.x), mix(h.z, h.w, f.x), f.y);
}

float aureliaMow(vec3 worldPos) {
  vec2 dir = vec2(cos(uMowAngle), sin(uMowAngle));
  float along = dot(worldPos.xz, dir);

  // The mower does not drive in a perfectly straight line, and the bands it
  // leaves wander by a few centimetres over their length. Warping the phase
  // with a very low-frequency noise sample is what stops the stripes
  // reading as a printed pattern.
  float wander = aureliaMowWander(worldPos.xz * 0.02) - 0.5;
  float phase = (along / uMowWidth) + wander * 0.35;

  // A soft square wave: flat across each band, eased at the edges, because
  // the boundary between two passes of a mower is a blend and not a line.
  float band = sin(phase * 3.14159265);
  return sign(band) * smoothstep(0.0, 0.55, abs(band));
}
`;

/**
 * Applies the mow above, on top of whatever the material already does.
 *
 * The band is folded into both the albedo and the roughness. Both matter:
 * grass lying away from the viewer is not merely darker, it is glossier,
 * and it is that difference in sheen — not the tone — that survives when
 * the sun comes round.
 */
function withMownBands<T extends MeshStandardMaterial>(
  material: T,
  options: { width: number; strength: number; angle: number },
): T {
  const existing = material.onBeforeCompile;

  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    existing?.(shader, undefined as never);

    shader.uniforms.uMowWidth = { value: options.width };
    shader.uniforms.uMowStrength = { value: options.strength };
    shader.uniforms.uMowAngle = { value: options.angle };

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${MOWN_GLSL}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
  float aureliaMowBand = aureliaMow(vAureliaWorldPos);
  diffuseColor.rgb *= 1.0 + aureliaMowBand * uMowStrength;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
  roughnessFactor = clamp(roughnessFactor - aureliaMowBand * 0.06, 0.05, 1.0);`,
      );
  };

  const previousKey = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => `${previousKey ? previousKey() : 'aurelia'}-mown`;

  return material;
}

/**
 * Ashlar: a facade built from stone slabs rather than painted one colour.
 *
 * ## What was actually wrong
 *
 * The elevations were a single continuous surface carrying fine-grained
 * noise. Every square metre of it was statistically identical to every
 * other, and that is not what stone looks like from any distance. A clad
 * facade is an assembly of *pieces*: each slab comes off a different part of
 * a block, so it sits a shade warmer or cooler or darker than its
 * neighbours, and between them runs a narrow recessed joint that catches a
 * line of shadow. Those two facts — piece-to-piece variation and the joint
 * grid — are the whole read. Without them, no amount of surface noise
 * stops a wall looking like tinted plaster, which is exactly what the
 * rendered frames showed.
 *
 * ## How it is built
 *
 * Slabs are laid out in world space, not in UV space. That matters: a
 * building is clad by a mason working to the world horizontal, so courses
 * run level across every wall and turn the corners in register. Deriving
 * the coordinates from the world position and the world normal gives that
 * for free, on geometry that carries no unwrap at all.
 *
 * The plane a slab lies in is chosen from the surface's dominant world
 * axis, which also decides its format: vertical faces get wall-format
 * ashlar laid in a running bond, and horizontal faces get square paving.
 * That is not a shortcut — it is how the two are actually laid, and it
 * means the same material clads a wall and paves the terrace correctly.
 *
 * The joint is a genuine recess as far as the shading is concerned: it
 * darkens, it roughens, and — the part that does the work — it tilts the
 * normal outward on each side, so the joint has two small chamfers that
 * light and shade separately as the sun moves. A drawn dark line cannot do
 * that, and a drawn dark line is what the brief rightly rules out.
 *
 * ## Where the scanned textures will go
 *
 * This is procedural and is not a substitute for a scanned slab. The
 * structure is deliberately the one a real map set slots into: when
 * `SurfaceMaps` gains real albedo/roughness/normal for limestone, they
 * attach through `withMaps` exactly as now and this pass keeps supplying
 * the thing a tiling texture cannot — joints in the right place on this
 * particular building, and variation that does not repeat with the map.
 */
type AshlarOptions = {
  /** Slab face dimensions on a vertical surface, in metres. */
  course: [number, number];
  /** Slab dimension on a horizontal surface, in metres. Paving is square. */
  paver: number;
  /** Joint width, in metres. Six to ten millimetres is architectural. */
  joint: number;
  /** How dark the joint runs, 0-1. */
  jointDepth: number;
  /** Peak normal tilt at the joint's chamfer. */
  jointRelief: number;
  /** Slab-to-slab tonal spread, as a fraction. */
  slabVariation: number;
  /** Slab-to-slab roughness spread. */
  slabRoughness: number;
  /** Distinct integer, so two ashlar materials never lay out identically. */
  seed: number;
};

const ASHLAR_GLSL = `
varying vec3 vAureliaWorldNormal;
uniform vec2 uAshlarCourse;
uniform float uAshlarPaver;
uniform float uAshlarJoint;
uniform float uAshlarDepth;
uniform float uAshlarRelief;
uniform float uAshlarTone;
uniform float uAshlarRough;
uniform float uAshlarSeed;

float aureliaSlabHash(vec2 cell, float salt) {
  float h = sin(dot(cell, vec2(127.1, 311.7)) + salt * 13.37 + uAshlarSeed) * 43758.5453;
  return fract(h);
}

// Everything a fragment needs to know about the slab it belongs to.
struct AureliaSlab {
  float joint;    // 1 inside the joint, 0 in the field
  float tone;     // per-slab tonal offset, centred on zero
  float rough;    // per-slab roughness offset, centred on zero
  vec2 chamfer;   // tilt direction in the slab's own plane
  vec3 planeU;    // world direction of the plane's first axis
  vec3 planeV;    // and its second
};

AureliaSlab aureliaAshlar(vec3 worldPos, vec3 worldNormal) {
  AureliaSlab slab;

  // Pick the plane from the dominant world axis, and with it the format:
  // a wall is laid in courses, a floor is paved in squares.
  vec3 a = abs(normalize(worldNormal));
  vec2 p;
  vec2 size;
  float jointWidth = uAshlarJoint;
  if (a.y >= a.x && a.y >= a.z) {
    p = worldPos.xz;
    size = vec2(uAshlarPaver);
    jointWidth = uAshlarJoint * 2.6;
    slab.planeU = vec3(1.0, 0.0, 0.0);
    slab.planeV = vec3(0.0, 0.0, 1.0);
  } else if (a.x >= a.z) {
    p = vec2(worldPos.z, worldPos.y);
    size = uAshlarCourse;
    slab.planeU = vec3(0.0, 0.0, 1.0);
    slab.planeV = vec3(0.0, 1.0, 0.0);
  } else {
    p = vec2(worldPos.x, worldPos.y);
    size = uAshlarCourse;
    slab.planeU = vec3(1.0, 0.0, 0.0);
    slab.planeV = vec3(0.0, 1.0, 0.0);
  }

  // Running bond: every other course steps half a slab, which is how stone
  // is actually laid and what stops the perpends lining up into columns.
  float row = floor(p.y / size.y);
  // Running bond on a wall, stack bond on the floor: large-format paving is
  // laid square, and staggering it reads as brick paving rather than stone.
  float bond = (a.y >= a.x && a.y >= a.z) ? 0.0 : 1.0;
  float stagger = mod(row, 2.0) * 0.5 * size.x * bond;
  float shifted = p.x + stagger;
  float col = floor(shifted / size.x);

  // A little length variation per course, so the wall is not a perfect grid.
  float lengthJitter = (aureliaSlabHash(vec2(col, row), 3.0) - 0.5) * 0.16;
  float fx = fract(shifted / size.x + lengthJitter * 0.0);
  float fy = fract(p.y / size.y);

  // Distance to the nearest joint, in metres, on each axis separately —
  // the nearer one decides which way the chamfer faces.
  float dx = min(fx, 1.0 - fx) * size.x;
  float dy = min(fy, 1.0 - fy) * size.y;

  float halfJoint = jointWidth * 0.5;
  float nearest = min(dx, dy);
  slab.joint = 1.0 - smoothstep(halfJoint * 0.35, halfJoint * 1.9, nearest);

  // How wide a pixel is on this surface, in the same metres.
  float footprint = max(fwidth(nearest), 1e-5);
  slab.joint *= 1.0 - smoothstep(jointWidth * 0.6, jointWidth * 2.4, footprint);

  vec2 cell = vec2(col, row);
  slab.tone = (aureliaSlabHash(cell, 1.0) - 0.5) * 2.0;
  slab.rough = (aureliaSlabHash(cell, 2.0) - 0.5) * 2.0;

  // Paving carries more piece-to-piece spread than cladding, and needs to:
  // a facade is read at a grazing angle where the joint line does the work,
  // while a terrace is read from above at a distance where the hairline
  // joint has already fallen below a pixel. Without a tonal difference
  // between slabs that survives that, a paved terrace renders as one poured
  // plane — which is exactly how the hero framing showed it.
  if (a.y >= a.x && a.y >= a.z) {
    slab.tone *= 2.4;
    slab.rough *= 1.6;
  }

  // The chamfer runs outward from the slab's centre, on whichever axis the
  // joint is nearer, and only within the joint itself.
  float ramp = slab.joint * (1.0 - smoothstep(0.0, halfJoint * 0.5, nearest - halfJoint * 0.5));
  float horizontal = step(dx, dy);
  slab.chamfer = vec2(
    (fx < 0.5 ? -1.0 : 1.0) * horizontal,
    (fy < 0.5 ? -1.0 : 1.0) * (1.0 - horizontal)
  ) * ramp;

  return slab;
}
`;

/**
 * Applies the ashlar pass on top of whatever the material already does.
 * Wraps rather than replaces `onBeforeCompile`, so the surface variation
 * and the map pipeline both survive underneath it.
 */
function withAshlar<T extends MeshStandardMaterial>(material: T, options: AshlarOptions): T {
  const existing = material.onBeforeCompile;

  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    existing?.(shader, undefined as never);

    shader.uniforms.uAshlarCourse = { value: options.course };
    shader.uniforms.uAshlarPaver = { value: options.paver };
    shader.uniforms.uAshlarJoint = { value: options.joint };
    shader.uniforms.uAshlarDepth = { value: options.jointDepth };
    shader.uniforms.uAshlarRelief = { value: options.jointRelief };
    shader.uniforms.uAshlarTone = { value: options.slabVariation };
    shader.uniforms.uAshlarRough = { value: options.slabRoughness };
    shader.uniforms.uAshlarSeed = { value: options.seed };

    if (!shader.vertexShader.includes('vAureliaWorldPos')) {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\nvarying vec3 vAureliaWorldPos;`)
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>\n  vAureliaWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
        );
    }

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vAureliaWorldNormal;`)
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>\n  vAureliaWorldNormal = mat3(modelMatrix) * objectNormal;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${ASHLAR_GLSL}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
  AureliaSlab aureliaSlab = aureliaAshlar(vAureliaWorldPos, vAureliaWorldNormal);
  // Piece-to-piece variation first, then the joint darkening over it.
  diffuseColor.rgb *= 1.0 + aureliaSlab.tone * uAshlarTone;
  diffuseColor.rgb *= 1.0 - aureliaSlab.joint * uAshlarDepth;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
  roughnessFactor = clamp(
    roughnessFactor + aureliaSlab.rough * uAshlarRough + aureliaSlab.joint * 0.09,
    0.05,
    1.0
  );`,
      )
      // After the shared variation has had its say, so the joint's chamfer
      // sits on top of the stone's own grain rather than being averaged
      // away by it.
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
  {
    vec3 tiltWorld =
      aureliaSlab.planeU * aureliaSlab.chamfer.x + aureliaSlab.planeV * aureliaSlab.chamfer.y;
    vec3 tiltView = mat3(viewMatrix) * tiltWorld;
    tiltView -= normal * dot(tiltView, normal);
    normal = normalize(normal + tiltView * uAshlarRelief);
  }`,
      );
  };

  const previousKey = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () =>
    `${previousKey ? previousKey() : 'aurelia'}-ashlar-${options.seed}`;

  return material;
}

/**
 * Fresnel on the transparency of architectural glazing.
 *
 * ## The problem this fixes
 *
 * Glass was drawn with a flat 55 percent opacity, and a flat opacity is
 * wrong in a way that is immediately legible. A real pane seen square-on is
 * mostly transmissive — you look through it into the room — and the *same*
 * pane seen at a glancing angle is very nearly a mirror. Every photograph
 * of a glazed villa relies on that: the panes facing the camera show the
 * interior, the panes raking away show the sky and the landscape, and the
 * facade reads as glass precisely because the two behave differently.
 *
 * With one constant opacity every pane behaved identically, so the facade
 * read as a grid of identical grey panels — which is exactly what the
 * rendered frames showed.
 *
 * Schlick's approximation gives the reflectance directly from the angle
 * between the view ray and the surface normal, both of which the shader
 * already has, so this costs a dot product and a power.
 *
 * ## The intensity compensation
 *
 * Alpha blending multiplies the *whole* fragment by its alpha, reflection
 * included, while a real reflection adds to whatever is behind the glass
 * rather than replacing part of it. A 55-percent-opaque pane therefore
 * loses 45 percent of its reflection, which is why the sky never showed in
 * the glazing however bright the environment was. Dividing the environment
 * contribution by the alpha it is about to be multiplied by restores it.
 * This is a compensation for the blend model, not a physical parameter —
 * hence the clamp, which stops a nearly-transparent pane from producing an
 * unbounded highlight.
 */
function withGlassFresnel<T extends MeshPhysicalMaterial>(material: T): T {
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vAureliaGlassPos;`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\n  vAureliaGlassPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vAureliaGlassPos;

// Pane-to-pane variation.
//
// A curtain wall is not one sheet of glass. It is dozens of panes, each
// from a different part of a different batch, each with slightly different
// coating thickness and a different room behind it — so a real facade has
// visible tonal drift from pane to pane, and that drift is most of what
// stops a glazed elevation reading as a printed grid. Rendered as one
// uniform material the whole wall resolved to the same dark rectangle
// repeated, which is exactly how the frames read it.
//
// The cell is derived in world space from the surface's dominant axis, at
// roughly the mullion spacing the facade is actually set out on.
float aureliaPaneShade(vec3 worldPos, vec3 viewNormal) {
  vec3 n = abs(mat3(inverse(viewMatrix)) * viewNormal);
  vec2 p;
  if (n.y >= n.x && n.y >= n.z) p = worldPos.xz;
  else if (n.x >= n.z) p = vec2(worldPos.z, worldPos.y);
  else p = vec2(worldPos.x, worldPos.y);

  vec2 cell = floor(p / vec2(1.45, 2.6));
  float h = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
  return (h - 0.5) * 2.0;
}`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
  float aureliaFacing = clamp(abs(dot(normalize(vViewPosition), normal)), 0.0, 1.0);
  float aureliaPane = aureliaPaneShade(vAureliaGlassPos, normal);
  // Schlick, with the base reflectance folded into the ramp: a pane goes
  // from the hour's opacity face-on to effectively solid at the grazing
  // angles that rake along a facade.
  float aureliaFresnel = pow(1.0 - aureliaFacing, 5.0);
  float aureliaAlpha = mix(diffuseColor.a, 1.0, aureliaFresnel);
  diffuseColor.a = aureliaAlpha;`,
      )
      .replace(
        '#include <lights_physical_fragment>',
        `#include <lights_physical_fragment>
  material.specularColor *= clamp(1.0 / max(aureliaAlpha, 0.25), 1.0, 4.0);
  // Each pane reflects a little more or a little less than its neighbour,
  // and sits a little warmer or cooler. Small numbers on purpose: the aim
  // is that no two panes match, not that any one of them stands out.
  material.specularColor *= 1.0 + aureliaPane * 0.16;
  material.diffuseColor *= 1.0 + aureliaPane * 0.09;
  material.roughness = clamp(material.roughness + aureliaPane * 0.012, 0.01, 1.0);`,
      );
  };

  material.customProgramCacheKey = () => 'aurelia-glass-fresnel';
  return material;
}

/**
 * The surface of the pool.
 *
 * Water was the flattest thing in the whole image: a single navy quad with
 * a constant opacity, no ripple and no horizon in it. Three things are
 * wrong with that and all three are fixed here.
 *
 * **It had no slope.** Still water is not flat — it carries a slow swell a
 * few millimetres high and metres across, and that swell is the only reason
 * a pool reflects a *broken* image of the sky rather than a mirror image.
 * The waves below are deliberately long and shallow; anything faster reads
 * as a lake in wind rather than a heated pool.
 *
 * **It faded its own detail out.** The shared variation pass drops its
 * relief between nine and thirty-four metres, which is right for a plaster
 * wall whose grain genuinely stops resolving, and wrong for water, which is
 * usually *first* seen from across a terrace. The ripple here does not fade.
 *
 * **It was equally transparent everywhere.** Water follows the same Fresnel
 * law as glass, and far more visibly: you see the basin floor at your feet
 * and the sky at the far end. That gradient across the surface is most of
 * what makes water read as water.
 */
function withWaterSurface<T extends MeshPhysicalMaterial>(material: T): T {
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vAureliaWaterPos;`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\n  vAureliaWaterPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vAureliaWaterPos;

// Four long crossing swells. Their analytic slope is the sum of the same
// four cosines, so the normal falls out without differencing anything.
vec3 aureliaWaterNormal(vec2 p) {
  vec2 d1 = vec2(0.92, 0.39);
  vec2 d2 = vec2(-0.42, 0.91);
  vec2 d3 = vec2(0.71, -0.70);
  vec2 d4 = vec2(0.15, 0.99);
  float s = 0.0;
  vec2 g = vec2(0.0);
  g += d1 * (0.055 * cos(dot(p, d1) * 1.7 + 0.3));
  g += d2 * (0.038 * cos(dot(p, d2) * 2.9 + 1.9));
  g += d3 * (0.024 * cos(dot(p, d3) * 5.3 + 3.4));
  g += d4 * (0.016 * cos(dot(p, d4) * 9.1 + 5.1));
  s = 1.0;
  return normalize(vec3(-g.x, s, -g.y));
}`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
  {
    vec3 rippleWorld = aureliaWaterNormal(vAureliaWaterPos.xz);
    vec3 rippleView = normalize(mat3(viewMatrix) * rippleWorld);
    // The basin is horizontal, so the swell is applied about the world up
    // rather than blended into an arbitrary normal.
    normal = normalize(mix(normal, rippleView, 0.85));
  }
  float aureliaFacing = clamp(abs(dot(normalize(vViewPosition), normal)), 0.0, 1.0);
  float aureliaFresnel = pow(1.0 - aureliaFacing, 4.0);
  float aureliaAlpha = mix(0.62, 1.0, aureliaFresnel);
  diffuseColor.a = min(diffuseColor.a, aureliaAlpha);`,
      )
      .replace(
        '#include <lights_physical_fragment>',
        `#include <lights_physical_fragment>
  material.specularColor *= clamp(1.0 / max(aureliaAlpha, 0.3), 1.0, 3.2);`,
      );
  };

  material.customProgramCacheKey = () => 'aurelia-water-surface';
  return material;
}

/**
 * Attaches a family's albedo, roughness and normal maps to a material.
 *
 * Deliberately additive. The material keeps its own colour, its own base
 * roughness and the Phase 7B procedural variation; the maps supply the
 * per-texel detail underneath all of it. `normalScale` is taken from the
 * family rather than left at 1, because the single most common way to make
 * architectural CG look wrong is a normal map at full strength — the brief
 * asks for material depth, not for the viewer to notice a map.
 *
 * Not every material gets this. Glass, water, metal, emissive faces and the
 * landscape are all better served by the environment and by roughness
 * alone, and texturing them would add cost for no gain.
 */
function withMaps<T extends MeshStandardMaterial>(
  material: T,
  family: SurfaceFamily,
  strength = 1,
): T {
  if (!surfaceMapsEnabled) return material;

  const maps = getSurfaceMaps(family);
  material.map = maps.map;
  material.roughnessMap = maps.roughnessMap;
  material.normalMap = maps.normalMap;
  material.normalScale.set(maps.normalScale * strength, maps.normalScale * strength);
  material.needsUpdate = true;
  return material;
}

/**
 * Whether materials carry sampled maps at all.
 *
 * Off on the low tier, for a reason that is about correctness before cost:
 * the maps tile against the metre-scale UVs `ChamferedBox` emits, and the
 * low tier renders plain unit cubes whose UVs run 0–1 across a face of any
 * size. A twelve-metre wall would get exactly one tile stretched across it.
 * The twenty-odd megabytes of texture saved on the hardware least able to
 * afford them is the secondary benefit.
 */
let surfaceMapsEnabled = true;

/**
 * Turns sampled maps on or off. Rebuilds the material cache when the answer
 * changes, since the maps are baked into the materials themselves.
 */
export function setSurfaceMapsEnabled(enabled: boolean): void {
  if (enabled === surfaceMapsEnabled) return;
  surfaceMapsEnabled = enabled;
  disposeMaterials();
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
    concrete: withAshlar(
      withMaps(
        withVariation(
          standard({ color: '#c7bfae', roughness: 0.62, metalness: 0.01, envMapIntensity: 0.62 }),
          {
            // Wide, soft mottling at roughly the scale a block of limestone
            // varies over — this is the bedding, and the ashlar pass on top
            // supplies the pieces it is cut into.
            scale: 0.42,
            colorVariation: 0.07,
            roughnessVariation: 0.1,
            seed: 11,
            // Slightly stretched along the bedding plane, as quarried stone
            // is, rather than isotropic like aggregate.
            anisotropy: [1, 0.55, 1],
            normalStrength: 0.011,
            normalScale: 2.4,
          },
        ),
        'stone',
        0.9,
      ),
      {
        // Large-format cladding: a metre and a half by three-quarters is
        // the size these elevations are actually detailed at, and it keeps
        // the joint grid reading as architecture rather than as tiling.
        course: [2.4, 1.2],
        paver: 1.2,
        joint: 0.007,
        jointDepth: 0.13,
        jointRelief: 0.28,
        slabVariation: 0.019,
        slabRoughness: 0.05,
        seed: 3,
      },
    ),
    /**
     * Honed limestone / travertine — warm off-white, restrained natural
     * irregularity. Coarser noise cells than concrete so it reads as large
     * quarried slabs, not aggregate.
     */
    stone: withAshlar(
      withMaps(
        withVariation(
          standard({ color: '#cbc3b1', roughness: 0.66, metalness: 0, envMapIntensity: 0.68 }),
          {
            scale: 0.45,
            colorVariation: 0.06,
            roughnessVariation: 0.12,
            seed: 23,
            anisotropy: [1, 0.6, 1],
            // The open grain and shallow pitting of honed limestone.
            normalStrength: 0.0112,
            normalScale: 2.1,
          },
        ),
        'stone',
        1.0,
      ),
      {
        // Heavier pieces than the cladding — a plinth, a coping and a
        // retaining wall are all built from thicker stone than a facade
        // panel, and the coursing shows it.
        course: [1.8, 0.85],
        paver: 1.0,
        joint: 0.008,
        jointDepth: 0.15,
        jointRelief: 0.3,
        slabVariation: 0.022,
        slabRoughness: 0.055,
        seed: 7,
      },
    ),
    /**
     * The surrounding ground. Previously a near-black plane, which is what
     * made the residence look like it was floating in a void; it is now
     * mown lawn, with enough tonal variation across it to read as a
     * landscaped property rather than a fill colour.
     */
    terrain: withAerialPerspective(
      withMownBands(
        withVariation(
          standard({ color: '#7c8354', roughness: 0.96, metalness: 0, envMapIntensity: 0.7 }),
          {
            scale: 0.045,
            colorVariation: 0.42,
            roughnessVariation: 0.12,
            seed: 131,
            normalStrength: 0.1,
            normalScale: 0.35,
          },
        ),
        { width: 3.6, strength: 0.055, angle: 0.42 },
      ),
      // A clear evening has crisp visibility for kilometres, so haze must
      // not touch the estate itself: the first attempt began at seventy
      // metres and washed the whole property grey, which traded one wrong
      // image for another. Nothing within a hundred and forty metres is
      // affected at all — the site, the drive and the tree line all read
      // sharp — and by four hundred the ground is entirely air, comfortably
      // inside the plane's own edge.
      140,
      400,
    ),
    /**
     * The arrival paving: a warm grey sawn stone, laid in large modules.
     *
     * Distinct from `stone`, which is the building's honed cladding. A
     * drive is a harder, coarser, slightly darker material than the
     * elevations it leads to — a court paved in the same stone as the
     * facade reads as a plinth extending outward rather than as ground the
     * building sits on.
     */
    paving: withMaps(
      withVariation(
        standard({ color: '#8f887c', roughness: 0.82, metalness: 0, envMapIntensity: 0.5 }),
        {
          scale: 0.42,
          colorVariation: 0.07,
          roughnessVariation: 0.12,
          seed: 137,
          normalStrength: 0.0105,
          normalScale: 2.6,
        },
      ),
      'paving',
      1.0,
    ),
    /**
     * Outdoor teak — the warm, silvered timber of terrace furniture, and
     * deliberately much lighter than the interior `wood`, which is a dark
     * stained joinery oak. Grain runs along the length via the same
     * anisotropy the interior timbers use.
     */
    teak: withMaps(
      withVariation(
        standard({ color: '#8a6a45', roughness: 0.68, metalness: 0.02, envMapIntensity: 0.45 }),
        {
          scale: 1.6,
          colorVariation: 0.07,
          roughnessVariation: 0.07,
          seed: 139,
          anisotropy: [1, 0.16, 1],
          normalStrength: 0.04,
          normalScale: 5.0,
        },
      ),
      'oak',
      0.85,
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
      // Brushed bronze: barely there, but enough to break the highlight.
      normalStrength: 0.015,
      normalScale: 2.0,
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
      // Fine mill finish on dark metal.
      normalStrength: 0.018,
      normalScale: 2.0,
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
      // Anodised extrusion — a faint directional drag.
      normalStrength: 0.02,
      normalScale: 2.0,
    }),
    /**
     * Dark luxury timber, used only for the entrance leaf. Anisotropic
     * noise compressed along the vertical axis so it reads as grain running
     * the height of the door rather than a blotchy stain.
     */
    wood: withMaps(
      withVariation(standard({ color: '#4a382a', roughness: 0.74, metalness: 0.02 }), {
        scale: 5,
        colorVariation: 0.05,
        roughnessVariation: 0.06,
        seed: 7,
        // Open-pore timber: the grain the anisotropy already stretches.
        normalStrength: 0.0123,
        normalScale: 4.5,
        anisotropy: [1, 0.1, 1],
      }),
      'oak',
      1.0,
    ),
    /**
     * Architectural glazing. A tinted dielectric with a real Fresnel term
     * rather than transmission: it reads as deep reflective glass without
     * the render-target cost transmission adds on mobile GPUs. Double-sided
     * so interiors are not hollow from behind. Kept free of the procedural
     * noise pass — glass should read flawless and machined, not organic.
     */
    glazing: withGlassFresnel(
      new MeshPhysicalMaterial({
        color: '#1b2b36',
        roughness: 0.035,
        metalness: 0.05,
        reflectivity: 1,
        // The environment map is doing the work here: the sky reflected off
        // the glazing at a grazing angle is what makes a facade read as glass
        // instead of as a dark panel. It only became true once the
        // environment gained a ground below its horizon — until then the
        // lower half of every reflection was one flat colour, and no amount
        // of intensity could turn that into an image.
        envMapIntensity: 3.2,
        transparent: true,
        opacity: 0.58,
        side: DoubleSide,
      }),
    ),
    /**
     * Glazing applied to the face of a solid volume. Opaque, because there is
     * no void behind it to see into — transparency would read as tinted film
     * over the wall rather than as a window.
     */
    glazingSurface: new MeshPhysicalMaterial({
      color: '#16242e',
      roughness: 0.05,
      metalness: 0.05,
      reflectivity: 1,
      envMapIntensity: 2.8,
    }),
    /**
     * Pool water — see `withWaterSurface` for the swell, the Fresnel ramp
     * and why the shared variation pass was the wrong tool for it. Still no
     * reflection render target and no simulation, per the Phase 2C
     * constraint: the environment supplies the reflected image and the
     * analytic swell supplies the slope that breaks it up.
     */
    poolWater: withWaterSurface(
      new MeshPhysicalMaterial({
        color: '#1d5a67',
        // Water is very nearly a mirror, and with a sky to reflect it can
        // finally behave like one — the reflected dome is what gives the
        // pool its colour, not the albedo underneath.
        roughness: 0.03,
        envMapIntensity: 2.2,
        // After dark the submerged lighting is carried by the water body
        // itself rather than by the basin walls, so the pool reads as a
        // soft luminous plane instead of a glowing outline.
        emissive: '#22403f',
        emissiveIntensity: 0,
        metalness: 0.02,
        reflectivity: 1,
        transparent: true,
        opacity: 0.96,
      }),
    ),
    /**
     * The pool interior — basin, steps, and the infinity channel.
     *
     * Pale, not dark, and this is the single decision that decides whether
     * the pool reads as water or as a hole. Water is very slightly
     * absorbing and almost entirely clear; a swimming pool gets its colour
     * from the light that goes *through* it, bounces off the basin, and
     * comes back out. Line the basin in near-black and there is nothing to
     * come back — the surface has only its own reflection to show, and
     * every angle that is not reflecting the sky renders as a black
     * rectangle, which is exactly what the frames showed.
     *
     * A pale honed plaster returns that light, and the water above it goes
     * to the blue-green a pool is actually photographed as. Still carries
     * the emissive term that stays at zero through the day and comes up
     * after dark, which is how the submerged perimeter lighting reads
     * without a single dynamic light inside the water.
     */
    poolInterior: withVariation(
      standard({
        color: '#63807e',
        roughness: 0.62,
        metalness: 0,
        emissive: '#9fc4c6',
        emissiveIntensity: 0,
      }),
      {
        scale: 1.6,
        colorVariation: 0.03,
        roughnessVariation: 0.05,
        seed: 29,
        // Trowelled pool plaster.
        normalStrength: 0.025,
        normalScale: 2.6,
      },
    ),
    /** Tree trunks and major branches — vertical grain, like the entrance wood. */
    bark: withVariation(standard({ color: '#453a2f', roughness: 0.9, metalness: 0 }), {
      scale: 2.4,
      colorVariation: 0.06,
      roughnessVariation: 0.05,
      seed: 41,
      // Bark is deeply fissured — the one place a strong perturbation is right.
      normalStrength: 0.15,
      normalScale: 2.5,
      anisotropy: [1, 0.18, 1],
    }),
    /** Sunlit foliage — canopy, shrubs, hedges. Muted sage, not garden green. */
    foliageMid: withVariation(standard({ color: '#5c6a4c', roughness: 0.86, metalness: 0 }), {
      scale: 0.9,
      colorVariation: 0.06,
      roughnessVariation: 0.05,
      seed: 53,
      // Leaf-mass relief across a canopy cluster.
      normalStrength: 0.09,
      normalScale: 1.6,
    }),
    /** Shadowed foliage, layered under `foliageMid` for depth without a texture. */
    foliageDark: withVariation(standard({ color: '#3a4433', roughness: 0.9, metalness: 0 }), {
      scale: 0.9,
      colorVariation: 0.06,
      roughnessVariation: 0.05,
      seed: 59,
      // As the mid foliage.
      normalStrength: 0.09,
      normalScale: 1.6,
    }),
    /** Ornamental grass — warmer and drier than the foliage greens. */
    grass: withVariation(standard({ color: '#6b7347', roughness: 0.86, metalness: 0 }), {
      scale: 1.3,
      colorVariation: 0.05,
      roughnessVariation: 0.04,
      seed: 67,
      // Blade clumping in ornamental grass.
      normalStrength: 0.05,
      normalScale: 1.8,
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
      color: '#77854a',
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
      // Clod and crumb structure in bare soil.
      normalStrength: 0.13,
      normalScale: 1.6,
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
    plaster: withMaps(
      withVariation(standard({ color: '#cec7ba', roughness: 0.9, metalness: 0 }), {
        scale: 0.35,
        colorVariation: 0.022,
        roughnessVariation: 0.04,
        seed: 83,
        // Polished plaster: a trowelled wall is flat, not perfect.
        normalStrength: 0.0031,
        normalScale: 2.6,
      }),
      'plaster',
      1.0,
    ),
    /**
     * Honed pale limestone flooring for the principal rooms. Larger, softer
     * cells than the exterior `stone` so it reads as big-format interior
     * slabs, and lower roughness for the sheen of a honed finish.
     */
    interiorStone: withMaps(
      withVariation(standard({ color: '#b8b0a0', roughness: 0.52, metalness: 0.02 }), {
        scale: 0.4,
        colorVariation: 0.04,
        roughnessVariation: 0.07,
        seed: 89,
        // Honed stone floor — the same grain as the exterior, finer.
        normalStrength: 0.0077,
        normalScale: 2.8,
      }),
      'stone',
      0.8,
    ),
    /**
     * Interior joinery timber — cabinetry, built-ins, bedroom flooring.
     * Warmer and lighter than the entrance `wood`, with the same vertically
     * compressed anisotropy that reads as directional grain.
     */
    joinery: withMaps(
      withVariation(standard({ color: '#6b503a', roughness: 0.46, metalness: 0.04 }), {
        scale: 4.5,
        colorVariation: 0.055,
        roughnessVariation: 0.06,
        seed: 97,
        // Sawn timber joinery.
        normalStrength: 0.0105,
        normalScale: 4.0,
        anisotropy: [1, 0.12, 1],
      }),
      'oak',
      0.9,
    ),
    /**
     * Book-matched marble for island tops, vanities, and the fireplace
     * surround. Strongly anisotropic noise stretched along X is what draws
     * veining across a slab without a texture map.
     */
    marble: withMaps(
      withVariation(standard({ color: '#e2ded5', roughness: 0.22, metalness: 0.03 }), {
        scale: 1.6,
        colorVariation: 0.09,
        roughnessVariation: 0.05,
        seed: 101,
        // Polished marble is almost perfectly flat; only the veining lifts.
        normalStrength: 0.0035,
        normalScale: 2.0,
        anisotropy: [0.25, 1.6, 1],
      }),
      'marble',
      1.0,
    ),
    /** Principal upholstery — sofas, beds, headboards. Warm greige linen. */
    upholstery: withMaps(
      withVariation(standard({ color: '#9a917f', roughness: 0.95, metalness: 0 }), {
        scale: 6,
        colorVariation: 0.05,
        roughnessVariation: 0.04,
        seed: 103,
        // Woven upholstery microstructure. The relief itself is now the
        // map's job; this is only the slow drift across a large cushion
        // that keeps one from reading as a single flat tone.
        normalStrength: 0.009,
        normalScale: 8.5,
      }),
      'linen',
      0.9,
    ),
    /** Accent upholstery — occasional chairs, stools, bed throws. */
    upholsteryDark: withMaps(
      withVariation(standard({ color: '#4a463f', roughness: 0.96, metalness: 0 }), {
        scale: 6,
        colorVariation: 0.06,
        roughnessVariation: 0.04,
        seed: 107,
        // As the pale upholstery.
        normalStrength: 0.0158,
        normalScale: 8.5,
      }),
      'leather',
      1.0,
    ),
    /** Deep-pile wool rugs. Coarse noise reads as pile at close range. */
    rug: withMaps(
      withVariation(standard({ color: '#9c9081', roughness: 1, metalness: 0 }), {
        scale: 9,
        colorVariation: 0.08,
        roughnessVariation: 0.03,
        seed: 109,
        // Wool pile — the deepest of the interior fabrics.
        normalStrength: 0.021,
        normalScale: 9.0,
      }),
      'wool',
      1.0,
    ),
    /** Sanitaryware and tableware — glazed white ceramic. */
    ceramic: standard({ color: '#eef0ee', roughness: 0.12, metalness: 0.02 }),
    /**
     * Lit fixture surfaces — pendants, cove strips, integrated joinery
     * lighting. Emissive only: it costs nothing beyond a normal material and
     * carries no bloom or post-processing, which stays out of Phase 2F.
     */
    /**
     * Heavy curtain fabric — a warm oatmeal linen, matte and light-absorbing.
     * Distinct from `upholstery`: a curtain hangs against a bright window and
     * has to hold its own value against it, where a seat cushion is read
     * against a floor.
     */
    drapery: withMaps(
      withVariation(
        // Double-sided, because a curtain is a single hanging sheet: the
        // fold geometry has no back, and from inside the room half of every
        // pleat faces away from the camera.
        standard({
          color: '#a89b87',
          roughness: 0.97,
          metalness: 0,
          envMapIntensity: 0.35,
          side: DoubleSide,
        }),
        {
          scale: 1.1,
          colorVariation: 0.05,
          roughnessVariation: 0.04,
          seed: 149,
          anisotropy: [1, 0.2, 1],
          normalStrength: 0.05,
          normalScale: 6.0,
        },
      ),
      'linen',
      1.0,
    ),
    /**
     * The sheer layer. Transparent rather than alpha-cut, because a voile is
     * genuinely translucent — it should tint and soften the daylight behind
     * it, not punch holes in it.
     */
    sheer: new MeshPhysicalMaterial({
      color: '#e8e2d6',
      roughness: 0.95,
      metalness: 0,
      transparent: true,
      // Low: a voile is barely there, and at 0.3 it muted the view through
      // the glazing it is meant to soften rather than hide.
      opacity: 0.16,
      side: DoubleSide,
      envMapIntensity: 0.5,
    }),
    /** Book blocks and canvas edges. */
    paper: withVariation(standard({ color: '#cfc6b6', roughness: 0.88, metalness: 0 }), {
      scale: 2.6,
      colorVariation: 0.14,
      roughnessVariation: 0.05,
      seed: 151,
    }),
    /** Indoor planting — deeper and glossier than the sun-bleached exterior. */
    indoorFoliage: withVariation(
      standard({ color: '#43563a', roughness: 0.72, metalness: 0, envMapIntensity: 0.6 }),
      {
        scale: 1.4,
        colorVariation: 0.1,
        roughnessVariation: 0.08,
        seed: 157,
        normalStrength: 0.09,
        normalScale: 4.5,
      },
    ),
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
