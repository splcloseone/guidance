import assert from 'node:assert/strict';
export async function test({page,out}) {
 const results={};
 const button=async(index,predicate)=>{
  await page.evaluate(i=>window.__TEST_GAMEPAD__.button(i,true),index);
  await page.waitForFunction(predicate,null,{timeout:5000});
  await page.evaluate(i=>window.__TEST_GAMEPAD__.button(i,false),index);
  await page.waitForTimeout(600);
 };
 await button(8,()=>document.body.classList.contains('map-expanded'));
 await button(1,()=>!document.body.classList.contains('map-expanded'));
 await button(9,()=>document.getElementById('guide-dialog').open);
 await button(1,()=>!document.getElementById('guide-dialog').open);
 await button(3,()=>!document.body.classList.contains('meditating'));
 const before=await page.evaluate(()=>window.__SOURCE_DEBUG__.snapshot().player.position);
 await page.evaluate(()=>window.__TEST_GAMEPAD__.axis(0,1));
 await page.waitForFunction(p=>{const q=window.__SOURCE_DEBUG__.snapshot().player.position;return Math.hypot(q[0]-p[0],q[2]-p[2])>1;},before);
 await page.evaluate(()=>window.__TEST_GAMEPAD__.reset());
 const camera=await page.evaluate(()=>window.__SOURCE_DEBUG__.snapshot().camera.yaw);
 await page.evaluate(()=>window.__TEST_GAMEPAD__.axis(2,.8));
 await page.waitForFunction(y=>Math.abs(window.__SOURCE_DEBUG__.snapshot().camera.yaw-y)>.1,camera);
 await page.evaluate(()=>window.__TEST_GAMEPAD__.reset());
 await button(3,()=>document.body.classList.contains('meditating'));
 results.controllerMenusAndMovement=true;
 await page.setViewportSize({width:860,height:480});await page.screenshot({path:`${out}/landscape.png`});
 assert(await page.locator('#enter-ground').isVisible());
 await page.setViewportSize({width:1440,height:900});await page.screenshot({path:`${out}/final-meditation.png`});
 return results;
}
