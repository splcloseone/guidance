import assert from 'node:assert/strict';

const creation = page => page.evaluate(() => window.__SOURCE_DEBUG__.snapshot().creation);
async function trace(page, selector) {
  const target = page.locator(selector);
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  const s = Math.min(box.width, box.height) / 3.5;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y); await page.mouse.down();
  for (const [dx,dy] of [[0,.8],[.7,.8],[.7,.3],[.3,.3]]) await page.mouse.move(x + dx*s, y - dy*s, {steps:6});
  await page.mouse.up();
}

export async function test({page,out}) {
  await page.locator('[data-preset="orb"]').click();
  assert(await page.locator('#shape-panel').isVisible(), 'Choosing a ball exposes its editor');
  const initial = await creation(page);
  await trace(page, '#creation-preview');
  const drawn = await creation(page);
  assert.equal(drawn.form, 'hook'); assert.equal(drawn.id, initial.id);
  assert(drawn.shape.points.some(p => p[0] > .6 && p[1] > .6), 'The traced bend is present');
  assert(drawn.shape.points.at(-1)[0] > .2);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('the-source.creation.v1'))?.form === 'hook');
  await page.reload(); await page.waitForFunction(() => window.__SOURCE_DEBUG__);
  assert.deepEqual((await creation(page)).shape.points, drawn.shape.points, 'The actual stroke autosaves');
  await page.locator('#assign-slot').click();
  await page.locator('#enter-ground').click();
  await page.evaluate(() => window.__SOURCE_DEBUG__.aimAt('frame-0-anchor-0'));
  await page.keyboard.press('KeyF');
  await page.waitForFunction(() => window.__SOURCE_DEBUG__.snapshot().hook?.bodyId === 'frame-0-anchor-0');
  assert.deepEqual((await page.evaluate(()=>window.__SOURCE_DEBUG__.snapshot().hook.definition)).shape.points, drawn.shape.points);
  await page.locator('#meditate-toggle').click();
  await page.locator('[data-preset="orb"]').click();
  await trace(page, '#shape-canvas');
  assert.equal((await creation(page)).form, 'hook', 'The editor also draws directly from the ball');
  await page.screenshot({path:`${out}/drawn-from-ball.png`});
  await page.locator('[data-preset="orb"]').click();
  await page.locator('#stretch-creation').click();
  const strand = await creation(page);
  assert(strand.shape.points.every(p => p[0] === 0), 'Button stretching gives raw straight material');
  await page.locator('#shape-point').selectOption(String(strand.shape.points.length - 1));
  await page.locator('#shape-x').focus();
  await page.keyboard.press('ArrowRight');
  assert((await creation(page)).shape.points.at(-1)[0] > 0, 'Keyboard can bend the blank strand');
  return {previewDrawing:true,editorDrawing:true,autoOpened:true,tracedGeometrySaved:true,drawnCreationCaughtAnchor:true,keyboardStrandBending:true};
}
