/**
 * Which renderer Chromium is actually using, asked rather than assumed.
 *
 * Extracted from `brochure-stills.mjs`, where this check earned its place:
 * the flags there used to force SwiftShader unconditionally, so a run on a
 * rented GPU would software-render anyway. Every plate would hit the
 * convergence timeout and the only symptom would be a GPU doing nothing for
 * hours. It has since caught ANGLE reporting
 * `Vulkan 1.3.0 (SwiftShader Device)` while looking like a success.
 *
 * This matters more for the panorama job, not less: it is 78 renders rather
 * than 29, and it matters most of all for `calibrate.mjs`, whose entire
 * output is a per-render constant. A calibration that silently ran in
 * software does not fail — it produces plausible numbers that are wrong by
 * orders of magnitude, and they go into a design document.
 */

export function backendArgs(backend) {
  if (!['gpu', 'swiftshader'].includes(backend)) {
    throw new Error(`RENDER_BACKEND must be "gpu" or "swiftshader", got "${backend}"`);
  }
  return backend === 'swiftshader'
    ? ['--use-gl=swiftshader', '--enable-unsafe-swiftshader']
    : ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=default'];
}

/** The renderer string, and whether it is a software rasteriser. */
export async function probeRenderer(browser) {
  const page = await browser.newPage();
  const renderer = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return 'none';
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    return info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : 'unknown';
  });
  await page.close();
  return { renderer, software: /swiftshader|llvmpipe|software/i.test(renderer) };
}

/** Stops the run rather than burning the budget on a backend nobody asked for. */
export async function assertBackend(browser, backend, { hint = '' } = {}) {
  const { renderer, software } = await probeRenderer(browser);
  console.log(`  renderer: ${renderer}`);
  if (backend === 'gpu' && software) {
    throw new Error(
      `asked for the GPU backend but the renderer is "${renderer}".\n` +
        `  Path tracing will not converge in software at any useful sample count.\n` +
        (hint ? `  ${hint}\n` : ''),
    );
  }
  return { renderer, software };
}
