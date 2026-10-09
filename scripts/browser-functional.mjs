import assert from 'node:assert/strict';
import {pixelStats, tapGamepad} from './browser-utils.mjs';
export async function test({page,out}) {
 const results={};
 results.pixels=await pixelStats(page);
 await page.waitForFunction(()=>window.__SOURCE_DEBUG__?.snapshot);
 results.initial=await page.evaluate(()=>window.__SOURCE_DEBUG__.snapshot());
 const open=()=>page.evaluate(()=>document.body.classList.contains('meditating'));
 if(!await open()) await page.locator('#meditate-toggle').click();
 await page.locator('#creation-name').fill('Silver Voyager');
 await page.locator('#reach').evaluate(el=>el.value='36');
 await page.locator('#reach').dispatchEvent('input');
 await page.locator('#reel-speed').evaluate(el=>el.value='10');
 await page.locator('#reel-speed').dispatchEvent('input');
 await page.locator('#strength').evaluate(el=>el.value='4');
 await page.locator('#strength').dispatchEvent('input');
 await page.locator('#hook-size').evaluate(el=>el.value='1.4');
 await page.locator('#hook-size').dispatchEvent('input');
 await page.locator('[data-color]').last().click();
 await page.locator('#save-creation').click();
 results.saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('the-source.creation.v1')));
 assert.equal(results.saved.name,'Silver Voyager');assert.equal(results.saved.reach,36);assert.equal(results.saved.reelSpeed,10);assert.equal(results.saved.strength,4);assert.equal(results.saved.hookSize,1.4);
 await page.screenshot({path:`${out}/meditation-saved.png`,fullPage:true});
 await page.reload({waitUntil:'networkidle'});await page.waitForTimeout(500);
 assert.equal(await page.locator('#creation-name').inputValue(),'Silver Voyager');
 assert.equal(await page.locator('#reach').inputValue(),'36');
 results.persistence=true;
 if(await open()) await page.locator('#enter-ground').click();
 await page.locator('#game-canvas').count().then(async n=>{if(n)await page.locator('#game-canvas').click({position:{x:720,y:600}});});
 const snapshot=()=>page.evaluate(()=>window.__SOURCE_DEBUG__.snapshot());
 const before=await snapshot();
 await page.keyboard.down('KeyW');await page.waitForTimeout(700);await page.keyboard.up('KeyW');
 const after=await snapshot();results.keyboard={before,after};
 await page.keyboard.press('KeyM');await page.waitForFunction(()=>document.body.classList.contains('meditating'));assert(await open(),'M opens meditation');
 await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.body.classList.contains('meditating'));assert(!await open(),'Escape closes meditation');
 await page.locator('#guide-toggle').click();assert(await page.locator('#guide-dialog').isVisible());
 await page.locator('#guide-close').click();
 results.guide=true;
 if(await page.evaluate(()=>!!window.__TEST_GAMEPAD__)) {
  const beforePad=await snapshot();
  await page.evaluate(()=>window.__TEST_GAMEPAD__.axis(0,1));await page.waitForTimeout(700);await page.evaluate(()=>window.__TEST_GAMEPAD__.reset());
  results.controller={before:beforePad,after:await snapshot()};
  await tapGamepad(page,3,800);await page.waitForFunction(()=>document.body.classList.contains('meditating'));assert(await open(),'Y opens meditation');
  await tapGamepad(page,1,800);await page.waitForFunction(()=>!document.body.classList.contains('meditating'));assert(!await open(),'B closes meditation');
  results.controller.toggle=true;
 }
 await page.screenshot({path:`${out}/gameplay.png`,fullPage:true});
 return results;
}
