import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { installGamepad, pixelStats } from './browser-utils.mjs';
import { test as functional } from './browser-functional.mjs';
import { test as hook } from './browser-hook.mjs';
import { test as controller } from './browser-controller.mjs';

const url = process.env.APP_URL || 'http://127.0.0.1:5173';
const output = resolve('test-results');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
});
const report = {};
const selected = process.env.BROWSER_SUITE;
try {
  for (const [name, run, gamepad] of [['functional', functional, false], ['hook', hook, false], ['controller', controller, true]]) {
    if (selected && selected !== name) continue;
    const out = resolve(output, name);
    await mkdir(out, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
    if (gamepad) await installGamepad(page);
    try {
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => window.__SOURCE_DEBUG__);
      await pixelStats(page, '#game-canvas');
      report[name] = await run({ page, browser, out });
      if (errors.length) throw new Error(errors.join('\n'));
      console.log(`PASS ${name}: rendered WebGL scene, interactions, no browser errors`);
    } catch (error) {
      await page.screenshot({ path: resolve(out, 'failure.png') }).catch(() => {});
      report[name] = { failure: error.stack, errors };
      console.error(`FAIL ${name}: ${error.message}`);
      process.exitCode = 1;
    } finally {
      await page.close();
      await writeFile(resolve(output, 'browser-report.json'), JSON.stringify(report, null, 2));
    }
  }
} finally {
  await browser.close();
}
