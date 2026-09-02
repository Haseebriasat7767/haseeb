import { Vector2, Vector3 } from 'three';

/**
 * The finishing grade, as a full-screen shader.
 *
 * Runs on linear light, before `OutputPass` applies ACES and converts to
 * sRGB. That ordering is the whole point: a grade applied after tone
 * mapping can only redistribute the values the curve already decided to
 * keep, so lifting a shadow there raises noise rather than detail and
 * warming a highlight there pushes it straight into clipping. Working
 * ahead of the curve is what a colourist does with a log image, and it is
 * why these values can stay as small as they are.
 *
 * The maths is ASC CDL — slope, offset, power — followed by saturation and
 * a contrast pivot, then a lens vignette. Nothing here is a look-up table:
 * every term is a named parameter in `lib/three/grading.ts` that can be
 * reasoned about and changed per hour.
 */
export const GradingShader = {
  name: 'AureliaGradingShader',

  uniforms: {
    tDiffuse: { value: null },
    uSlope: { value: new Vector3(1, 1, 1) },
    uOffset: { value: new Vector3(0, 0, 0) },
    uPower: { value: new Vector3(1, 1, 1) },
    uSaturation: { value: 1 },
    uContrast: { value: 1 },
    uVignette: { value: 0 },
    uResolution: { value: new Vector2(1, 1) },
  },

  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec3 uSlope;
    uniform vec3 uOffset;
    uniform vec3 uPower;
    uniform float uSaturation;
    uniform float uContrast;
    uniform float uVignette;
    uniform vec2 uResolution;

    varying vec2 vUv;

    // Rec. 709 luma, so desaturating does not shift the perceived
    // brightness of foliage and sky against stone.
    const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

    // Middle grey in linear light. Contrast pivots here rather than at 0.5
    // so raising it darkens shadows and lifts highlights around the value
    // an 18% card sits at, instead of around an arbitrary midpoint.
    const float PIVOT = 0.18;

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 color = max(texel.rgb, 0.0);

      // ASC CDL.
      color = color * uSlope + uOffset;
      color = pow(max(color, 0.0), uPower);

      color = mix(vec3(dot(color, LUMA)), color, uSaturation);

      color = max((color - PIVOT) * uContrast + PIVOT, 0.0);

      if (uVignette > 0.0) {
        // Distance from centre, corrected for aspect so the falloff is
        // elliptical with the frame rather than circular in UV space.
        vec2 centered = (vUv - 0.5) * vec2(max(uResolution.x / max(uResolution.y, 1.0), 1.0), 1.0);
        float r = length(centered) / 0.75;
        // Smooth and late-starting: a vignette that begins at the centre
        // reads as a filter, one that only touches the corners reads as
        // a lens.
        color *= 1.0 - uVignette * smoothstep(0.55, 1.35, r);
      }

      gl_FragColor = vec4(color, texel.a);
    }
  `,
};

export default GradingShader;
