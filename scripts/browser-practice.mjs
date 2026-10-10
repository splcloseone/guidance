import assert from 'node:assert/strict';
import { disengage } from './browser-utils.mjs';

const snapshot = page => page.evaluate(() => window.__SOURCE_DEBUG__.snapshot());
const actorFrom = (state, id) => state.actors.find(actor => actor.id === id);
async function frames(page, count = 2) {
  await page.evaluate(count => new Promise(resolve => {
    const tick = () => { if (--count <= 0) resolve(); else requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }), count);
}
async function padAction(page, index, predicate) {
  await page.evaluate(i => window.__TEST_GAMEPAD__.button(i, true), index);
  try { await page.waitForFunction(predicate, null, { timeout: 15000 }); }
  finally { await page.evaluate(i => window.__TEST_GAMEPAD__.button(i, false), index); }
  await frames(page);
}
async function aim(page, id) {
  assert(await page.evaluate(id => window.__SOURCE_DEBUG__.aimAt(id), id), `Target ${id} exists`);
  await frames(page);
}
async function scenario(page, name) {
  await disengage(page);
  await page.locator(`#practice-${name}`).click();
  await page.waitForFunction(() => !document.body.classList.contains('meditating'));
  await page.locator('#game-canvas').focus();
  await frames(page);
}

export async function test({ page, out }) {
  const results = {};
  await page.locator('[data-preset="lasso"]').click();
  await page.locator('#assign-slot').click();
  await page.locator('#enter-ground').click();
  await scenario(page, 'rival');
  await aim(page, 'practice-rival');
  await page.keyboard.press('KeyF');
  await page.waitForFunction(() => window.__SOURCE_DEBUG__.snapshot().hook?.actorId === 'practice-rival');
  const caught = await snapshot(page);
  assert(actorFrom(caught, 'practice-rival').caught);
  assert(caught.source < 100, 'Catching a character spends the Source');
  const before = actorFrom(caught, 'practice-rival').position;
  await page.keyboard.down('KeyQ');
  try {
    await page.waitForFunction(p => {
      const actor = window.__SOURCE_DEBUG__.snapshot().actors.find(actor => actor.id === 'practice-rival');
      return Math.hypot(actor.position[0] - p[0], actor.position[2] - p[2]) > 1;
    }, before, { timeout: 15000 });
  } finally { await page.keyboard.up('KeyQ'); }
  results.drag = await snapshot(page);
  assert(results.drag.hook, 'The tether remains connected during dragging');
  await page.keyboard.press('KeyT');
  await page.waitForFunction(() => window.__SOURCE_DEBUG__.snapshot().hook?.stage === 'lifted');
  await page.waitForFunction(() => window.__SOURCE_DEBUG__.snapshot().actors.find(actor => actor.id === 'practice-rival').position[1] > 1.6);
  const lifted = await snapshot(page);
  assert.equal(actorFrom(lifted, 'practice-rival').health, 100, 'Lifting alone does not inflict slam damage');
  const firstLiftAt = await page.evaluate(() => window.__SOURCE_DEBUG__.simulation.elapsed);
  await page.waitForFunction(time => window.__SOURCE_DEBUG__.simulation.elapsed > time + 0.5, firstLiftAt);
  await page.keyboard.press('KeyT');
  await page.waitForFunction(() => window.__SOURCE_DEBUG__.snapshot().actors.find(actor => actor.id === 'practice-rival').health < 100);
  results.slam = await snapshot(page);
  await page.screenshot({ path: `${out}/rival-slam.png` });

  // Friendly consent is tested on the same physical target before allowing it.
  await page.locator('#practice-friendly-hooks').uncheck();
  await scenario(page, 'rescue');
  await aim(page, 'practice-ally');
  await page.keyboard.press('KeyF');
  await page.waitForFunction(() => /friendly|allow|consent/i.test(document.querySelector('#toast')?.textContent || ''));
  assert.equal((await snapshot(page)).hook, null, 'Friendly hooks disabled means no attachment');
  await page.locator('#practice-friendly-hooks').check();
  await scenario(page, 'rescue');
  await aim(page, 'practice-ally');
  await page.keyboard.press('KeyF');
  await page.waitForFunction(() => window.__SOURCE_DEBUG__.snapshot().hook?.actorId === 'practice-ally');
  await page.keyboard.down('KeyQ');
  try {
    await page.waitForFunction(() => window.__SOURCE_DEBUG__.snapshot().actors.find(actor => actor.id === 'practice-ally').rescued, null, { timeout: 20000 });
  } finally { await page.keyboard.up('KeyQ'); }
  results.rescue = await snapshot(page);
  assert.equal(actorFrom(results.rescue, 'practice-ally').health, 100, 'A friendly rescue does not deal slam damage');
  await page.screenshot({ path: `${out}/ally-rescue.png` });

  // Controller X must follow the same actual interaction path as keyboard T.
  await page.locator('#meditate-toggle').click();
  await page.waitForFunction(() => window.__SOURCE_DEBUG__.snapshot().source > 95);
  await page.locator('#enter-ground').click();
  await scenario(page, 'rival');
  await aim(page, 'practice-rival');
  await padAction(page, 7, () => window.__SOURCE_DEBUG__.snapshot().hook?.actorId === 'practice-rival');
  await padAction(page, 2, () => window.__SOURCE_DEBUG__.snapshot().hook?.stage === 'lifted');
  await page.waitForFunction(() => window.__SOURCE_DEBUG__.snapshot().actors.find(actor => actor.id === 'practice-rival').position[1] > 1.6);
  // A cooldown prevents two actions on the same frame; wait for it in simulation time.
  const liftedAt = await page.evaluate(() => window.__SOURCE_DEBUG__.simulation.elapsed);
  await page.waitForFunction(time => window.__SOURCE_DEBUG__.simulation.elapsed >= time + 0.5, liftedAt);
  await padAction(page, 2, () => window.__SOURCE_DEBUG__.snapshot().actors.find(actor => actor.id === 'practice-rival').health < 100);
  results.controllerSlam = true;

  await scenario(page, 'breakout');
  await page.waitForFunction(() => window.__SOURCE_DEBUG__.snapshot().incomingTether);
  const starting = await snapshot(page);
  assert(starting.incomingTether.requiredPresses >= 4 && starting.incomingTether.requiredPresses <= 10, 'Escape now takes a short sequence of deliberate taps');
  // Holding R3 must not auto-repeat accepted struggle presses.
  await page.evaluate(() => window.__TEST_GAMEPAD__.button(11, true));
  await page.waitForFunction(() => window.__SOURCE_DEBUG__.snapshot().incomingTether?.acceptedPresses >= 1);
  const holdStart = await page.evaluate(() => window.__SOURCE_DEBUG__.simulation.elapsed);
  await page.waitForFunction(time => window.__SOURCE_DEBUG__.simulation.elapsed > time + 1, holdStart);
  const held = await snapshot(page);
  assert(held.incomingTether, 'Holding the button must not escape');
  assert.equal(held.incomingTether.acceptedPresses, 1, 'Only the first held press counts');
  await page.evaluate(() => window.__TEST_GAMEPAD__.button(11, false));
  await frames(page);
  let taps = 0;
  for (; taps < 60 && (await snapshot(page)).incomingTether; taps++) {
    // Allow the simulation rate limit and a released input frame between edges.
    const time = await page.evaluate(() => window.__SOURCE_DEBUG__.simulation.elapsed);
    await page.waitForFunction(time => window.__SOURCE_DEBUG__.simulation.elapsed > time + 0.13, time);
    const previous = (await snapshot(page)).incomingTether?.acceptedPresses;
    if (previous === undefined) break;
    await page.evaluate(() => window.__TEST_GAMEPAD__.button(11, true));
    await page.waitForFunction(previous => {
      const tether = window.__SOURCE_DEBUG__.snapshot().incomingTether;
      return !tether || tether.acceptedPresses > previous;
    }, previous);
    await page.evaluate(() => window.__TEST_GAMEPAD__.button(11, false));
    await frames(page);
  }
  assert.equal((await snapshot(page)).incomingTether, null, 'Repeated controller taps eventually break the tether');
  assert(taps >= 3 && taps <= 15, 'Escape is easier while still requiring multiple presses');
  results.controllerEscape = { taps, requiredPresses: starting.incomingTether.requiredPresses };
  await page.screenshot({ path: `${out}/escaped.png` });
  return results;
}
