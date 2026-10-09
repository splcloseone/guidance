import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { installGamepad, pixelStats } from './browser-utils.mjs';
import { test as creation } from './browser-creation.mjs';
import { test as practice } from './browser-practice.mjs';
import { test as combatClay } from './browser-combat-clay.mjs';
import { test as sculpt } from './browser-sculpt.mjs';

// Run these suites sequentially: multiple simultaneous software WebGL renderers
// make physics/input timing unreliable on small cloud machines.
const url = process.env.APP_URL || 'http://127.0.0.1:5173';
const output = resolve('test-results/core');
const suites = { creation, practice, sculpt, combatClay };
const selected = process.env.BROWSER_SUITE;
if (selected && !suites[selected]) throw new Error(`Unknown core browser suite: ${selected}`);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
});
const report = {};
try {
  for (const [name, run] of Object.entries(suites)) {
    if (selected && name !== selected) continue;
    const out = resolve(output, name);
    await mkdir(out, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    page.setDefaultTimeout(20000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
    if (name === 'practice' || name === 'combatClay') await installGamepad(page);
    try {
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => window.__SOURCE_DEBUG__);
      const rendered = await pixelStats(page, '#game-canvas');
      report[name] = { rendered, ...await run({ page, browser, out }) };
      if (errors.length) throw new Error(errors.join('\n'));
      console.log(`PASS core/${name}: actual UI interactions and no browser errors`);
    } catch (error) {
      await page.screenshot({ path: resolve(out, 'failure.png') }).catch(() => {});
      report[name] = { ...report[name], failure: error.stack, errors };
      console.error(`FAIL core/${name}: ${error.message}`);
      process.exitCode = 1;
    } finally {
      await page.close();
      await writeFile(resolve(output, 'browser-report.json'), JSON.stringify(report, null, 2));
    }
  }
} finally {
  await browser.close();
}
