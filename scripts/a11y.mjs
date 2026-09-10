#!/usr/bin/env node
/**
 * Accessibility audit against a real production build.
 *
 * Run with `npm run test:a11y`, after `npm run build`. It starts the built
 * site on its own port, drives a real Chromium at each page, and runs
 * axe-core over both the WCAG rule sets and the best-practice set.
 *
 * ## Why it checks that the stylesheet loaded
 *
 * An earlier manual run of this audit reported fifteen contrast violations
 * that did not exist. A stale server from a previous session was holding the
 * port and serving a dead build, so the CSS 404'd and axe was grading an
 * unstyled page: every element fell back to the browser's default link
 * colour on white. The numbers looked plausible and were entirely fictional.
 *
 * So this refuses to report anything at all unless the page it is looking at
 * is actually styled. A wrong answer here is worse than no answer, because a
 * clean run is exactly the sort of thing nobody re-checks.
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = Number(process.env.A11Y_PORT ?? 3210);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const PAGES = [
  '/',
  '/tower',
  '/experience',
  '/residence',
  '/floor-plan',
  '/gallery',
  '/contact',
  '/privacy',
  '/terms',
  '/accessibility',
];
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
/** Below this the page is not styled and no finding from it means anything. */
const MIN_CSS_RULES = 50;

const axe = readFileSync('node_modules/axe-core/axe.min.js', 'utf8');

async function waitForServer(timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(ORIGIN + '/', { signal: AbortSignal.timeout(4000) });
      if (response.ok) return;
    } catch {
      // Not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`server did not start on ${ORIGIN}`);
}

const server = spawn('npx', ['next', 'start', '--port', String(PORT)], {
  stdio: 'inherit',
  env: process.env,
});
const stop = () => {
  if (!server.killed) server.kill('SIGTERM');
};
process.on('exit', stop);
process.on('SIGINT', () => {
  stop();
  process.exit(130);
});

let failures = 0;
let browser;

try {
  await waitForServer();
  browser = await chromium.launch({
    // Software rendering: CI has no GPU, and the pages under audit mount a
    // WebGL canvas. Frame rate from this is meaningless and is never
    // reported — the audit only needs the DOM to exist.
    // `--no-sandbox` because CI containers and this project's own sandbox
    // both run as root, where Chromium's sandbox cannot start and the launch
    // hangs rather than failing.
    args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
    // CI installs its own browser and needs no override. Set CHROMIUM_PATH
    // where one is already on the machine and must not be re-downloaded.
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  });

  for (const path of PAGES) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    try {
      await page.goto(ORIGIN + path, { waitUntil: 'domcontentloaded', timeout: 120_000 });
      await page.waitForTimeout(3000);

      const rules = await page.evaluate(() =>
        [...document.styleSheets].reduce((total, sheet) => {
          try {
            return total + sheet.cssRules.length;
          } catch {
            return total;
          }
        }, 0),
      );
      if (rules < MIN_CSS_RULES) {
        throw new Error(
          `stylesheet did not apply (${rules} rules) — any finding here would be an artefact`,
        );
      }

      await page.addScriptTag({ content: axe });
      const { violations } = await page.evaluate(
        async (tags) => window.axe.run(document, { runOnly: { type: 'tag', values: tags } }),
        [...WCAG, 'best-practice'],
      );

      if (violations.length === 0) {
        console.log(`  ok   ${path}`);
      } else {
        failures += violations.length;
        console.log(`  FAIL ${path}`);
        for (const violation of violations) {
          console.log(`         [${violation.impact}] ${violation.id} — ${violation.help}`);
          for (const node of violation.nodes.slice(0, 4)) {
            console.log(`           ${node.target.join(' ')}`);
          }
        }
      }
    } finally {
      await page.close();
    }
  }
} finally {
  await browser?.close();
  stop();
}

if (failures > 0) {
  console.error(`\n${failures} accessibility violation type(s) across ${PAGES.length} pages`);
  process.exit(1);
}
console.log(`\nNo accessibility violations across ${PAGES.length} pages.`);
