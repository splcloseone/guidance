import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {installGamepad,pixelStats} from './browser-utils.mjs';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const out='test-results/prototype3',report={};await mkdir(out,{recursive:true});
const url=process.env.APP_URL||'http://127.0.0.1:5173';
async function run(name,options,fn){
 const context=await browser.newContext(options),page=await context.newPage(),errors=[];page.setDefaultTimeout(45000);
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await installGamepad(page);
 try{await page.goto(url,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__SOURCE_DEBUG__);await fn(page,context);assert.deepEqual(errors,[]);report[name]={passed:true,errors};console.log(`PASS prototype3/${name}`);}
 catch(e){report[name]={passed:false,error:e.stack,errors};await page.screenshot({path:`${out}/${name}-failure.png`});console.error(e);process.exitCode=1;}
 finally{await context.close();await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));}
}
const snap=page=>page.evaluate(()=>window.__SOURCE_DEBUG__.snapshot());
async function pad(page,index,predicate){await page.evaluate(i=>window.__TEST_GAMEPAD__.button(i,true),index);await page.waitForFunction(predicate);await page.evaluate(i=>window.__TEST_GAMEPAD__.button(i,false),index);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
try{
 await run('desktop',{viewport:{width:1440,height:1000}},async page=>{
  await pixelStats(page,'#game-canvas');assert.equal(await page.evaluate(()=>window.__SOURCE_DEBUG__.visuals().orb),true);
  await page.locator('[data-catalog=scythe]').click();await page.locator('#slot-destination').selectOption('3');await page.locator('#assign-slot').click();
  const slots=await page.evaluate(()=>localStorage.getItem('the-source.loadout.v1'));
  await page.locator('#save-creation').click();await page.reload();await page.waitForFunction(()=>window.__SOURCE_DEBUG__);
  assert.equal(await page.evaluate(()=>localStorage.getItem('the-source.loadout.v1')),slots);
  await page.screenshot({path:`${out}/meditation-orb.png`});
  await page.locator('#enter-ground').click();await page.locator('#practice-combo').click();
  const before=(await snap(page)).player.position;
  await page.keyboard.press('KeyF');await page.waitForFunction(()=>!!window.__SOURCE_DEBUG__.snapshot().hook?.autoReel);
  await page.keyboard.press('KeyM');await page.waitForFunction(()=>document.getElementById('toast').textContent.includes('locked'));
  assert.equal((await snap(page)).meditating,false);
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal((await snap(page)).meditating,false);
  await page.waitForFunction(()=>{const s=window.__SOURCE_DEBUG__.snapshot(),a=s.actors.find(a=>a.id==='practice-rival');return Math.hypot(a.position[0]-s.player.position[0],a.position[2]-s.player.position[2])<2.4;});
  const after=(await snap(page)).player.position;assert.ok(Math.hypot(before[0]-after[0],before[2]-after[2])<.5);
  await page.keyboard.press('Digit2');await page.waitForFunction(()=>window.__SOURCE_DEBUG__.snapshot().combat.weapon==='sword');
  await page.keyboard.press('KeyC');await page.waitForFunction(()=>window.__SOURCE_DEBUG__.snapshot().combat.spiking);
  assert.equal(await page.evaluate(()=>window.__SOURCE_DEBUG__.visuals().aura),true);
  await page.screenshot({path:`${out}/white-aura.png`});
  await page.locator('#game-canvas').click({position:{x:720,y:500}});
  for(let i=0;i<3;i++){
    await page.waitForFunction(i=>{const a=window.__SOURCE_DEBUG__.snapshot().combat.attack;return a?.index===i&&a.t>=.1;},i);
    await page.locator('#game-canvas').click({position:{x:720,y:500}});
  }
  await page.waitForFunction(()=>window.__SOURCE_DEBUG__.snapshot().actors.find(a=>a.id==='practice-rival').health<=0);
  await page.waitForSelector('.damage-number');await page.screenshot({path:`${out}/heavy-finish.png`});
  await page.evaluate(()=>window.__SOURCE_DEBUG__.checkpoint());await page.reload();await page.waitForFunction(()=>window.__SOURCE_DEBUG__);
  assert.equal((await snap(page)).meditating,false,'reload must preserve the combat lock');
  await pad(page,13,()=>window.__SOURCE_DEBUG__.snapshot().selectedSlot===3&&window.__SOURCE_DEBUG__.snapshot().combat.manifested);
  await pad(page,12,()=>window.__SOURCE_DEBUG__.snapshot().combat.wearing);
  await pad(page,4,()=>!window.__SOURCE_DEBUG__.snapshot().combat.wearing);
  assert.equal((await snap(page)).combat.manifested,true,'dismissing armor keeps the weapon');
  await pad(page,15,()=>window.__SOURCE_DEBUG__.snapshot().combat.weapon==='sword');
  await pad(page,7,()=>!!window.__SOURCE_DEBUG__.snapshot().combat.attack);
 });
 await run('mobile',{viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1},async(page,context)=>{
  assert.equal(await page.evaluate(()=>window.__SOURCE_DEBUG__.visuals().orb),true);
  await page.screenshot({path:`${out}/phone-meditation.png`});
  await page.locator('#enter-ground').tap();await page.locator('#practice-menu-toggle').tap();await page.locator('#practice-combo').tap();
  await page.locator('#touch-attack').tap();await page.waitForFunction(()=>!!window.__SOURCE_DEBUG__.snapshot().hook);
  await page.waitForFunction(()=>{const s=window.__SOURCE_DEBUG__.snapshot(),a=s.actors.find(a=>a.id==='practice-rival');return Math.hypot(a.position[0]-s.player.position[0],a.position[2]-s.player.position[2])<2.4;});
  await page.locator('[data-slot="1"]').tap();await page.waitForFunction(()=>window.__SOURCE_DEBUG__.snapshot().combat.weapon==='sword');
  await page.locator('[data-touch-action=spike]').tap();await page.waitForFunction(()=>window.__SOURCE_DEBUG__.snapshot().combat.spiking);
  await page.locator('#touch-attack').tap();
  for(let i=0;i<3;i++){await page.waitForFunction(i=>{const a=window.__SOURCE_DEBUG__.snapshot().combat.attack;return a?.index===i&&a.t>=.1;},i);await page.locator('#touch-attack').tap();}
  await page.waitForFunction(()=>window.__SOURCE_DEBUG__.snapshot().actors.find(a=>a.id==='practice-rival').health<=0);
  await page.screenshot({path:`${out}/phone-combo.png`});
  await page.waitForFunction(()=>!window.__SOURCE_DEBUG__.snapshot().inCombat);
  await page.locator('#practice-menu-toggle').tap();await page.locator('#practice-breakout').tap();
  await page.waitForFunction(()=>!!window.__SOURCE_DEBUG__.snapshot().incomingTether);
  let taps=0;
  while((await snap(page)).incomingTether&&taps<15){
    const elapsed=await page.evaluate(()=>window.__SOURCE_DEBUG__.simulation.elapsed);
    await page.waitForFunction(t=>window.__SOURCE_DEBUG__.simulation.elapsed>t+.13,elapsed);
    await page.locator('#touch-struggle').tap();taps++;
  }
  assert.equal((await snap(page)).incomingTether,null,'touch taps break the incoming tether');
  assert.ok(taps>=4&&taps<=12,'touch breakout takes a short sequence of deliberate taps');
  const cdp=await context.newCDPSession(page),r=await page.locator('#touch-stick').boundingBox();
  const x=r.x+r.width/2,y=r.y+r.height/2,start=await snap(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+38,y,id:1}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x+38,y,id:1},{x:200,y:310,id:2}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+38,y,id:1},{x:245,y:310,id:2}]});
  await page.waitForFunction(p=>{const s=window.__SOURCE_DEBUG__.snapshot();return Math.abs(s.camera.yaw-p.camera.yaw)>.05&&Math.hypot(s.player.position[0]-p.player.position[0],s.player.position[2]-p.player.position[2])>.3;},start);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  await page.setViewportSize({width:844,height:390});await page.screenshot({path:`${out}/phone-landscape.png`});
  for(const selector of ['#touch-attack','#touch-stick','#summon-slots']){const box=await page.locator(selector).boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=844&&box.y+box.height<=390,`${selector} is on screen`);}
 });
}finally{await browser.close();}
