/**
 * Renders the interior panoramas: six cube faces per room, path-traced.
 *
 *   RENDER_ORIGIN=http://localhost:3100 node scripts/render-panoramas.mjs [spaceId]
 *
 * Every constant a calibration could move is read from the environment.
 * Nothing here hardcodes a figure that has not been measured.
 *
 *   PANO_RESOLUTION   face size in px: 1024 | 1536 | 2048   (default 1024)
 *   PANO_SAMPLES      path-tracer sample budget per face    (default 128)
 *   PANO_CACHE_LIMIT  loader residency, for the VRAM check  (default 6)
 *   RENDER_BACKEND    gpu | swiftshader                     (default gpu)
 *   CONVERGE_TIMEOUT_MIN                                    (default 25)
 *
 * ## Why one page per room
 *
 * Page load, scene build and BVH construction are per-page costs. Doing them
 * once per face would pay them 78 times instead of 13. The bridge exposes
 * `renderFace`, which re-points the camera and resets the tracer's
 * accumulation in place — see `PathTracer`'s `cameraEpoch`.
 */
import { chromium } from 'playwright';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertBackend, backendArgs } from './lib/render-backend.mjs';
import { CUBE_FACES } from './lib/cubemap-faces.mjs';
import { captureCanvas, renderFace } from './lib/pano-capture.mjs';
import { peakMiB, resolveFaceSize } from './lib/vram.mjs';
import { spaceIds } from './lib/pano-spaces.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = join(REPO, 'public/assets/pano');
const PUBLIC_PREFIX = '/assets/pano';
const EXTENSION = process.env.PANO_FORMAT ?? 'jpg';
const JPEG_QUALITY = Number(process.env.PANO_QUALITY ?? 90);

const ORIGIN = process.env.RENDER_ORIGIN ?? 'http://localhost:3100';
const RENDER_BACKEND = process.env.RENDER_BACKEND ?? 'gpu';
const SIZE = resolveFaceSize(process.env.PANO_RESOLUTION ?? '1024');
const SAMPLES = Number(process.env.PANO_SAMPLES ?? 128);
const CACHE_LIMIT = Number(process.env.PANO_CACHE_LIMIT ?? 6);
const CONVERGE_TIMEOUT_MS = Number(process.env.CONVERGE_TIMEOUT_MIN ?? 25) * 60_000;

/** The mobile residency target. Not measured on a device — see the Phase 3 note. */
const MOBILE_BUDGET_MIB = 224;

// The render list is the rooms the navigation graph can actually reach.
// Rendering a space with no graph edges produces an orphan panorama nothing
// can navigate to; rendering a site space produces an interior of the outdoors.
const spacesToRender = (only) => (only ? spaceIds.filter((id) => id === only) : [...spaceIds]);

async function main() {
  const only = process.argv[2];
  const targets = spacesToRender(only);
  if (targets.length === 0) throw new Error(`no room matches "${only ?? '<all>'}"`);

  const peak = peakMiB(SIZE, CACHE_LIMIT);
  console.log(
    `${targets.length} rooms x ${CUBE_FACES.length} faces = ${targets.length * CUBE_FACES.length} renders\n` +
      `  ${SIZE}px ${EXTENSION}${EXTENSION === 'png' ? '' : ` q${JPEG_QUALITY}`} faces, ` +
      `${SAMPLES} samples, ${RENDER_BACKEND} backend, ` +
      `timeout ${Math.round(CONVERGE_TIMEOUT_MS / 60_000)} min/face\n` +
      `  peak VRAM at cache limit ${CACHE_LIMIT}: ${peak.toFixed(0)} MiB`,
  );
  if (peak > MOBILE_BUDGET_MIB) {
    console.warn(
      `\n[warn] ${peak.toFixed(0)} MiB exceeds the ${MOBILE_BUDGET_MIB} MiB mobile figure.\n` +
        `       Lower PANO_RESOLUTION or PANO_CACHE_LIMIT, or accept it knowingly —\n` +
        `       no residency measurement on a real device exists yet.\n`,
    );
  }

  const browser = await chromium.launch({
    args: ['--no-sandbox', ...backendArgs(RENDER_BACKEND)],
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  });

  const rendered = [];
  try {
    await assertBackend(browser, RENDER_BACKEND, {
      hint: `Re-run in software with: RENDER_BACKEND=swiftshader PANO_SAMPLES=32 node scripts/render-panoramas.mjs`,
    });

    for (const spaceId of targets) {
      const staging = join(ROOT, spaceId, '.staging');
      await rm(staging, { recursive: true, force: true });
      await mkdir(staging, { recursive: true });

      const context = await browser.newContext({
        viewport: { width: SIZE, height: SIZE },
        deviceScaleFactor: 1,
      });
      // Set before mount: the bridge reads the budget on its first render.
      await context.addInitScript((n) => {
        window.__AURELIA_STILL_SAMPLES__ = n;
      }, SAMPLES);
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
      console.log(`${spaceId}  setup ${Date.now() - t0}ms`);

      for (const face of CUBE_FACES) {
        const faceStart = Date.now();
        await renderFace(page, face, CONVERGE_TIMEOUT_MS);
        const image = await captureCanvas(page, {
          format: EXTENSION === 'png' ? 'png' : 'jpeg',
          quality: JPEG_QUALITY,
        });
        await writeFile(join(staging, `${face}.${EXTENSION}`), image);
        console.log(`  ${spaceId}/${face}  ${Date.now() - faceStart}ms`);
      }

      await context.close();

      // Swap last, so a job that dies at face four leaves the previous
      // render readable rather than half-replaced.
      const latest = join(ROOT, spaceId, 'latest');
      const previous = join(ROOT, spaceId, '.previous');
      await rm(previous, { recursive: true, force: true });
      await rename(latest, previous).catch(() => {});
      await rename(staging, latest);
      await rm(previous, { recursive: true, force: true });
      rendered.push(spaceId);
    }
  } finally {
    await browser.close();
  }

  const { emitManifest } = await import('./lib/manifest.mjs');
  const result = await emitManifest({
    // Every room, not only the ones this run touched: the emitter merges,
    // and a single-room run must not delete twelve other entries.
    spaceIds: spacesToRender(undefined),
    root: ROOT,
    publicPrefix: PUBLIC_PREFIX,
    size: SIZE,
    extension: EXTENSION,
    outFile: join(REPO, 'lib/pano/manifest.generated.ts'),
  });

  console.log(
    `\nrendered ${rendered.length} room(s); manifest covers ${result.written.length}, ` +
      `${result.skipped.length} not yet rendered`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
