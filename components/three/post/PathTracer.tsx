'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { HalfFloatType, LinearFilter, WebGLRenderTarget, type IUniform, type Texture } from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { DenoiseMaterial, WebGLPathTracer } from 'three-gpu-pathtracer';

type PathTracerProps = {
  /** Whether to trace at all. False leaves the raster pipeline untouched. */
  active: boolean;
  /** Light bounces. Three is enough for interiors; more costs linearly. */
  bounces?: number;
  /** Stop accumulating here. The image is essentially converged well before. */
  maxSamples?: number;
  /** Reports convergence so the UI can show progress and then get out of the way. */
  onProgress?: (samples: number, maxSamples: number) => void;
  /** Multiplier on the hour's exposure while tracing. See the note below. */
  exposureBoost?: number;
};

/**
 * How hard the denoiser works, as a function of how converged the image is.
 *
 * A spatial denoiser trades detail for noise, and the right trade changes
 * completely over the life of a render. At ten samples the image is almost
 * entirely noise and there is very little detail to protect, so a wide
 * kernel with a generous edge threshold is a pure win. At three hundred the
 * noise is nearly gone and the same kernel would do nothing but soften the
 * stone, so it has to stand down.
 *
 * Ramping between the two is what makes the early frames worth looking at
 * without costing anything at the end — which is the whole point of having
 * a denoiser rather than simply waiting for more samples.
 */
function denoiseStrength(
  samples: number,
  maxSamples: number,
): { sigma: number; threshold: number } {
  // Reaches its tight end at forty percent of the sample budget rather than
  // at the end of it: by roughly a hundred and thirty samples a scene this
  // size is already clean enough that the filter should be doing almost
  // nothing but softening detail.
  const t = Math.min(1, Math.max(0, samples / Math.max(1, maxSamples * 0.4)));
  const eased = t * t;
  return {
    // Kernel radius, in pixels.
    sigma: 6.0 - eased * 4.4,
    // Edge threshold: how different two samples may be before the filter
    // stops mixing them.
    //
    // This has to start far wider than an edge-preserving filter normally
    // wants, because the dominant artefact early in a path trace is not
    // grain but *fireflies* — single pixels that caught an improbably
    // bright path and sit an order of magnitude above their neighbours. To
    // a bilateral filter a firefly looks exactly like an edge, so a tight
    // threshold preserves every one of them; the rendered frames showed
    // precisely that, with the flat areas cleaned up and the building still
    // covered in speckle. Opening the threshold lets the filter average
    // them away, and the ramp closes it again as the samples accumulate and
    // there is real detail worth protecting.
    // Settled by looking at both ends. At 0.55 the filter absorbed every
    // firefly and took the building's edges with them; at 0.1 the flat
    // areas cleaned up and the speckle survived untouched. Thirty is the
    // point where fireflies go and silhouettes stay.
    threshold: 0.3 - eased * 0.28,
  };
}

/**
 * Progressive path tracing of the live scene.
 *
 * ## Why this exists
 *
 * Seven phases of raster work took the residence to roughly seven out of
 * ten and then stopped moving. The reason is not polish: a rasterizer with
 * one directional light, an environment map and screen-space ambient
 * occlusion is *approximating* global illumination, and the things a
 * developer's eye actually reads as photographic — colour bleeding from a
 * rug onto a sofa, true soft contact under furniture, sunlight bouncing off
 * a terrace into a ceiling, light refracting through the pool — are not
 * approximations it can make. Every luxury architectural still used as a
 * benchmark for this project was path traced.
 *
 * So the same scene is traced instead of rasterized. Not a different model,
 * not a photograph, not a pre-baked image: the identical geometry,
 * materials and sky, with hundreds of light paths per pixel instead of one.
 *
 * ## Progressive, not blocking
 *
 * The first frame is whatever the raster pipeline already produced, and the
 * traced image accumulates over it. That ordering matters for a property
 * site: a visitor never waits on a blank canvas, and the image visibly
 * resolves — which reads as quality being produced rather than as loading.
 *
 * Tiling splits each sample across several draw calls so no single frame
 * stalls the tab, which is what keeps the page responsive while a hero
 * image converges.
 */
