'use client';

import { useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import {
  BackSide,
  Color,
  CubeCamera,
  HalfFloatType,
  MathUtils,
  Mesh,
  PMREMGenerator,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  WebGLCubeRenderTarget,
  type IUniform,
} from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import type { ResolvedLighting } from '@/lib/three/lighting';
import { setSkyCube } from '@/lib/three/materials';

/**
 * The dome is drawn far outside the far plane of nothing else in the scene;
 * it writes no depth, so its size only has to exceed the camera's reach.
 */
const SKY_SCALE = 12_000;

/**
 * The uniforms the daylight shader exposes. `Sky`'s own type declares only
 * a generic `ShaderMaterial`, so this names the contract rather than
 * reaching through an index signature at every call site.
 */
type SkyUniforms = {
  turbidity: IUniform<number>;
  rayleigh: IUniform<number>;
  mieCoefficient: IUniform<number>;
  mieDirectionalG: IUniform<number>;
  sunPosition: IUniform<Vector3>;
};

/**
 * The lower half of the environment: the ground the residence stands on.
 *
 * ## Why an environment needs a floor
 *
 * A sky dome on its own describes only the upper hemisphere. Baked into an
 * environment map it leaves the lower half filled with whatever the daylight
 * model returns below the horizon, which is a near-uniform dim wash — so
 * every reflective surface in the scene reflects *the same flat colour* from
 * every downward direction. That is precisely what a window, a pool and a
 * bronze mullion were doing: resolving to dead grey panels.
 *
 * Real reflective architecture does the opposite. Stand in front of a glazed
 * facade at golden hour and the pane is split: bright warm sky across the
 * top, dark landscape across the bottom, and a horizon running through it.
 * That split *is* the read. It is not a lighting effect that can be added
 * afterwards — it is information the environment either contains or does not.
 *
 * So the probe gets a floor. A hemisphere in the ground's own colour, hazing
 * toward the horizon and dissolving into the sky at it, so the reflection
 * carries a horizon without carrying a hard line. It costs one more mesh in
 * a bake that already happens once per hour.
 */
function createProbeGround(groundColor: string, horizonColor: string): Mesh {
  const geometry = new SphereGeometry(
    SKY_SCALE * 0.92,
    32,
    16,
    0,
    Math.PI * 2,
    Math.PI / 2,
    Math.PI / 2,
  );
  const material = new ShaderMaterial({
    side: BackSide,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uGround: { value: new Color(groundColor) },
      uHorizon: { value: new Color(horizonColor) },
    },
    vertexShader: [
      'varying float vDown;',
      'void main() {',
      // How far below the horizon this direction points, 0 at the horizon
      // and 1 at the nadir. Normalising the object-space position is enough:
      // the hemisphere is centred on the probe.
      '  vDown = clamp(-normalize(position).y, 0.0, 1.0);',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
      '}',
    ].join('\n'),
    fragmentShader: [
      'uniform vec3 uGround;',
      'uniform vec3 uHorizon;',
      'varying float vDown;',
      'void main() {',
      // Haze thickens toward the horizon, exactly as it does looking across
      // real ground, so the floor never meets the sky as a seam.
      '  float haze = 1.0 - smoothstep(0.0, 0.34, vDown);',
      '  vec3 color = mix(uGround, uHorizon, haze);',
      // Dissolve through the last few degrees so the sky takes over.
      '  float alpha = smoothstep(0.0, 0.06, vDown);',
      '  gl_FragColor = vec4(color, alpha);',
      '}',
    ].join('\n'),
  });
  const mesh = new Mesh(geometry, material);
  mesh.renderOrder = 1;
  return mesh;
}

/** Places the sky's sun from an elevation and an azimuth, in degrees. */
function sunDirection(elevation: number, azimuth: number): Vector3 {
  // Spherical coords in three's convention: phi from +Y, theta from +Z.
  const phi = MathUtils.degToRad(90 - elevation);
  const theta = MathUtils.degToRad(azimuth);
  return new Vector3().setFromSphericalCoords(1, phi, theta);
}

