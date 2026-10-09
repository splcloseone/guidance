import assert from 'node:assert/strict';
import { resolve } from 'node:path';
export async function test({ page, out }) {
  const pad=async(index,predicate)=>{await page.evaluate(i=>window.__TEST_GAMEPAD__.button(i,true),index);await page.waitForFunction(predicate);await page.evaluate(i=>window.__TEST_GAMEPAD__.button(i,false),index);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));};
  const snapshot=()=>page.evaluate(()=>window.__SOURCE_DEBUG__.snapshot());
  await page.locator('#open-clay').click();
  await page.waitForSelector('#clay-dialog[open]');
  const ball=(await snapshot()).creation.solid.data;
  await page.locator('#clay-tool').selectOption('add');
  const box=await page.locator('#clay-canvas').boundingBox();
  await page.mouse.move(box.x+box.width*.5,box.y+box.height*.45);await page.mouse.down();
  await page.mouse.move(box.x+box.width*.59,box.y+box.height*.40,{steps:8});await page.mouse.up();
  const edited=(await snapshot()).creation.solid.data;
  assert.notEqual(edited,ball,'actual pointer strokes must edit solid volume');
  await page.locator('#clay-undo').click();assert.equal((await snapshot()).creation.solid.data,ball);
  await page.locator('#clay-redo').click();assert.equal((await snapshot()).creation.solid.data,edited);
  await page.locator('#clay-dialog summary').click();
  await page.locator('#clay-stamp').focus();
  await page.evaluate(()=>window.__CLAY_BEFORE_STAMP__=window.__SOURCE_DEBUG__.snapshot().creation.solid.data);
  await pad(0,()=>window.__SOURCE_DEBUG__.snapshot().creation.solid.data!==window.__CLAY_BEFORE_STAMP__);

  await page.locator('#clay-pants').click();assert.equal((await snapshot()).creation.solid.purpose,'armor');
  await page.screenshot({path:resolve(out,'solid-pants.png')});
  const pants=(await snapshot()).creation.solid.data;
  await page.locator('#clay-close').click();await page.locator('#save-creation').click();
  await page.reload();await page.waitForFunction(()=>window.__SOURCE_DEBUG__);
  assert.equal((await snapshot()).creation.solid.data,pants,'solid survives autosave/reload');
  await page.locator('#enter-ground').click();
  await page.keyboard.press('Digit5');
  await page.waitForFunction(()=>window.__SOURCE_DEBUG__.snapshot().combat.weapon==='sword');
  await page.keyboard.press('KeyN');await page.keyboard.press('KeyC');
  await page.waitForFunction(()=>{const c=window.__SOURCE_DEBUG__.snapshot().combat;return c.wearing&&c.spiking;});
  // Freeze only the scheduled counter so this check observes outgoing hit feedback.
  await page.evaluate(()=>window.__SOURCE_DEBUG__.simulation.combat.counterAt=Infinity);
  await page.locator('#game-canvas').click({position:{x:700,y:600}});
  await page.waitForFunction(()=>window.__SOURCE_DEBUG__.snapshot().actors.find(a=>a.id==='practice-rival').health<100);
  const hit=await snapshot();assert.equal(hit.actors.find(a=>a.id==='practice-rival').health,70);
  await page.waitForSelector('.damage-number');
  await page.screenshot({path:resolve(out,'spike-sword-hit.png')});
  await page.evaluate(()=>{const s=window.__SOURCE_DEBUG__.simulation;s.combat.counterAt=0;});
  await page.waitForFunction(()=>window.__SOURCE_DEBUG__.snapshot().health<100);
  assert.ok(Math.abs((await snapshot()).health-94.6)<.01,'armor and aura reduce a real counter hit');
  await page.waitForSelector('.damage-number.protected');
  await page.evaluate(()=>window.__SOURCE_DEBUG__.simulation.combat.counterAt=Infinity);
  // Controller B spikes without opening meditation; D-pad down changes equipment.
  await page.evaluate(()=>window.__TEST_GAMEPAD__.button(1,true));await page.waitForFunction(()=>!window.__SOURCE_DEBUG__.snapshot().combat.spiking);await page.evaluate(()=>window.__TEST_GAMEPAD__.button(1,false));assert.equal((await snapshot()).meditating,false);
  await page.waitForFunction(()=>!window.__SOURCE_DEBUG__.snapshot().combat.attack);
  await pad(13,()=>window.__SOURCE_DEBUG__.snapshot().combat.weapon==='tether');
  await pad(13,()=>window.__SOURCE_DEBUG__.snapshot().combat.weapon==='fists');
  // Start a fresh melee scenario via controller chord, then RT lands an ordinary sword hit.
  await page.evaluate(()=>window.__TEST_GAMEPAD__.button(6,true));await pad(14,()=>window.__SOURCE_DEBUG__.snapshot().combat.weapon==='sword');await page.evaluate(()=>window.__TEST_GAMEPAD__.button(6,false));
  await page.waitForFunction(()=>window.__SOURCE_DEBUG__.snapshot().combat.weapon==='sword');
  await page.evaluate(()=>window.__SOURCE_DEBUG__.simulation.combat.counterAt=Infinity);
  await pad(7,()=>!!window.__SOURCE_DEBUG__.snapshot().combat.attack);
  await page.waitForFunction(()=>window.__SOURCE_DEBUG__.snapshot().actors.find(a=>a.id==='practice-rival').health===80);
  await page.keyboard.press('KeyM');await page.waitForFunction(()=>window.__SOURCE_DEBUG__.snapshot().meditating);assert.equal((await snapshot()).combat.spiking,false);assert.equal((await snapshot()).combat.wearing,false);
  await page.locator('#open-clay').click();await page.locator('#clay-sword').click();await page.locator('#clay-close').click();await page.locator('#enter-ground').click();
  await page.keyboard.press('KeyN');await page.waitForFunction(()=>window.__SOURCE_DEBUG__.snapshot().combat.manifested);assert.equal((await snapshot()).combat.manifested,true);assert.equal((await snapshot()).combat.weapon,'source-sword');
  await page.screenshot({path:resolve(out,'created-sword.png')});
  return {pointerSculpt:true,undoRedo:true,solidPersistence:true,wearableArmor:true,physicalSwordDamage:30,controllerSwordDamage:20,createdSword:true};
}
