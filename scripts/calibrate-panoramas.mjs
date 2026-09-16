/**
 * Fills TBD-1, TBD-2 and TBD-3 with measurements instead of guesses.
 *
 *   RENDER_ORIGIN=http://localhost:3100 node scripts/calibrate-panoramas.mjs <spaceId>
 *
 * ## Why this loads pages more than once
 *
 * TBD-3 asks whether per-job setup dominates — whether emitting one equirect
 * plate per room (13 jobs) beats six cube faces (78 jobs). Setup is a
 * *per-page* cost: navigation, scene build, BVH construction. A script that
 * loads one page and then varies sample counts inside it cannot see that
 * cost at all; it measures the marginal cost of a render call, which is a
 * different number that happens to look plausible.
 *
 * So the measurement is a difference: N separate page loads doing one face
 * each, against one page load doing N faces. The gap is T_setup.
 *
 * ## Why the worst face
 *
 * Convergence cost varies sharply by direction — a ceiling resolves far
 * faster than a wall of glazing with sun behind it. Calibrating on an
 * arbitrary face and multiplying by six gives a figure with no stated error,
 * so both extremes are measured and the spread is reported.
 */
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { assertBackend, backendArgs } from './lib/render-backend.mjs';
import { renderFace } from './lib/pano-capture.mjs';
import { resolveFaceSize } from './lib/vram.mjs';
import { spaceIds } from './lib/pano-spaces.mjs';

const ORIGIN = process.env.RENDER_ORIGIN ?? 'http://localhost:3100';
const RENDER_BACKEND = process.env.RENDER_BACKEND ?? 'gpu';
const SIZES = (process.env.PANO_SIZES ?? '1024,1536').split(',').map(resolveFaceSize);
const SAMPLE_STEPS = (process.env.PANO_SAMPLE_STEPS ?? '32,128,320').split(',').map(Number);
const CONVERGE_TIMEOUT_MS = Number(process.env.CONVERGE_TIMEOUT_MIN ?? 25) * 60_000;
const OUT = process.env.PANO_CALIBRATION_OUT ?? 'pano-calibration.json';

/** Brightest and darkest directions in an interior — the convergence spread. */
const SPREAD_FACES = ['pz', 'ny'];

async function openBridge(browser, spaceId, size, samples) {
  const context = await browser.newContext({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });
  await context.addInitScript((n) => {
    window.__AURELIA_STILL_SAMPLES__ = n;
  }, samples);
  const page = await context.newPage();

  const t0 = Date.now();
  await page.goto(`${ORIGIN}/render/panorama?space=${spaceId}`, {
    waitUntil: 'load',
    timeout: 200_000,
  });
  await page.waitForFunction('window.__panoRender !== undefined', undefined, {
    timeout: 120_000,
  });
  await page.waitForFunction('window.__panoRender.ready === true', undefined, {
    timeout: CONVERGE_TIMEOUT_MS,
  });
  // Page load + scene build + BVH + the first traced frame. This is the
  // quantity a one-page script cannot see.
  const setupMs = Date.now() - t0;
  return { context, page, setupMs };
}

async function timeFace(page, face) {
  const t0 = Date.now();
  await renderFace(page, face, CONVERGE_TIMEOUT_MS);
  return Date.now() - t0;
}

async function main() {
  const spaceId = process.argv[2];
  if (!spaceId)
    throw new Error(`usage: calibrate-panoramas.mjs <spaceId>  (${spaceIds.join(', ')})`);
  if (!spaceIds.includes(spaceId)) throw new Error(`"${spaceId}" is not a rendered room`);

  const browser = await chromium.launch({
    args: ['--no-sandbox', ...backendArgs(RENDER_BACKEND)],
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  });

  const record = {
    measuredAt: new Date().toISOString(),
    origin: ORIGIN,
    space: spaceId,
    backend: RENDER_BACKEND,
    renderer: null,
    software: null,
    runs: [],
  };

  try {
    // The entire output of this script is a constant that a design document
    // will multiply by 78. A run that silently used a software rasteriser
    // does not fail — it produces plausible numbers that are wrong by orders
    // of magnitude. So the backend is verified before anything is timed, and
    // the renderer string is recorded alongside every figure.
    const checked = await assertBackend(browser, RENDER_BACKEND, {
      hint: 'A software calibration is not a GPU calibration. Re-run with RENDER_BACKEND=swiftshader only to exercise the plumbing.',
    });
    record.renderer = checked.renderer;
    record.software = checked.software;

    for (const size of SIZES) {
      for (const samples of SAMPLE_STEPS) {
        // One page, several faces: the per-face marginal cost, and the
        // spread between the cheapest and dearest direction.
        const warm = await openBridge(browser, spaceId, size, samples);
        const faces = {};
        for (const face of SPREAD_FACES) faces[face] = await timeFace(warm.page, face);
        await warm.context.close();

        // A second page doing a single face: setup paid again, so the
        // difference against the warm run isolates it.
        const cold = await openBridge(browser, spaceId, size, samples);
        const coldFace = await timeFace(cold.page, SPREAD_FACES[0]);
        await cold.context.close();

        const run = {
          size,
          samples,
          setupMs: Math.round((warm.setupMs + cold.setupMs) / 2),
          faceMs: faces,
          marginalFaceMs: faces[SPREAD_FACES[0]],
          coldFaceMs: coldFace,
          msPerSample: Number((faces[SPREAD_FACES[0]] / samples).toFixed(2)),
        };
        record.runs.push(run);

        console.log(
          `${size}px ${String(samples).padStart(3)} samples  ` +
            `setup ${run.setupMs}ms  ` +
            `face ${run.marginalFaceMs}ms (${run.msPerSample}ms/sample)  ` +
            `spread ${SPREAD_FACES.map((f) => `${f} ${faces[f]}ms`).join(' / ')}`,
        );
      }
    }
  } finally {
    await browser.close();
  }

  await writeFile(OUT, `${JSON.stringify(record, null, 2)}\n`, 'utf8');

  const usable = record.runs.length > 0 && !record.software;
  console.log(`\nwrote ${OUT}`);
  if (!usable) {
    // Refuse to present a fit that cannot mean anything.
    console.log(
      `\nNo GPU figure produced: renderer was "${record.renderer}".\n` +
        `TBD-1/2/3 remain open. The plumbing is exercised; the numbers are not a bound.`,
    );
    return;
  }

  const base = record.runs[0];
  console.log(
    `\nT_setup  ~${base.setupMs}ms per page\n` +
      `T_sample ~${base.msPerSample}ms at ${base.size}px\n` +
      `78 faces: ${((78 * (base.setupMs + base.samples * base.msPerSample)) / 60000).toFixed(1)} min` +
      `   |   13 equirect jobs save ${(((78 - 13) * base.setupMs) / 60000).toFixed(1)} min of setup`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
