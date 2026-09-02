'use client';

import { useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import {
  CubeCamera,
  HalfFloatType,
  MathUtils,
  PMREMGenerator,
  Scene,
  Vector3,
  WebGLCubeRenderTarget,
  type IUniform,
} from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import type { ResolvedLighting } from '@/lib/three/lighting';

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

  const { skyModel, sun, atmosphere } = lighting;

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

    const target = generator.fromScene(source);
    scene.environment = target.texture;
    scene.environmentIntensity = skyModel.environmentIntensity;

    // A second copy of the same sky, as a cube texture.
    //
    // The path tracer cannot use the PMREM output: that is a 2D texture in
    // a pre-filtered layout with no readable pixels, and the tracer needs
    // to build an importance-sampling distribution over the environment
    // before it can aim a single ray at the sun. It does accept a cube
    // texture, so the identical dome is rendered once into one and parked
    // on the scene for the tracer to swap in. Cheap — one render of one
    // mesh, at the same moment the PMREM bake already happens — and it
    // means the traced image is lit by the same sky as the rasterized one
    // rather than by an approximation of it.
    const cubeTarget = new WebGLCubeRenderTarget(256, { type: HalfFloatType });
    const cubeCamera = new CubeCamera(0.1, SKY_SCALE * 2, cubeTarget);
    cubeCamera.update(gl, source);
    scene.userData.aureliaSkyCube = cubeTarget.texture;

    generator.dispose();
    probe.geometry.dispose();
    probe.material.dispose();
    invalidate();

    return () => {
      scene.environment = null;
      delete scene.userData.aureliaSkyCube;
      cubeTarget.dispose();
      target.dispose();
    };
  }, [sky, gl, scene, invalidate, skyModel, sun.azimuth, atmosphere.exposure]);

  useEffect(() => {
    return () => {
      sky.geometry.dispose();
      sky.material.dispose();
    };
  }, [sky]);

  return <primitive object={sky} />;
}

export default ProceduralSky;