/**
 * The scene's sky and its environment map, both generated from an analytic
 * daylight model rather than fetched.
 *
 * This is the piece the project was missing. Without an environment there
 * is nothing for glass or metal to reflect, so every reflective surface
 * resolves to a flat fill and the whole image reads as untextured shapes —
 * which is why the metals in `materials.ts` had previously been dialled
 * back below their real values to compensate.
 *
 * The dome is rendered once into a pre-filtered cube map through
 * `PMREMGenerator`, so image-based lighting costs one bake per change of
 * hour rather than anything per frame, and no asset is downloaded to get
 * it. Because it is generated, the sky follows the time of day instead of
 * being fixed to whenever a photograph happened to be taken.
 */
export function ProceduralSky({ lighting }: { lighting: ResolvedLighting }) {
  const scene = useThree((state) => state.scene);
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);

  const sky = useMemo(() => {
    const dome = new Sky();
    dome.scale.setScalar(SKY_SCALE);
    dome.name = 'ProceduralSky';
    return dome;
  }, []);

  const { skyModel, sun, sky: hemisphere, atmosphere } = lighting;

  useEffect(() => {
    const direction = sunDirection(skyModel.elevation, sun.azimuth);

    const apply = (target: Sky) => {
      const uniforms = target.material.uniforms as unknown as SkyUniforms;
      uniforms.turbidity.value = skyModel.turbidity;
      uniforms.rayleigh.value = skyModel.rayleigh;
      uniforms.mieCoefficient.value = skyModel.mieCoefficient;
      uniforms.mieDirectionalG.value = skyModel.mieDirectionalG;
      uniforms.sunPosition.value.copy(direction);
    };

    apply(sky);

    // Bake the same dome into a pre-filtered environment map. A dedicated
    // scene is used so the building never ends up reflected in itself.
    const generator = new PMREMGenerator(gl);
    const source = new Scene();
    const probe = new Sky();
    probe.scale.setScalar(SKY_SCALE);
    apply(probe);
    source.add(probe);

    // ── The cube copy: sky only ─────────────────────────────────────────
    //
    // Baked first, before the ground below is added, and deliberately so.
    // Its two consumers both want the sky *without* a stand-in floor: the
    // path tracer traces the site's real ground and would otherwise have a
    // second, fake one wrapped around it, and aerial perspective asks
    // "what colour is the sky behind this piece of terrain", which a brown
    // hemisphere answers wrongly and confidently.
    //
    // Cheap — one render of one mesh, at the same moment the PMREM bake
    // already happens — and it means the traced image is lit by the same
    // sky as the rasterized one rather than by an approximation of it.
    const cubeTarget = new WebGLCubeRenderTarget(256, { type: HalfFloatType });
    const cubeCamera = new CubeCamera(0.1, SKY_SCALE * 2, cubeTarget);
    cubeCamera.update(gl, source);
    scene.userData.aureliaSkyCube = cubeTarget.texture;
    setSkyCube(cubeTarget.texture);

    // ── The environment map: sky over ground ────────────────────────────
    //
    // `groundColor` is already the hour's answer to "what colour is the
    // light coming back off the ground", which is the same question a
    // reflection asks, so the hemisphere light and the environment stay
    // consistent by construction. The horizon takes the hour's fog colour
    // for the same reason: that is the haze the site is seen through.
    const ground = createProbeGround(hemisphere.groundColor, atmosphere.fogColor);
    source.add(ground);

    const target = generator.fromScene(source);
    scene.environment = target.texture;
    scene.environmentIntensity = skyModel.environmentIntensity;

    generator.dispose();
    probe.geometry.dispose();
    probe.material.dispose();
    ground.geometry.dispose();
    (ground.material as ShaderMaterial).dispose();
    invalidate();

    return () => {
      scene.environment = null;
      delete scene.userData.aureliaSkyCube;
      setSkyCube(null);
      cubeTarget.dispose();
      target.dispose();
    };
  }, [
    sky,
    gl,
    scene,
    invalidate,
    skyModel,
    sun.azimuth,
    hemisphere.groundColor,
    atmosphere.fogColor,
    atmosphere.exposure,
  ]);

  useEffect(() => {
    return () => {
      sky.geometry.dispose();
      sky.material.dispose();
    };
  }, [sky]);

  return <primitive object={sky} />;
}

export default ProceduralSky;
