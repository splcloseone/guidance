import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { pixelStats } from './browser-utils.mjs';

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
});
const errors = [], network = [];
const out = resolve('test-results/standalone');
await mkdir(out, { recursive: true });
const playableFile = process.env.PLAYABLE_FILE || 'releases/The-Source.html';
const playablePath = process.env.PLAYABLE_PATH || '/';
const html = await readFile(resolve(playableFile));
const server = createServer((request, response) => {
  if(request.url!==playablePath) { response.writeHead(404);response.end();return; }
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });response.end(html);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = `http://127.0.0.1:${server.address().port}${playablePath}`;
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url())) network.push(request.url()); });
  // Managed Chromium prohibits file://. Serve only the exact standalone file,
  // then disconnect networking for all play interactions.
  await page.goto(address);
  await page.waitForFunction(() => document.getElementById('loading-state').hidden);
  await context.setOffline(true);
  assert.equal(await page.locator('#error-state').isVisible(), false);
  const pixels = await pixelStats(page, '#game-canvas');
  await page.locator('#creation-name').fill('Offline Voyager');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('the-source.creation.v1'))?.name === 'Offline Voyager');
  await page.locator('#enter-ground').click();
  assert.equal(await page.locator('body').evaluate(node => node.classList.contains('meditating')), false);
  const before = await page.locator('#minimap').evaluate(canvas => canvas.toDataURL());
  await page.keyboard.down('KeyW');
  await page.waitForFunction(image => document.getElementById('minimap').toDataURL() !== image, before);
  await page.keyboard.up('KeyW');
  await page.keyboard.press('KeyH');
  await page.waitForFunction(() => document.getElementById('guide-dialog').open);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.getElementById('guide-dialog').open);
  await context.setOffline(false);
  await page.reload();
  await page.waitForFunction(() => document.getElementById('loading-state').hidden);
  assert.equal(await page.locator('#creation-name').inputValue(), 'Offline Voyager');
  await context.setOffline(true);
  await page.locator('#open-clay').click();await page.locator('#clay-pants').click();
  await page.locator('#clay-close').click();await page.locator('#save-creation').click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('the-source.creation.v1'))?.solid?.purpose==='armor');
  await page.locator('#slot-destination').selectOption('2');await page.locator('#assign-slot').click();
  await page.locator('#enter-ground').click();await page.locator('#practice-melee').click();
  await page.keyboard.press('Digit3');await page.keyboard.press('KeyC');
  await page.waitForFunction(()=>document.getElementById('combat-status').textContent.includes('WHITE AURA')&&document.getElementById('combat-status').textContent.includes('armor active'));
  await page.locator('#game-canvas').click({position:{x:640,y:520}});
  await page.waitForFunction(()=>Number(document.getElementById('target-health').value)<100);
  await page.waitForSelector('.damage-number');
  await page.screenshot({ path: resolve(out, 'offline-play.png') });
  assert.deepEqual(errors, []);
  assert(network.every(url => url === address), 'Standalone file must not request any other assets');
  const result = { passed: true, playableFile, playablePath, mode: 'standalone HTML loaded from isolated local server; offline gameplay', directFileNavigation: 'not tested: cloud browser policy blocks file URLs', pixels, autosaveReload: true, offlineClayArmorAndSwordDamage: true, keyboardMovement: true, guide: true, errors, requestedAssets: network.filter(url=>url!==address) };
  await writeFile(resolve(out, 'report.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
