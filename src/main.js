import { loadLoadout } from './loadout.js';
import { initLoadoutUI } from './loadout-ui.js';
import { createSummoningView } from './summoning-view.js';
import { createCombatView } from './combat-view.js';
import { initClayWorkshop } from './clay-workshop.js';
import * as THREE from 'three';
import './style.css';
import { createWorld } from './world.js';
import { solidCosts } from './combat.js';
import { SourceSimulation, tetherCosts } from './simulation.js';
import { createAvatar, createHook } from './models.js';
import { Controls, connectedGamepad } from './controls.js';
import { DEFAULT_CREATION, normalizeCreation, loadCreation, saveCreation } from './creation.js';
import { loadSession, saveSession, restoreSession } from './session.js';
import { initWorkshop } from './workshop.js';
import { createPracticeUI, practiceInstructions } from './practice-ui.js';

const $ = id => document.getElementById(id);
let storage;
try { storage = window.localStorage; } catch { storage = { getItem() { throw new Error('Storage unavailable'); }, setItem() { throw new Error('Storage unavailable'); } }; }
const loaded = loadCreation(storage);
let creation = loaded.creation;
let meditating = true;
let saved = loaded.saved;
let dirty = !loaded.saved;
let projectile = null;
let activeTarget = null;
let lastToast = 0;
let jumpPending = false;
let hookCount = 0;
let swingComplete = false;
let pullComplete = false;
let viewExpanded = false;
let controllerMenuIndex = 0;
let lastPadMenu = [];
let lastMenuAxis = 0;
let autoSaveTimer;
let lastSafePosition = [0, 1.2, 15];
let lastSavedAt = 0;
let workshop, clayWorkshop, combatView, loadoutUI, summoningView;
let runtimeHookSignature='';
const loadedSlots=loadLoadout(storage);
let practiceUI;
let manifestationSignature = '';
let scene, renderer, camera, world, simulation, controls, avatar, rope, hook, previewRenderer, previewScene, previewCamera, previewHook;
let yaw = -.18, pitch = .28;
const cameraTarget = new THREE.Vector3();
const desiredCamera = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
const aim = new THREE.Vector2(0, 0);
const temp = new THREE.Vector3();
const ropePositions = new Float32Array(33 * 3);
const clock = new THREE.Clock();

function toast(message, timeout = 3200) {
  $('toast').textContent = message; $('toast').classList.add('visible');
  clearTimeout(lastToast); lastToast = setTimeout(() => $('toast').classList.remove('visible'), timeout);
}

function setStatus() {
  $('save-status').textContent = !loaded.available ? 'Autosave unavailable · this session only' : dirty ? 'Saving your changes…' : 'Autosaved on this device';
  $('save-status').dataset.state = dirty ? 'unsaved' : 'saved';
}

function applyCreation() {
  creation = normalizeCreation(creation);
  simulation?.setCreation(creation);
  const signature = JSON.stringify([creation.form, creation.shape, creation.solid]);
  if (hook && previewHook && signature !== manifestationSignature) {
    for (const [item, parent] of [[hook, scene], [previewHook, previewScene]]) {
      parent.remove(item.group);
      if (item.dispose) item.dispose();
      else item.group.traverse(object => { object.geometry?.dispose(); if (Array.isArray(object.material)) object.material.forEach(m => m.dispose()); else object.material?.dispose(); });
    }
    hook = createHook(creation); hook.group.visible = false; scene.add(hook.group);
    previewHook = createHook(creation); previewScene.add(previewHook.group);
    manifestationSignature = signature;
  }
  for (const [id, key] of [['reach','reach'],['reel-speed','reelSpeed'],['strength','strength'],['hook-size','hookSize']]) {
    $(id).value = creation[key];
    $(`${id}-value`).textContent = key === 'reach' ? `${creation[key]} m` : key === 'reelSpeed' ? `${creation[key]} m/s` : key === 'hookSize' ? `${Number(creation[key]).toFixed(1)}×` : `${creation[key]} / 5`;
  }
  $('creation-name').value = creation.name;
  $('creation-color').value = creation.color;
  document.querySelectorAll('[data-color]').forEach(button => {
    const selected=button.dataset.color.toLowerCase()===creation.color.toLowerCase();
    button.setAttribute('aria-pressed',String(selected));button.classList.toggle('selected',selected);
  });
  const costs=creation.form==='clay'?solidCosts(creation):tetherCosts(creation);
  $('activation-cost').textContent=costs.activation.toFixed(1);
  $('upkeep-cost').textContent=`${costs.upkeep.toFixed(2)} / sec`;
  document.documentElement.style.setProperty('--source-color', creation.color);
  if (hook) { hook.material.color.set(creation.color); hook.material.emissive.set(creation.color); hook.group.scale.setScalar(creation.hookSize); }
  if (previewHook) { previewHook.material.color.set(creation.color); previewHook.material.emissive.set(creation.color); previewHook.group.scale.setScalar(creation.hookSize * 1.25); }
  if (rope) rope.material.color.set(creation.color);
  if (avatar) avatar.aura.material.color.set(creation.color);
  $('creation-preview').setAttribute('aria-label',`Preview of ${creation.name}`);
  workshop?.sync(creation);
  setStatus();
}

