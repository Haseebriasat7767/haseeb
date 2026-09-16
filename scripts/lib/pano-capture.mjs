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

const sessions = new WeakMap();

async function session(page) {
  let client = sessions.get(page);
  if (!client) {
    client = await page.context().newCDPSession(page);
    sessions.set(page, client);
  }
  return client;
}

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
  // Strip the interface before the shutter.
  //
  // Clipping to the canvas is not enough: the site header is positioned over
  // it, so it composites into the clip region and every face comes out with
  // "AURELIA" and the nav baked across the top of the room. `brochure-stills`
  // learned this already; the panorama capture had not inherited it.
  const hidden = await page.addStyleTag({
    content: 'body * { visibility: hidden !important; } canvas { visibility: visible !important; }',
  });
  await page.waitForTimeout(150);

  // One session per page, cached. Creating and detaching a session per face
  // races with itself — the detach can arrive after the target has already
  // dropped it, and the protocol error takes the whole run down six faces in.
  const client = await session(page);
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
  await hidden.evaluate((node) => node.remove());
  return Buffer.from(shot.data, 'base64');
}

/**
 * Steps the bridge to a face, waits for it, and refuses to let a
 * mis-aimed face through.
 *
 * The check is not paranoia. A camera that has been dragged back to the
 * authored framing still renders a perfectly good-looking interior — it is
 * simply the wrong one, six times over, and the resulting "cubemap" has
 * seams that only show once it is wrapped on a sphere.
 */
export async function renderFace(page, faceId, timeoutMs) {
  await page.evaluate((id) => window.__panoRender.renderFace(id), faceId);
  await waitForConvergence(page, timeoutMs);

  const aim = await page.evaluate(() => ({
    aimed: window.__panoRender.aimed,
    dir: window.__panoRender.dir,
    face: window.__panoRender.face,
  }));
  if (aim.aimed !== true) {
    throw new Error(
      `face "${faceId}" was captured aiming [${aim.dir}] (bridge reports face "${aim.face}"). ` +
        `Something is driving the camera besides CubeFaceCamera.`,
    );
  }
}

export { CUBE_FACES };
