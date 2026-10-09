import assert from 'node:assert/strict';
import { pixelStats } from './browser-utils.mjs';

const readCreation = page => page.evaluate(() => window.__SOURCE_DEBUG__.snapshot().creation);
async function range(page, id, value) {
  await page.locator(`#${id}`).evaluate((element, value) => {
    element.value = String(value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}
async function openPanel(page, id, button) {
  if (!await page.locator(`#${id}`).isVisible()) await page.locator(`#${button}`).click();
}

export async function test({ page, out }) {
  const results = {};
  // A blank ball becomes functional only after a shaping operation.
  await page.locator('[data-preset="orb"]').click();
  const orb = await readCreation(page);
  assert.equal(orb.form, 'orb');
  await page.locator('#stretch-creation').click();
  const hook = await readCreation(page);
  assert.equal(hook.form, 'hook');
  assert(hook.shape.points.length >= 3, 'A shaped hook has editable control points');
  results.ballToHook = true;

  await page.locator('[data-preset="lasso"]').click();
  const lasso = await readCreation(page);
  assert.equal(lasso.form, 'lasso');
  assert.notDeepEqual(lasso.shape.points, hook.shape.points, 'Presets use different geometry');

  await openPanel(page, 'shape-panel', 'shape-toggle');
  await page.locator('#shaping-assistance').uncheck();
  await page.locator('#shape-point').selectOption('1');
  const beforeShape = await readCreation(page);
  const editedX = beforeShape.shape.points[1][0] > 0 ? -0.55 : 0.55;
  await range(page, 'shape-x', editedX);
  await range(page, 'shape-thickness', 0.09);
  const edited = await readCreation(page);
  assert.equal(edited.shape.assisted, false);
  assert(Math.abs(edited.shape.points[1][0] - editedX) < 0.05, 'Direct point controls change saved geometry');
  assert(Math.abs(edited.shape.thickness - 0.09) < 0.015);
  const canvas = page.locator('#shape-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const rect = await canvas.boundingBox();
  const scale = Math.min(rect.width, rect.height) / 3.5;
  const point = edited.shape.points[0];
  const x = rect.x + rect.width / 2 + point[0] * scale;
  const y = rect.y + rect.height / 2 - point[1] * scale;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 12, y + 9, { steps: 4 });
  await page.mouse.up();
  assert.notDeepEqual((await readCreation(page)).shape.points[0], point, 'Dragging a control point changes the creation');
  results.pointerShaping = true;
  const oldCount = edited.shape.points.length;
  await page.locator('#shape-add-point').click();
  assert.equal((await readCreation(page)).shape.points.length, oldCount + 1);
  await page.locator('#shape-remove-point').click();
  assert.equal((await readCreation(page)).shape.points.length, oldCount);
  await page.locator('#creation-name').fill('Tidebound Rescue Loop');
  await page.locator('#save-creation').click();
  results.edited = await readCreation(page);
  results.preview = await pixelStats(page, '#creation-preview');
  await page.screenshot({ path: `${out}/custom-lasso.png` });

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__SOURCE_DEBUG__);
  const restored = await readCreation(page);
  assert.equal(restored.name, 'Tidebound Rescue Loop');
  assert.equal(restored.form, 'lasso');
  assert.equal(restored.shape.assisted, false);
  assert.deepEqual(restored.shape.points, results.edited.shape.points);
  results.reload = true;
  await page.locator('[data-preset="hook"]').click();
  await openPanel(page, 'library-panel', 'library-toggle');
  const savedOption = page.locator('#creation-library option').filter({ hasText: 'Tidebound Rescue Loop' });
  assert.equal(await savedOption.count(), 1, 'Explicit save adds one named design to the library');
  await page.locator('#creation-library').selectOption(await savedOption.getAttribute('value'));
  await page.locator('#library-load').click();
  assert.deepEqual((await readCreation(page)).shape.points, results.edited.shape.points, 'Loading a saved design restores its edited geometry');
  results.library = true;

  // Text assistance must produce a supported editable design, and give honest
  // feedback for an unsupported creature rather than pretending it is playable.
  await openPanel(page, 'description-panel', 'description-toggle');
  await page.locator('#creation-description').fill('A purple long lasso');
  await page.locator('#describe-creation').click();
  const described = await readCreation(page);
  assert.equal(described.form, 'lasso');
  assert.notEqual(described.color.toLowerCase(), '#8fdcc8');
  assert((await page.locator('#description-status').textContent()).trim());
  results.described = described;
  await page.locator('#creation-description').fill('A horse I can ride');
  await page.locator('#describe-creation').click();
  const unsupported = await page.locator('#description-status').textContent();
  assert(/not|later|future|support|available|hook|lasso/i.test(unsupported), 'Unsupported designs explain the current limits');
  assert.notEqual((await readCreation(page)).form, 'horse');
  results.unsupportedFeedback = unsupported;
  await page.screenshot({ path: `${out}/description-assistance.png` });
  return results;
}