function checkpoint() {
  if(!simulation)return;
  try {
    saveSession(storage,simulation,lastSafePosition,{hookCount,swingComplete,pullComplete});
    lastSavedAt=Date.now();
  } catch { loaded.available=false;setStatus(); }
}

function queueAutoSave() {
  clearTimeout(autoSaveTimer);
  dirty=true;setStatus();
  autoSaveTimer=setTimeout(()=>save(false),600);
}

function save(showToast=true) {
  clearTimeout(autoSaveTimer);
  try {
    creation = saveCreation(storage, creation); dirty = false; saved = true; loaded.available = true;
    const librarySaved = showToast ? workshop?.saveDesign(creation) !== false : true;
    checkpoint();setStatus();
    if(showToast && librarySaved && loaded.available)toast('Creation and session saved on this device.');
    else if (showToast && !loaded.available) toast('Some saves could not be written. Keep this page open to preserve your session.', 5000);
  } catch { loaded.available = false; setStatus(); if(showToast)toast('Storage is unavailable. You can still test this creation in this session.', 5000); }
}

function setMeditation(value) {
  if(!simulation.setMeditation(value)){toast('Meditation is locked during combat. Disengage first.');return false;}
  meditating = value;
  document.body.classList.toggle('meditating',value);
  $('workshop').setAttribute('aria-hidden', String(!value));
  $('meditate-toggle').textContent = value ? 'Return to ground' : 'Meditate';
  $('mode-label').textContent = value ? 'MEDITATION' : 'PROVING GROUND';
  if (value) { simulation.combat.reset(); simulation.release('meditation'); projectile = null; controls.clear(); }
  else { simulation.selectSlot(0); $('enter-ground').blur(); $('game-canvas').focus({preventScroll:true}); toast('Aim at a ring, crate, or practice character. Cast with F / RT.'); }
  save(false);
  resize();
  return true;
}

function toggleMap() {
  viewExpanded=!viewExpanded;
  document.body.classList.toggle('map-expanded',viewExpanded);
  $('minimap').setAttribute('aria-expanded',String(viewExpanded));
}

function findTarget() {
  camera.updateMatrixWorld();
  scene.updateMatrixWorld();
  raycaster.setFromCamera(aim,camera);
  const hits = raycaster.intersectObjects(world.hookTargets,true);
  for (const hit of hits) {
    let object = hit.object;
    while (object && !object.userData.bodyId) object = object.parent;
    if (!object) continue;
    const distance = hit.point.distanceTo(new THREE.Vector3(simulation.player.position.x,simulation.player.position.y,simulation.player.position.z));
    if (distance > simulation.tetherCreation.reach) return { ...hit, bodyId:object.userData.bodyId, distance, inRange:false };
    return { ...hit, bodyId:object.userData.bodyId, distance, inRange:true };
  }
  return null;
}

function cast() {
  if (meditating || $('guide-dialog').open || viewExpanded) return;
  if (simulation.tetherCreation.form === 'clay') { toast('Select a prepared hook slot first.'); return; }
  if (simulation.tetherCreation.form === 'orb') { toast('Stretch the ball of the Source into a tethered form in meditation first.'); return; }
  if (simulation.hook || projectile) { toast('Release the current tether before casting again.'); return; }
  const cost = simulation.activationCost;
  if (simulation.source < cost) { toast('Not enough of the Source. Meditate to recover.'); return; }
  const target = findTarget();
  if(simulation.actors.get(target?.bodyId)?.role==='rival')simulation.markCombat();
  simulation._event('summoned',{form:'hook'});
  const origin = new THREE.Vector3(simulation.player.position.x,simulation.player.position.y+.65,simulation.player.position.z);
  raycaster.setFromCamera(aim,camera);
  const destination = target?.inRange ? target.point.clone() : raycaster.ray.at(simulation.tetherCreation.reach,new THREE.Vector3());
  // Keep the attachment point in body space while a moving target is approached.
  let localPoint = null;
  if (target?.inRange) {
    const point = simulation.player.position.clone(); point.set(target.point.x, target.point.y, target.point.z);
    localPoint = simulation.bodies.get(target.bodyId)?.pointToLocalFrame(point);
  }
  projectile = { definition:normalizeCreation(simulation.tetherCreation), origin, position:origin.clone(), destination, localPoint, target: target?.inRange ? target : null, progress:0, duration: Math.max(.13,origin.distanceTo(destination)/48) };
  $('hook-status').textContent='MANIFESTING';
}

function release() {
  projectile = null;
  simulation.dismissSlot();
  $('hook-status').textContent='';
}

function aimAt(id) {
  const object = world.objects.get(id), body = simulation.bodies.get(id);
  if (!object || !body) return false;
  object.position.copy(body.position);
  const head = new THREE.Vector3(simulation.player.position.x, simulation.player.position.y + 1.6, simulation.player.position.z);
  const direction = new THREE.Vector3(body.position.x, body.position.y, body.position.z).sub(head).normalize();
  yaw = Math.atan2(-direction.x, -direction.z); pitch = Math.asin(-direction.y);
  updateCamera(1); return true;
}

