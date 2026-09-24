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
    uGrain: { value: 0 },
    uAberration: { value: 0 },
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
    uniform float uGrain;
    uniform float uAberration;
    uniform vec2 uResolution;

    varying vec2 vUv;

    // A cheap, stable per-pixel hash. Deliberately NOT animated: there is no
    // time uniform here, and that is the point. Half this site's framings
    // are held stills rendered under \`frameloop="demand"\`, which draws only
    // when something changes — an animated grain would be a reason to redraw
    // every tick forever, on a scene that is otherwise costing nothing.
    // Static grain is also the more correct look: grain lives in the film
    // plane, not in the world, so it belongs to the frame rather than to the
    // subject, and a still photograph's grain does not crawl.
    float hash12(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    // Rec. 709 luma, so desaturating does not shift the perceived
    // brightness of foliage and sky against stone.
    const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

    // Middle grey in linear light. Contrast pivots here rather than at 0.5
    // so raising it darkens shadows and lifts highlights around the value
    // an 18% card sits at, instead of around an arbitrary midpoint.
    const float PIVOT = 0.18;

    void main() {
      // Distance from the optical axis, aspect-corrected so both the
      // aberration and the vignette below fall off with the frame rather
      // than with UV space.
      vec2 centered = (vUv - 0.5) * vec2(max(uResolution.x / max(uResolution.y, 1.0), 1.0), 1.0);
      float r = length(centered) / 0.75;

      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 color = max(texel.rgb, 0.0);

      if (uAberration > 0.0) {
        // Radial and squared: zero on the axis, growing toward the corner,
        // which is how a lens actually fails to converge its wavelengths.
        // Red and blue are pulled opposite ways and green is left alone, so
        // a neutral centre stays neutral and only edge detail fringes.
        vec2 dir = (vUv - 0.5);
        vec2 shift = dir * (uAberration * r * r) / max(uResolution.x, 1.0);
        color.r = max(texture2D(tDiffuse, vUv + shift).r, 0.0);
        color.b = max(texture2D(tDiffuse, vUv - shift).b, 0.0);
      }

      // ASC CDL.
      color = color * uSlope + uOffset;
      color = pow(max(color, 0.0), uPower);

      color = mix(vec3(dot(color, LUMA)), color, uSaturation);

      color = max((color - PIVOT) * uContrast + PIVOT, 0.0);

      if (uVignette > 0.0) {
        // Smooth and late-starting: a vignette that begins at the centre
        // reads as a filter, one that only touches the corners reads as
        // a lens.
        color *= 1.0 - uVignette * smoothstep(0.55, 1.35, r);
      }

      if (uGrain > 0.0) {
        // Weighted to the mid-tones. Real grain is a property of the
        // emulsion's exposed silver, so it is strongest where the most
        // grains were developed and vanishes in both the clear highlights
        // and the empty shadows. Applying it flat instead is what makes
        // added grain read as video noise: it sits on top of the blacks,
        // which is the one place a photograph is smooth.
        float luma = dot(color, LUMA);
        float weight = 4.0 * luma * (1.0 - clamp(luma, 0.0, 1.0));
        float n = hash12(gl_FragCoord.xy) - 0.5;
        color += n * uGrain * weight;
        color = max(color, 0.0);
      }

      gl_FragColor = vec4(color, texel.a);
    }
  `,
};

export default GradingShader;
