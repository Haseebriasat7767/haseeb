#!/usr/bin/env node
/**
 * Is this machine able to render the plates?
 *
 * Run this first, on any machine you are considering paying for:
 *
 *   node scripts/check-gpu.mjs
 *
 * It needs no build and no server — it opens a browser, asks the renderer
 * what it is, and traces a small WebGL workload to see how fast it
 * actually goes.
 *
 * ## Why it exists
 *
 * A GPU cloud sells CUDA. Chromium needs OpenGL or Vulkan, and the two
 * are not the same thing: a container can hold an A100 and still fall
 * back to SwiftShader because the GL libraries were never installed. The
 * symptom of finding that out the slow way is a full run where every
 * plate times out at twenty-five minutes, on an instance billed by the
 * hour. This answers the same question in about a minute.
 */
import { chromium } from 'playwright';

const BACKEND_ARGS =
  process.env.RENDER_BACKEND === 'swiftshader'
    ? ['--use-gl=swiftshader', '--enable-unsafe-swiftshader']
    : ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=default'];

const browser = await chromium.launch({
  args: ['--no-sandbox', ...BACKEND_ARGS],
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const report = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const gl = canvas.getContext('webgl2');
    if (!gl) return { renderer: 'none', vendor: 'none', ms: null };

    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : 'unknown';
    const vendor = info ? String(gl.getParameter(info.UNMASKED_VENDOR_WEBGL)) : 'unknown';

    // A crude but honest throughput probe: fill the buffer repeatedly and
    // force a sync each time, so the number reflects the GPU finishing
    // work rather than the driver queueing it.
    const started = performance.now();
    for (let i = 0; i < 60; i += 1) {
      gl.clearColor(i / 60, 0.2, 0.4, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.finish();
    }
    return { renderer, vendor, ms: Math.round(performance.now() - started) };
  });

  const software = /swiftshader|llvmpipe|software|mesa offscreen/i.test(report.renderer);

  console.log(`\n  vendor    ${report.vendor}`);
  console.log(`  renderer  ${report.renderer}`);
  console.log(`  60 frames ${report.ms === null ? 'n/a' : `${report.ms} ms`}\n`);

  if (report.renderer === 'none') {
    console.log('  NO WebGL AT ALL. Chromium cannot render here.');
    console.log('  On a headless Linux box this is usually the missing display:');
    console.log('    sudo apt-get install -y xvfb');
    console.log('    xvfb-run -s "-screen 0 1920x1080x24" node scripts/check-gpu.mjs\n');
    process.exitCode = 1;
  } else if (software) {
    console.log('  SOFTWARE RENDERING. Do not pay for this machine to trace plates.');
    console.log('  The GPU is either absent or its GL drivers are not installed —');
    console.log('  CUDA being present does not mean OpenGL is.\n');
    process.exitCode = 1;
  } else {
    console.log('  Real GPU. Good to render:\n');
    console.log('    npm run build && node scripts/brochure-stills.mjs\n');
  }
} finally {
  await browser.close();
}