function startPractice(mode) {
  if(simulation.inCombat){toast('Disengage before restarting practice.');return false;}
  if ($('guide-dialog').open) $('guide-dialog').close();
  if (viewExpanded) toggleMap();
  projectile = null;
  setMeditation(false);
  if(!simulation.startPractice(mode))return false;
  if(mode==='combo')simulation.selectSlot(0);
  document.body.classList.remove('practice-open');
  controls.clear();
  aimAt(mode === 'rescue' ? 'practice-ally' : 'practice-rival');
  if(mode === 'melee') pitch=.2;
  $('game-canvas').focus({ preventScroll: true });
  toast(mode === 'combo' ? 'Slot 1: hook and auto-pull. Slot 2: four sword attacks, finishing heavy.' : mode === 'melee' ? 'Physical sword equipped. LMB / RT swings; C / B spikes. Watch for the rival’s counter.' : mode === 'breakout' ? 'Tap B / R3 repeatedly to escape. Holding does not count as repeated presses.' : mode === 'rescue' ? 'Catch your ally with F / RT before they fall, then reel them to safety.' : 'Catch the rival. T / X lifts them; press again to slam.');
}

function drawMiniMap() {
  const canvas = $('minimap');
  const ctx = canvas.getContext('2d');
  const w=canvas.width,h=canvas.height;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle='#132d33';ctx.fillRect(0,0,w,h);
  const scale=w/78, cx=w/2,cy=h/2;
  ctx.fillStyle='#344747';ctx.fillRect(cx-32*scale,cy-32*scale,64*scale,64*scale);
  ctx.strokeStyle='#baa16a70';ctx.lineWidth=1;ctx.strokeRect(cx-30*scale,cy-30*scale,60*scale,60*scale);
  ctx.strokeStyle='#c6b88717';ctx.beginPath();
  for(let i=-24;i<=24;i+=8){ctx.moveTo(cx+i*scale,cy-32*scale);ctx.lineTo(cx+i*scale,cy+32*scale);ctx.moveTo(cx-32*scale,cy+i*scale);ctx.lineTo(cx+32*scale,cy+i*scale);}ctx.stroke();
  for (const obstacle of world.obstacles) {
    if(obstacle.id==='ground'||obstacle.size[1]<.5) continue;
    ctx.fillStyle='#8b957a';ctx.fillRect(cx+(obstacle.position[0]-obstacle.size[0]/2)*scale,cy+(obstacle.position[2]-obstacle.size[2]/2)*scale,obstacle.size[0]*scale,obstacle.size[2]*scale);
  }
  ctx.strokeStyle='#8fdcc8';ctx.beginPath();ctx.arc(cx,cy+15*scale,3*scale,0,Math.PI*2);ctx.stroke();
  for(const item of world.dynamicObjects){const body=simulation.bodies.get(item.id);ctx.fillStyle='#dbb877';ctx.fillRect(cx+body.position.x*scale-2,cy+body.position.z*scale-2,4,4);}
  for (const actor of simulation.actors?.values() || []) {
    const body = simulation.bodies.get(actor.id); if (!body) continue;
    ctx.fillStyle = actor.role === 'ally' ? '#8fdcc8' : '#e69a9a';
    ctx.beginPath(); ctx.arc(cx + body.position.x * scale, cy + body.position.z * scale, 3, 0, Math.PI * 2); ctx.fill();
  }
  if(simulation.hook){const p=simulation.anchorPosition();ctx.strokeStyle=creation.color;ctx.beginPath();ctx.moveTo(cx+simulation.player.position.x*scale,cy+simulation.player.position.z*scale);ctx.lineTo(cx+p.x*scale,cy+p.z*scale);ctx.stroke();}
  const p=simulation.player.position;ctx.save();ctx.translate(cx+p.x*scale,cy+p.z*scale);ctx.rotate(-yaw);ctx.fillStyle='#fff1cc';ctx.beginPath();ctx.moveTo(0,-6);ctx.lineTo(4,4);ctx.lineTo(0,2);ctx.lineTo(-4,4);ctx.closePath();ctx.fill();ctx.restore();
  ctx.fillStyle='#d5cab0';ctx.font='9px sans-serif';ctx.textAlign='center';ctx.fillText('N',cx,11);
}

