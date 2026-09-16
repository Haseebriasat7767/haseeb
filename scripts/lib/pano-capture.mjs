import { CUBE_FACES } from './cubemap-faces.mjs';

/**
 * Capturing one traced cube face.
 *
 * The capture path is not Playwright's `page.screenshot()`, for the reason
 * `brochure-stills.mjs` documents at length: a traced frame is technically
 * still live — the tracer keeps rendering past `maxSamples` at the same
 * sample count — so every Playwright capture path waits for a "stable" frame
 * that never arrives and times out. CDP's `Page.captureScreenshot` takes the
 * frame in front of it.
 */

/** Waits out one face's convergence, using the signal the stills job uses. */
export async function waitForConvergence(page, timeoutMs) {
  // Waiting for it to attach first guards a race where the trace finishes
  // inside the couple of frames it takes Playwright to look.
  await page
    .waitForSelector('[data-cinematic-progress]', { state: 'attached', timeout: 20_000 })
    .catch(() => {});
  await page.waitForSelector('[data-cinematic-progress]', {
    state: 'detached',
    timeout: timeoutMs,
  });
  // One more frame so the denoiser's final pass and the display quad's
  // cross-fade are both composited before the shutter.
  await page.waitForTimeout(200);
}

/**
 * The canvas alone, with every sibling hidden so nothing composites in.
 *
 * `format` is JPEG for the delivered faces: PNG is lossless encoding on
 * photographic content, and at 1024² it costs about six times the bytes for
 * no visible difference on a face read at ~11 px/degree.
 */
export async function captureCanvas(page, { format = 'jpeg', quality = 90 } = {}) {
  const client = await page.context().newCDPSession(page);
  const box = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  if (!box) throw new Error('no canvas to capture');

  const shot = await client.send('Page.captureScreenshot', {
    format,
    ...(format === 'jpeg' ? { quality } : {}),
    clip: { ...box, scale: 1 },
    captureBeyondViewport: false,
  });
  await client.detach();
  return Buffer.from(shot.data, 'base64');
}

/** Steps the bridge to a face and waits for it to converge. */
export async function renderFace(page, faceId, timeoutMs) {
  await page.evaluate((id) => window.__panoRender.renderFace(id), faceId);
  await waitForConvergence(page, timeoutMs);
}

export { CUBE_FACES };
