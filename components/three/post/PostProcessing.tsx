'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { HalfFloatType, Vector2, WebGLRenderTarget } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { PostGrade, PostProfile } from '@/lib/three/grading';
import { GradingShader } from './GradingShader';

type PostProcessingProps = {
  profile: PostProfile;
  grade: PostGrade;
};

/**
 * The finishing chain: ambient occlusion, bloom, grade, tone map.
 *
 * ## Why a composer changes where tone mapping happens
 *
 * three applies tone mapping and the output colour transform in each
 * material's own shader, but only when it is drawing to the screen. Once a
 * composer is in play the scene is drawn into a linear half-float target
 * instead, and those steps have to move to the end of the chain — which is
 * what `OutputPass` is for. This is not incidental: it is the reason the
 * grade can work in linear light. `OutputPass` reads `toneMapping` and
 * `toneMappingExposure` straight off the renderer, so `SceneEnvironment`
 * stays the single owner of exposure exactly as before — the value simply
 * gets applied at the end of the chain instead of inside each material.
 *
 * ## Why these passes, from three itself
 *
 * Every pass here ships inside three's own examples. The project has held a
 * zero-external-asset line since Phase 1 and a no-unnecessary-dependency
 * line throughout; `postprocessing` and `@react-three/postprocessing` are
 * the usual answer and would have been a second renderer's worth of code to
 * buy effects the installed one already has.
 *
 * ## Ambient occlusion
 *
 * GTAO rather than the older SSAO: it estimates a real visibility integral
 * rather than counting occluded samples, which is the difference between
 * contact darkening and the dirty-corner look that gives screen-space AO
 * its bad name. It is applied with an intensity below one and a small
 * world radius, because the goal is for objects to sit on the floor, not
 * for the viewer to notice occlusion.
 */
export function PostProcessing({ profile, grade }: PostProcessingProps) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const dpr = useThree((state) => state.viewport.dpr);

  const { composer, gtao, bloom, grading } = useMemo(() => {
    const width = Math.max(1, Math.floor(size.width * dpr));
    const height = Math.max(1, Math.floor(size.height * dpr));

    // A render target does not inherit the canvas's MSAA, so without this
    // the composer would quietly undo the antialiasing the quality tier
    // asked for — every edge the Phase 7B chamfers just created would come
    // back jagged.
    const target = new WebGLRenderTarget(width, height, {
      type: HalfFloatType,
      samples: profile.samples,
    });

    const instance = new EffectComposer(gl, target);
    instance.setSize(size.width, size.height);
    instance.setPixelRatio(dpr);
    instance.addPass(new RenderPass(scene, camera));

    let aoPass: GTAOPass | null = null;
    if (profile.ambientOcclusion) {
      aoPass = new GTAOPass(
        scene,
        camera,
        width * profile.aoResolutionScale,
        height * profile.aoResolutionScale,
      );
      aoPass.updateGtaoMaterial({
        radius: profile.aoRadius,
        samples: profile.aoSamples,
        // A short falloff keeps the effect to genuine contact. Long-range
        // occlusion across a room is what produces halos around furniture
        // and grey-washed walls.
        distanceExponent: 1.6,
        thickness: 0.6,
        distanceFallOff: 0.9,
        scale: 1,
        screenSpaceRadius: false,
      });
      instance.addPass(aoPass);
    }

    let bloomPass: UnrealBloomPass | null = null;
    if (profile.bloom) {
      // Strength and threshold are left at their inert defaults here and
      // set from the hour in the effect below, so that changing the time of
      // day retunes the existing pass instead of rebuilding the whole chain.
      bloomPass = new UnrealBloomPass(
        new Vector2(size.width, size.height),
        0,
        // A wide radius spreads the spill far enough to read as light in
        // air rather than as an outline traced around the fixture.
        0.75,
        1,
      );
      instance.addPass(bloomPass);
    }

    const gradingPass = new ShaderPass(GradingShader);
    instance.addPass(gradingPass);

    // Last, and only here: ACES and the sRGB transform, now that the grade
    // has had the linear image to work on.
    instance.addPass(new OutputPass());

    return { composer: instance, gtao: aoPass, bloom: bloomPass, grading: gradingPass };
    // Rebuilt only when the tier changes. Grade values and size are pushed
    // into the existing passes below rather than reallocating the chain.
  }, [gl, scene, camera, profile, size.width, size.height, dpr]);

  useEffect(() => {
    return () => {
      composer.dispose();
    };
  }, [composer]);

  useEffect(() => {
    composer.setSize(size.width, size.height);
    composer.setPixelRatio(dpr);
  }, [composer, size.width, size.height, dpr]);

  useEffect(() => {
    const uniforms = grading.uniforms;
    uniforms.uSlope!.value.set(...grade.slope);
    uniforms.uOffset!.value.set(...grade.offset);
    uniforms.uPower!.value.set(...grade.power);
    uniforms.uSaturation!.value = grade.saturation;
    uniforms.uContrast!.value = grade.contrast;
    uniforms.uVignette!.value = grade.vignette;
    uniforms.uResolution!.value.set(size.width, size.height);

    if (bloom) {
      bloom.strength = grade.bloomStrength;
      bloom.threshold = grade.bloomThreshold;
    }
    if (gtao) {
      gtao.blendIntensity = grade.aoIntensity;
    }
  }, [grading, bloom, gtao, grade, size.width, size.height]);

  // A positive priority takes the frame from R3F's own render call. This
  // works under `frameloop="demand"` as well: it runs whenever a frame is
  // requested, it simply is not requested every tick.
  useFrame(() => {
    // `renderer.info` resets itself on every `render()` call, so with a
    // chain of passes the diagnostics overlay would report whatever the
    // last full-screen quad cost — one draw call, two triangles — rather
    // than the frame. Taking the reset over makes the counters accumulate
    // across every pass, which is both correct and more useful: they now
    // include what the ambient-occlusion prepass actually costs.
    //
    // Set here rather than once in an effect because the render loop
    // restores `autoReset` at the top of each frame for its own accounting.
    gl.info.autoReset = false;
    gl.info.reset();
    composer.render();
  }, 1);

  return null;
}

export default PostProcessing;