function updateHUD() {
  const combat = simulation.combat;
  loadoutUI?.update();
  $('combat-lock').textContent=simulation.inCombat?`IN COMBAT · meditation locked · ${Math.ceil(simulation.combatRemaining)}s`:'OUT OF COMBAT · meditation available';
  $('touch-struggle').hidden=!simulation.incomingTether;
  $('touch-reel').hidden=!simulation.hook;
  $('touch-reel').textContent=simulation.hook?.autoReel?'Auto pull':simulation.hook?.reel?'Stop reel':'Reel';
  $('combat-status').textContent = `${combat.spiking ? 'WHITE AURA · 2/sec' : 'Aura calm'} · ${combat.weapon.replace('-', ' ')}${combat.wearing ? ' · armor active' : ''}`;
  $('spike-toggle').setAttribute('aria-pressed',String(combat.spiking));
  $('equip-toggle').textContent = `Physical equipment: ${combat.weapon.replace('-', ' ')} · V`;
  $('manifest-solid').textContent = 'Use selected saved slot';
  $('source-fill').style.width=`${simulation.source}%`;
  $('source-value').textContent=`${Math.ceil(simulation.source)} / 100`;
  $('stamina-fill').style.width=`${simulation.stamina}%`;
  $('health-fill').style.width=`${simulation.health}%`;
  $('source-value').classList.toggle('depleted',simulation.source<15);
  $('controller-status').textContent=controls.device==='touch'?'Touch controls':controls.gamepadName?'Controller connected':'Keyboard & mouse';
  document.body.dataset.input=controls.device;
  const labels=controls.device==='controller'?{cast:'RT',release:'LB',reel:'Tap LT / RB',jump:'A',meditate:'Y',slam:'X',struggle:'R3'}:{cast:'LMB / F',release:'E',reel:'Tap Q / R',jump:'SPACE',meditate:'M',slam:'T',struggle:'B'};
  labels.cast = controls.device === 'controller' ? 'RT' : combat.weapon === 'tether' ? 'LMB / F' : 'LMB';
  document.querySelector('[data-action=cast] span').textContent = combat.weapon === 'tether' ? 'Cast' : 'Attack';
  document.querySelectorAll('[data-action]').forEach(element=>{const key=element.matches('kbd')?element:element.querySelector('kbd');if(key)key.textContent=labels[element.dataset.action]||'';});
  document.querySelector('.look-hint').textContent=controls.device==='controller'?'Left stick to move · right stick to look':'WASD to move · Hold RMB to look around';
  if (simulation.hook) {
    $('hook-status').textContent=`TETHERED · ${simulation.hook.length.toFixed(1)} m`;
    const actor = simulation.actors?.get(simulation.hook.bodyId);
    $('target-label').textContent=simulation.hook.autoReel ? 'Pulling opponent to you · select your sword when close' : actor ? actor.role === 'ally' ? 'Ally caught · reel them to safety' : `Rival caught · ${simulation.hook.stage === 'lifted' ? 'slam' : 'lift'} with ${controls.device === 'controller' ? 'X' : 'T'}` : 'Reel in to ascend · move to build momentum';
  } else if(!projectile && !meditating) {
    activeTarget=findTarget();
    $('crosshair').classList.toggle('on-target',!!activeTarget?.inRange);
    $('target-label').textContent=activeTarget ? `${simulation.descriptors.get(activeTarget.bodyId)?.name||'Anchor'} · ${activeTarget.distance.toFixed(0)} m${activeTarget.inRange?'':' · out of reach'}` : 'Aim at a ring, beam, crate, or character';
    $('hook-status').textContent='';
  }
  practiceUI?.update(simulation.getSnapshot(), controls.device);
  if (!meditating && simulation.incomingTether) {
    $('hook-status').textContent = 'CAUGHT IN A TETHER';
    $('target-label').textContent = `Repeatedly press ${controls.device === 'controller' ? 'R3' : 'B'} to break free`;
  }
  if (meditating) {
    $('objective-title').textContent='A thought, given form';
    $('objective-detail').textContent='Choose a preset, customize it, then assign it to a saved slot before entering battle.';
  } else if (simulation.practice?.mode) {
    $('objective-title').textContent = 'Practice your creation';
    $('objective-detail').textContent = practiceInstructions(simulation.practice);
  } else if(!hookCount) {
    $('objective-title').textContent='01 / Make a connection';
    $('objective-detail').textContent='Look up at a brass ring with right mouse, then left-click or press F to cast.';
  } else if(!swingComplete) {
    $('objective-title').textContent='02 / Trust the tether';
    $('objective-detail').textContent='Tap Q to start or stop reeling. Use movement to swing, then E to release with momentum.';
  } else if(!pullComplete) {
    $('objective-title').textContent='03 / Move the world';
    $('objective-detail').textContent='Catch a wooden crate and reel it toward you. Lighter objects move more easily.';
  } else {
    $('objective-title').textContent='Your first creation, proven';
    $('objective-detail').textContent='Return to meditation to change the hook’s reach, strength, scale, or color.';
  }
}

