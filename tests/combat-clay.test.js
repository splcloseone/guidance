import test from 'node:test';
import assert from 'node:assert/strict';
import { SourceSimulation } from '../src/simulation.js';
import { PRACTICE_ACTORS } from '../src/actors.js';
import { clayPreset, decodeClay, sculptClay, normalizeClay, clayHasVolume } from '../src/clay.js';
import { normalizeCreation, saveCreation, loadCreation, upsertLibrary } from '../src/creation.js';
import { createHook } from '../src/models.js';
const make=(extra=[])=>new SourceSimulation({obstacles:[{id:'ground',position:[0,-.5,0],size:[100,1,100]},...extra],actors:PRACTICE_ACTORS});
const advance=(s,t,input={})=>{for(let i=0;i<Math.round(t*120);i++)s.step(1/120,input);};
const ready=s=>{s.startPractice('melee');advance(s,.3);};

test('aura is deliberate, costs activation plus upkeep, coexists with tether, and exhausts both',()=>{
 const s=make();assert.equal(s.combat.spiking,false);s.combat.toggleAura();assert.equal(s.source,95);advance(s,1);assert.ok(Math.abs(s.source-93)<.001);
 s.attach('practice-ally',s.actors.get('practice-ally').body.position.toArray());assert.ok(s.hook);assert.ok(s.combat.spiking);
 s.source=.01;advance(s,.05);assert.equal(s.hook,null);assert.equal(s.combat.spiking,false);assert.ok(s.getSnapshot().weakened);
 assert.equal(s.combat.toggleAura(),false);advance(s,.2,{meditating:true});assert.equal(s.combat.toggleAura(),false);
});
test('physical sword hits once only in active phase and combo inputs queue only during recovery',()=>{
 const s=make();ready(s);const rival=s.actors.get('practice-rival');const reserve=s.source;
 s.combat.attack([0,0,-1]);advance(s,.1);assert.equal(rival.health,100);
 advance(s,.3);assert.equal(rival.health,80);advance(s,.08);assert.equal(rival.health,80);
 s.combat.attack([0,0,-1]);advance(s,.2);assert.equal(s.combat.strike.index,1);assert.equal(s.source,reserve);
});
test('misses, facing away, ally targets, distance and intervening walls prevent damage',()=>{
 for(const [position,direction] of [[[ -7,.6,10],[0,0,-1]],[[-7,.6,7.1],[0,0,1]]]){
  const s=make();ready(s);s.player.position.set(...position);s.combat.attack(direction);advance(s,.7);assert.equal(s.actors.get('practice-rival').health,100);
 }
 const s=make([{id:'wall',position:[-7,1,6],size:[3,2,.2]}]);ready(s);s.combat.attack([0,0,-1]);advance(s,.7);assert.equal(s.actors.get('practice-rival').health,100);
 const ally=s.actors.get('practice-ally');s.player.position.set(7,.6,6.3);s.combat.attack([0,0,-1]);advance(s,.7);assert.equal(ally.health,100);
});
test('spiking reinforces actual hits and mitigates incoming melee, not fall damage',()=>{
 const s=make();ready(s);s.combat.toggleAura();s.combat.attack([0,0,-1]);advance(s,.5);assert.equal(s.actors.get('practice-rival').health,70);
 assert.equal(s.combat.damagePlayer(20),14);assert.equal(s.combat.damagePlayer(20,'fall'),20);
 advance(s,.1,{meditating:true});assert.equal(s.combat.spiking,false);assert.equal(s.combat.strike,null);
});
test('practice counters are telegraphed, dodgeable, and unavailable outside melee practice',()=>{
 const s=make();ready(s);s.combat.counterAt=0;advance(s,.1);assert.ok(s.combat.counterWindup>s.elapsed);assert.equal(s.health,100);
 s.player.position.x+=5;advance(s,1);assert.equal(s.health,100);
 s.player.position.set(-7,.6,7.1);s.combat.counterAt=0;advance(s,1);assert.equal(s.health,88);
 s.resetPractice();advance(s,5);assert.equal(s.health,88);
});
test('solid clay survives saves, keeps holes, and generates finite geometry',()=>{
 const solid=clayPreset('pants');const f=decodeClay(solid.data),N=28;
 assert.ok(f[17+N*12+N*N*14]<128,'inside a leg remains hollow');
 const creation=normalizeCreation({form:'clay',solid});let stored;const storage={setItem(k,v){stored=v;},getItem(){return stored;}};
 saveCreation(storage,creation);assert.deepEqual(loadCreation(storage).creation.solid,solid);assert.equal(upsertLibrary([],creation)[0].solid.data,solid.data);
 const model=createHook(creation);const pos=model.group.children[0].geometry.attributes.position;assert.ok(pos.count>100);assert.ok(pos.array.every(Number.isFinite));model.dispose();
});
test('add, carve, pull, smooth and flatten change real solid density; corrupted data repairs',()=>{
 const ball=clayPreset();
 for(const tool of ['add','carve','pull','smooth','flatten']){
 const next=sculptClay(ball,{tool,point:[.25,.2,.38],delta:[.15,.12,0],radius:.5,symmetry:true});assert.notEqual(next.data,ball.data,tool);assert.ok(clayHasVolume(next));assert.equal(next.data.length,ball.data.length);
 }
 assert.deepEqual(normalizeClay({data:'broken'}),ball);
});
test('armor and created swords have real costs, combat purpose, and lifecycle dismissal',()=>{
 const s=make();ready(s);s.setCreation({form:'clay',solid:clayPreset('pants')});assert.equal(s.combat.manifest(),true);assert.equal(s.source,90);assert.equal(s.combat.damagePlayer(20),15);
 s.combat.toggleAura();assert.equal(s.combat.damagePlayer(20),9);advance(s,1);assert.ok(s.source<83);
 s.setCreation({form:'clay',solid:clayPreset('sword')});assert.equal(s.combat.wearing,false);assert.equal(s.combat.manifest(),true);assert.equal(s.combat.weapon,'source-sword');
 advance(s,.1,{meditating:true});assert.equal(s.combat.manifested,false);assert.notEqual(s.combat.weapon,'source-sword');
 s.setCreation({form:'clay',solid:{...clayPreset('sword'),data:'00'.repeat(28**3)}});assert.equal(s.combat.manifest(),false);
});