export function PathTracer({
  active,
  bounces = 4,
  maxSamples = 320,
  onProgress,
  exposureBoost = 2.6,
}: PathTracerProps) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);

  const tracer = useMemo(() => {
    const instance = new WebGLPathTracer(gl);
    instance.bounces = bounces;
    // Four tiles: a whole sample in one call visibly hitches on a scene
    // this size, and the tab has UI to keep responsive.
    instance.tiles.set(2, 2);
    instance.renderScale = 1;
    // Cross-fade from the rasterized frame as soon as a few samples exist,
    // so the viewer sees the image start resolving immediately rather than
    // staring at the raster version for several seconds.
    instance.minSamples = 3;
    instance.fadeDuration = 400;
    return instance;
  }, [gl, bounces]);

  const reported = useRef(-1);

  // ── Denoising ─────────────────────────────────────────────────────────
  //
  // `three-gpu-pathtracer` ships the filter but composes nothing: it is a
  // fullscreen material and the wiring is left to the application. The hook
  // it provides is `renderToCanvasCallback`, which hands over the traced
  // target, the renderer and the tracer's own display quad just before that
  // quad is drawn to the canvas.
  //
  // The filter is inserted *before* that quad rather than in place of it,
  // which matters: the display quad owns the cross-fade opacity, the tone
  // curve and the blend mode that lets the traced image come up over the
  // rasterized one. Replacing it would denoise the image and lose all
  // three. Denoising into an intermediate target and then pointing the
  // quad at that keeps every one of them exactly as it was.
  const denoise = useMemo(() => {
    const material = new DenoiseMaterial();
    const quad = new FullScreenQuad(material);
    // Half float, because the traced image is HDR and the display quad
    // still has tone mapping to do after this.
    const target = new WebGLRenderTarget(1, 1, {
      type: HalfFloatType,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      depthBuffer: false,
    });
    return { material, quad, target };
  }, []);

  useEffect(() => {
    return () => {
      denoise.quad.dispose();
      denoise.material.dispose();
      denoise.target.dispose();
    };
  }, [denoise]);

  useEffect(() => {
    if (!active) return;

    // The sky dome is drawn with a raw `ShaderMaterial`, which has no
    // `.color` — and the tracer reads that field off every material it
    // finds, so leaving the dome in the scene threw before a single ray was
    // cast. Hiding it is also correct on its own terms: the tracer lights
    // and backs the scene from `scene.environment`, which is baked from the
    // very same sky, so the dome would be a second copy of it in the way.
    // Swap the scene's environment to the cube copy `ProceduralSky` parks
    // for exactly this: the PMREM texture the rasterizer uses has no
    // readable pixels, and the tracer has to sample the environment to
    // find the sun.
    const rasterEnvironment = scene.environment;
    const cube = scene.userData.aureliaSkyCube as typeof scene.environment;
    if (cube) scene.environment = cube;

    const sky = scene.getObjectByName('ProceduralSky');
    const skyWasVisible = sky?.visible ?? false;
    if (sky) sky.visible = false;

    // Building the acceleration structure walks every triangle in the
    // scene, so it happens once per activation rather than per frame.
    tracer.setScene(scene, camera);

    if (sky) sky.visible = skyWasVisible;
    reported.current = -1;

    return () => {
      scene.environment = rasterEnvironment;
    };
  }, [active, tracer, scene, camera]);

  useEffect(() => {
    if (!active) return;
    tracer.updateCamera();
  }, [active, tracer, size.width, size.height]);

  useEffect(() => {
    if (!active) return;

    const previous = tracer.renderToCanvasCallback;
    tracer.renderToCanvasCallback = (target, renderer, quad) => {
      const source = target.texture;
      const width = target.width;
      const height = target.height;

      if (denoise.target.width !== width || denoise.target.height !== height) {
        denoise.target.setSize(width, height);
      }

      const { sigma, threshold } = denoiseStrength(tracer.samples, maxSamples);
      // `DenoiseMaterial` declares its uniforms in its own constructor, so
      // they are always present; the index signature simply cannot say so.
      const uniforms = denoise.material.uniforms as Record<string, IUniform>;
      uniforms.map!.value = source;
      uniforms.sigma!.value = sigma;
      uniforms.threshold!.value = threshold;
      uniforms.kSigma!.value = 1;

      const restore = renderer.getRenderTarget();
      renderer.setRenderTarget(denoise.target);
      denoise.quad.render(renderer);
      renderer.setRenderTarget(restore);

      // Hand the tracer's own display quad the filtered image and let it do
      // everything it was already doing.
      (quad.material as unknown as { map: Texture | null }).map = denoise.target.texture;
      const autoClear = renderer.autoClear;
      renderer.autoClear = false;
      quad.render(renderer);
      renderer.autoClear = autoClear;
    };

    return () => {
      tracer.renderToCanvasCallback = previous;
    };
  }, [active, tracer, denoise, maxSamples]);

  // Exposure has to be re-decided for a traced image.
  //
  // The hour's exposure values were tuned against a rasterizer whose
  // ambient term was a hemisphere light and an environment map — a
  // generous, everywhere-at-once fill. Path tracing replaces that with
  // light that actually has to arrive somewhere, so the same numbers render
  // roughly a stop and a half darker. This is a presentation offset, not a
  // correction to the hour: the rig itself is untouched.
  useEffect(() => {
    if (!active) return;
    const rasterExposure = gl.toneMappingExposure;
    gl.toneMappingExposure = rasterExposure * exposureBoost;
    return () => {
      gl.toneMappingExposure = rasterExposure;
    };
  }, [active, gl, exposureBoost]);

  useEffect(() => {
    return () => {
      tracer.dispose();
    };
  }, [tracer]);

  // Priority two puts this after the composer's own callback, and the two
  // are never mounted together — a traced frame has already had tone
  // mapping and exposure applied by the tracer itself.
  useFrame(() => {
    if (!active) return;
    if (tracer.samples < maxSamples) tracer.renderSample();

    const samples = Math.floor(tracer.samples);
    if (samples !== reported.current) {
      reported.current = samples;
      onProgress?.(samples, maxSamples);
    }
  }, 2);

  return null;
}

export default PathTracer;