function updateControllerMenu(dt) {
  const pad=connectedGamepad();
  if(!pad){lastPadMenu=[];return;}
  const down=i=>!!pad.buttons[i]?.pressed;
  const dialogOpen=$('guide-dialog').open || $('clay-dialog').open;
  if(!meditating&&!dialogOpen){lastPadMenu=pad.buttons.map(b=>b.pressed);return;}
  const elements=$('clay-dialog').open?Array.from($('clay-dialog').querySelectorAll('button,input,select,summary')).filter(el=>!el.disabled&&el.getClientRects().length):dialogOpen?[$('guide-close')]:Array.from($('workshop').querySelectorAll('button,input,select,textarea,summary')).filter(element => !element.disabled && element.getClientRects().length);
  const vertical=pad.axes[1]||0;
  const now=performance.now();
  let direction=0;
  if(down(12)&&!lastPadMenu[12])direction=-1;
  if(down(13)&&!lastPadMenu[13])direction=1;
  if(Math.abs(vertical)>.6&&now-lastMenuAxis>220){direction=Math.sign(vertical);lastMenuAxis=now;}
  if(direction){controllerMenuIndex=(controllerMenuIndex+direction+elements.length)%elements.length;elements[controllerMenuIndex]?.focus({preventScroll:false});}
  const focused=document.activeElement;
  if(focused?.matches('input[type=range]')) {
    const horizontal=pad.axes[0]||0;
    const left=down(14)&&!lastPadMenu[14],right=down(15)&&!lastPadMenu[15];
    if(left||right||(Math.abs(horizontal)>.6&&now-lastMenuAxis>170)){
      const sign=left?-1:right?1:Math.sign(horizontal);focused.value=String(Number(focused.value)+sign*Number(focused.step||1));focused.dispatchEvent(new Event('input',{bubbles:true}));lastMenuAxis=now;
    }
  }
  if (focused?.matches('select') && ((down(14) && !lastPadMenu[14]) || (down(15) && !lastPadMenu[15]))) {
    focused.selectedIndex = Math.max(0, Math.min(focused.options.length - 1, focused.selectedIndex + (down(14) ? -1 : 1)));
    focused.dispatchEvent(new Event('change', { bubbles: true }));
  }
  if(down(0)&&!lastPadMenu[0]) {
    if(elements.includes(focused)&&(focused.tagName==='BUTTON'||focused.tagName==='SUMMARY'||focused.matches('input[type=checkbox]')))focused.click();
    else if(!elements.includes(focused)){controllerMenuIndex=0;elements[0]?.focus();}
  }
  lastPadMenu=pad.buttons.map(b=>b.pressed);
}

function resize() {
  if(!renderer)return;
  const width=window.innerWidth,height=window.innerHeight;
  renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();
  const canvas=$('creation-preview');
  if(previewRenderer&&canvas.clientWidth){previewRenderer.setSize(canvas.clientWidth,canvas.clientHeight,false);previewCamera.aspect=canvas.clientWidth/canvas.clientHeight;previewCamera.updateProjectionMatrix();}
}

function updateCamera(dt) {
  const p=simulation.player.position;
  if(simulation.grounded&&p.y>=.3&&p.y<20)lastSafePosition=[p.x,p.y+.025,p.z];
  cameraTarget.set(p.x,p.y+1.6,p.z);
  if(meditating&&controls.touchEnabled&&innerWidth<600)cameraTarget.y=p.y-1;
  const distance=meditating?6.5:8;
  desiredCamera.set(Math.sin(yaw)*Math.cos(pitch)*distance,Math.sin(pitch)*distance,Math.cos(yaw)*Math.cos(pitch)*distance);
  // Shorten the camera arm near the floor without changing the aim direction.
  if(cameraTarget.y+desiredCamera.y<.35)desiredCamera.multiplyScalar(Math.max(.1,(cameraTarget.y-.35)/-desiredCamera.y));
  desiredCamera.add(cameraTarget);
  camera.position.lerp(desiredCamera,1-Math.exp(-dt*12));
  camera.lookAt(cameraTarget);
}

function updateRope(time) {
  const definition=simulation.hook?.definition||projectile?.definition||simulation.tetherCreation;
  const signature=JSON.stringify(definition);
  if(runtimeHookSignature!==signature){scene.remove(hook.group);hook.dispose();hook=createHook(definition);hook.group.scale.setScalar(definition.hookSize);scene.add(hook.group);runtimeHookSignature=signature;rope.material.color.set(definition.color);}

  let end=null;
  if(projectile)end=projectile.position;
  else if(simulation.hook){const p=simulation.anchorPosition();end=new THREE.Vector3(p.x,p.y,p.z);}
  hook.group.visible=!!end;rope.visible=!!end;
  if(!end)return;
  const p=simulation.player.position;
  const start=new THREE.Vector3(p.x,p.y+.55,p.z);
  const slack=simulation.hook?Math.max(0,simulation.hook.length-start.distanceTo(end)):0;
  for(let i=0;i<=32;i++){
    const t=i/32;temp.lerpVectors(start,end,t);temp.y-=Math.sin(t*Math.PI)*Math.min(slack*.5,3);
    ropePositions[i*3]=temp.x;ropePositions[i*3+1]=temp.y;ropePositions[i*3+2]=temp.z;
  }
  rope.geometry.attributes.position.needsUpdate=true;rope.geometry.computeBoundingSphere();
  hook.group.position.copy(end);hook.group.lookAt(start);hook.group.rotateX(Math.PI/2);
}

function cycleEquipment() {
  const modes=['tether','fists','sword',...(simulation.combat.manifested?['source-sword']:[])];
  simulation.combat.equip(modes[(modes.indexOf(simulation.combat.weapon)+1)%modes.length]);
}
function selectSlot(index) {
  const ok=simulation.selectSlot(index);
  if(!ok)toast('This slot is empty, needs reserve, or must wait for your swing to finish.');
  return ok;
}
function manifestSolid() { selectSlot(simulation.selectedSlot); }
function primary() {
  if(simulation.combat.weapon==='tether'){cast();return;}
  const direction=new THREE.Vector3();camera.getWorldDirection(direction);
  simulation.combat.attack(direction.toArray());
}

function frame() {
  requestAnimationFrame(frame);
  const dt=Math.min(clock.getDelta(),.1),time=clock.elapsedTime;
  const input=controls.read(dt);
  updateControllerMenu(dt);
  for(let action of input.actions){
    if(action==='context-b') action = meditating || $('guide-dialog').open || $('clay-dialog').open || viewExpanded ? 'escape' : 'spike';
    if($('clay-dialog').open){if(action==='escape'||action==='meditate')$('clay-dialog').close();continue;}
    if(action==='map'){if($('guide-dialog').open)$('guide-dialog').close();toggleMap();}
    else if(action==='guide'){if($('guide-dialog').open)$('guide-dialog').close();else $('guide-dialog').showModal();}
    else if(action==='meditate') {if($('guide-dialog').open)$('guide-dialog').close();if(viewExpanded)toggleMap();setMeditation(!meditating);}
    else if(action==='escape') {if($('guide-dialog').open)$('guide-dialog').close();else if(viewExpanded)toggleMap();else if(meditating)setMeditation(false);else setMeditation(true);}
    else if(!meditating&&!$('guide-dialog').open&&!viewExpanded){
      if(action==='cast')cast();
      if(action==='primary') primary();
      if(action==='spike')simulation.combat.toggleAura();
      if(action==='equip')cycleEquipment();
      if(action==='manifest')manifestSolid();
      if(action.startsWith('slot-'))selectSlot(Number(action.slice(5)));
      if(action==='reel-toggle')simulation.toggleReel(1);
      if(action==='payout-toggle')simulation.toggleReel(-1);
      if(action==='struggle')simulation._struggle();
      if(action==='release')release();
      if(action==='jump')jumpPending=true;
      if(action==='slam'){
        const direction = new THREE.Vector3(); camera.getWorldDirection(direction);
        if(!simulation.slam(direction.toArray())) toast('Catch a rival to lift and slam. Each motion needs reserve and a brief recovery.');
      }
      if (['practice-rival','practice-rescue','practice-breakout','practice-melee','practice-combo'].includes(action)) startPractice(action.slice(9));
      if (action === 'practice-reset') { projectile = null; simulation.resetPractice(); }
    }
  }
  if(!meditating&&!$('guide-dialog').open){yaw-=input.lookX;pitch=THREE.MathUtils.clamp(pitch+input.lookY,-1.15,1.05);}
  const blocked=meditating||$('guide-dialog').open||viewExpanded;
  const mx=blocked?0:input.x*Math.cos(yaw)-input.forward*Math.sin(yaw);
  const mz=blocked?0:-input.x*Math.sin(yaw)-input.forward*Math.cos(yaw);
  simulation.step(dt,{moveX:mx,moveZ:mz,jump:jumpPending,sprint:!blocked&&input.sprint,struggle:!blocked&&input.struggle,meditating});
  jumpPending=false;
  if(projectile){
    if (projectile.target && projectile.localPoint) {
      const body = simulation.bodies.get(projectile.target.bodyId);
      if (body) { const point = body.pointToWorldFrame(projectile.localPoint); projectile.destination.set(point.x, point.y, point.z); projectile.target.point.copy(projectile.destination); }
    }
    projectile.progress+=dt/projectile.duration;
    projectile.position.lerpVectors(projectile.origin,projectile.destination,Math.min(1,projectile.progress));
    if(projectile.progress>=1){const {target,definition}=projectile;projectile=null;if(target&&simulation.attach(target.bodyId,target.point.toArray(),definition)){hookCount++;toast('Connected. Combat pulls automatically; otherwise tap Q / LT to reel.');}else toast(target?'The hook could not hold. Move closer and try again.':'Nothing caught. Aim at a beam, ring, or movable crate.');}
  }
  const p=simulation.player.position;
  avatar.group.position.set(p.x,p.y-.6-(meditating?.35:0),p.z);
  if(meditating)avatar.group.rotation.y=Math.PI-.3;
  const speed=Math.hypot(simulation.player.velocity.x,simulation.player.velocity.z);
  if(speed>.2&&!meditating){const angle=Math.atan2(-simulation.player.velocity.x,-simulation.player.velocity.z);avatar.group.rotation.y+=Math.atan2(Math.sin(angle-avatar.group.rotation.y),Math.cos(angle-avatar.group.rotation.y))*Math.min(dt*12,1);}
  avatar.legs.forEach((leg,i)=>leg.rotation.x=meditating?1.25:Math.sin(time*10+i*Math.PI)*Math.min(speed*.07,.55));
  avatar.arms.forEach((arm,i)=>arm.rotation.x=simulation.hook||projectile?-2.1:meditating?1.0:Math.sin(time*10+(1-i)*Math.PI)*Math.min(speed*.05,.4));
  avatar.aura.rotation.z=time*.4;
  for(const item of world.dynamicObjects){const body=simulation.bodies.get(item.id),object=world.objects.get(item.id);if(body&&object){object.position.copy(body.position);object.quaternion.copy(body.quaternion);}}
  if(simulation.hook&&p.y>3&&speed>1)swingComplete=true;
  if(world.dynamicObjects.some(item=>{const b=simulation.bodies.get(item.id);return Math.hypot(b.position.x-item.position[0],b.position.z-item.position[2])>2;}))pullComplete=true;
  for(const event of simulation.events.splice(0)){
    if(event.type==='exhausted')toast('Your reserve is empty. Meditate to recover.');
    if(event.type==='reset'){projectile=null;toast('Returned to the meditation circle.');}
    if(event.type==='actor-rescued')toast('Rescue complete. Your tether brought your ally to safety.');
    if(event.type==='actor-escaped')toast('The rival broke free. Reinforce your tether or act before they escape.');
    if(event.type==='escaped')toast('You broke free of the tether.');
    combatView.event(event,simulation);
    summoningView.event(event);
    if(event.type==='opponent-reeled'){pitch=.2;toast('Opponent in reach. Select your sword and attack four times.');}
    if(event.type==='combat-message')toast(event.message);
    if(event.type==='hook-failed')toast(event.reason);
  }
  world.updatePractice?.(simulation.getSnapshot(),time,creation);
  updateCamera(dt);updateRope(time);world.update(time,dt);
  combatView.update(simulation.getSnapshot(),creation,dt,time);
  summoningView.update(meditating,dt,time);
  renderer.render(scene,camera);
  if(meditating&&previewRenderer&&!$('clay-dialog').open){previewHook.group.rotation.y=Math.sin(time*.5)*.6+.25;previewHook.group.rotation.z=.18;previewRenderer.render(previewScene,previewCamera);}
  if(Math.floor(time*10)!==frame.lastHUD){frame.lastHUD=Math.floor(time*10);updateHUD();drawMiniMap();}
}

function init() {
  const canvas=$('game-canvas');canvas.tabIndex=0;
  renderer=new THREE.WebGLRenderer({canvas,antialias:navigator.maxTouchPoints===0,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,navigator.maxTouchPoints?1:1.75));renderer.shadowMap.enabled=navigator.maxTouchPoints===0;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.13;
  world=createWorld();scene=world.scene;simulation=new SourceSimulation({obstacles:world.obstacles,dynamicObjects:world.dynamicObjects,actors:world.actors,loadout:loadedSlots.slots});
  const restored=loadSession(storage);
  if(restored){restoreSession(simulation,restored);lastSafePosition=[...restored.position];hookCount=restored.objectives.hookCount;swingComplete=restored.objectives.swingComplete;pullComplete=restored.objectives.pullComplete;}
  simulation.meditating=true;
  meditating=!simulation.inCombat;simulation.meditating=meditating;document.body.classList.toggle('meditating',meditating);
  controls=new Controls(canvas);camera=new THREE.PerspectiveCamera(57,1,.1,450);
  avatar=createAvatar();scene.add(avatar.group);combatView=createCombatView(avatar,scene,camera);summoningView=createSummoningView(avatar);hook=createHook(creation);hook.group.visible=false;scene.add(hook.group);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(ropePositions,3));
  rope=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:creation.color,transparent:true,opacity:.95}));rope.visible=false;scene.add(rope);
  previewRenderer=new THREE.WebGLRenderer({canvas:$('creation-preview'),antialias:true,alpha:true});previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));previewRenderer.outputColorSpace=THREE.SRGBColorSpace;previewRenderer.toneMapping=THREE.ACESFilmicToneMapping;
  previewScene=new THREE.Scene();previewScene.add(new THREE.HemisphereLight('#e4ffff','#40504c',3));const light=new THREE.DirectionalLight('#ffdead',4);light.position.set(-2,3,4);previewScene.add(light);
  previewCamera=new THREE.PerspectiveCamera(34,2,.1,20);previewCamera.position.set(0,.3,3.8);previewCamera.lookAt(-.1,.15,0);previewHook=createHook(creation);previewScene.add(previewHook.group);
  const hoop=new THREE.Mesh(new THREE.TorusGeometry(.88,.006,4,80),new THREE.MeshBasicMaterial({color:'#9eae98',transparent:true,opacity:.25}));hoop.position.set(-.12,.16,-.2);previewScene.add(hoop);
  for(const [id,key] of [['reach','reach'],['reel-speed','reelSpeed'],['strength','strength'],['hook-size','hookSize']])$(id).addEventListener('input',event=>{creation[key]=Number(event.target.value);dirty=true;applyCreation();});
  $('creation-name').addEventListener('input',event=>{creation.name=event.target.value;dirty=true;setStatus();});
  $('creation-name').addEventListener('blur',applyCreation);
  $('creation-color').addEventListener('input',event=>{creation.color=event.target.value;dirty=true;applyCreation();});
  document.querySelectorAll('[data-color]').forEach(button=>button.addEventListener('click',()=>{creation.color=button.dataset.color;dirty=true;applyCreation();}));
  $('save-creation').addEventListener('click',()=>save(true));
  workshop=initWorkshop({getCreation:()=>creation,onChange:next=>{creation=normalizeCreation(next);applyCreation();queueAutoSave();},storage,toast});
  clayWorkshop=initClayWorkshop({getCreation:()=>creation,onChange:next=>{creation=normalizeCreation(next);applyCreation();queueAutoSave();},toast});
  $('spike-toggle').onclick=()=>simulation.combat.toggleAura();
  $('equip-toggle').onclick=cycleEquipment;
  $('manifest-solid').onclick=manifestSolid;
  loadoutUI=initLoadoutUI({simulation,storage,getCreation:()=>creation,onChange:next=>{creation=normalizeCreation(next);applyCreation();queueAutoSave();},onSelect:selectSlot,toast});
  $('practice-menu-toggle').onclick=()=>document.body.classList.toggle('practice-open');
  const preferencesKey='the-source.controls.v1';
  try{const p=JSON.parse(storage.getItem(preferencesKey));if(p){$('touch-scale').value=p.scale||1;$('touch-layout').value=p.layout||'right';$('graphics-quality').value=p.quality||'balanced';}}catch{}
  function preferences(){
    document.body.style.setProperty('--touch-scale',$('touch-scale').value);document.body.classList.toggle('touch-left',$('touch-layout').value==='left');
    const phone=$('graphics-quality').value==='performance'||controls.touchEnabled;renderer.setPixelRatio(Math.min(devicePixelRatio,phone?1:1.75));renderer.shadowMap.enabled=!phone;
    try{storage.setItem(preferencesKey,JSON.stringify({scale:Number($('touch-scale').value),layout:$('touch-layout').value,quality:$('graphics-quality').value}));}catch{toast('Control settings could not be saved.');}
  }
  ['touch-scale','touch-layout','graphics-quality'].forEach(id=>$(id).addEventListener('input',preferences));preferences();
  practiceUI=createPracticeUI({simulation,startPractice,resetPractice:()=>{if(!simulation.resetPractice()){toast('Disengage before resetting practice.');return;}projectile=null;toast('Practice characters reset.');},storage,toast});
  $('workshop').addEventListener('input',queueAutoSave);
  document.querySelectorAll('[data-color]').forEach(button=>button.addEventListener('click',queueAutoSave));
  $('enter-ground').addEventListener('click',()=>setMeditation(false));
  $('meditate-toggle').addEventListener('click',()=>setMeditation(!meditating));
  $('reset-player').addEventListener('click',()=>{if(!simulation.reset()){toast('Disengage before returning to the circle.');return;}projectile=null;yaw=-.18;pitch=.28;toast('Returned to the circle.');});
  $('guide-toggle').addEventListener('click',()=>{$('guide-dialog').showModal();controls.clear();});
  $('guide-close').addEventListener('click',()=>$('guide-dialog').close());
  $('minimap').addEventListener('click',toggleMap);
  $('minimap').tabIndex=0;
  $('minimap').setAttribute('role','button');
  $('minimap').setAttribute('aria-expanded','false');
  $('minimap').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();toggleMap();}});
  $('minimap').setAttribute('title','Expand map · G / controller View');
  window.addEventListener('resize',resize);
  window.addEventListener('blur',()=>{controls.clear();save(false);});
  window.addEventListener('pagehide',()=>save(false));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)save(false);});
  setInterval(checkpoint,3000);
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();$('error-state').hidden=false;$('error-state').textContent='The graphics connection was interrupted. Reload to return to your saved creation.';});
  applyCreation();resize();updateCamera(1);updateHUD();drawMiniMap();
  $('meditate-toggle').textContent=meditating?'Return to ground':'Meditate';
  if(!meditating)simulation.selectSlot(0);
  if(!saved)queueAutoSave();
  $('loading-state').hidden=true;
  if(import.meta.env.DEV)window.__SOURCE_DEBUG__={snapshot:()=>({...simulation.getSnapshot(),meditating,creation:{...creation},saved,dirty,lastSavedAt,device:controls.device,renderer:{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles},camera:{yaw,pitch},objectives:{hookCount,swingComplete,pullComplete}}),simulation,world,setMeditation,aimAt,cast,release,checkpoint,startPractice,selectSlot,visuals:()=>({orb:summoningView.visible(),aura:combatView.auraVisible()})};
  frame();
}

try { init(); } catch(error) {
  console.error(error);$('loading-state')?.setAttribute('hidden','');const box=$('error-state');if(box){box.hidden=false;box.textContent='The sanctum could not load. Enable WebGL in your browser and reload. Details are available in the browser console.';}
}
