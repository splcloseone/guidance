import test from 'node:test';
import assert from 'node:assert/strict';
import { SourceSimulation } from '../src/simulation.js';
import { PRACTICE_ACTORS } from '../src/actors.js';
import { defaultLoadout, saveLoadout, loadLoadout, catalogCreation, CATALOG } from '../src/loadout.js';
import { saveSession,loadSession,restoreSession } from '../src/session.js';
import { createHook } from '../src/models.js';
const make=()=>new SourceSimulation({obstacles:[{id:'ground',position:[0,-.5,0],size:[100,1,100]}],actors:PRACTICE_ACTORS});
const advance=(s,t,input={})=>{for(let i=0;i<t*120;i++)s.step(1/120,input);};
const store=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};};

test('four light/heavy sword inputs produce four distinct real hits and stop after the finisher',()=>{
 const s=make();s.startPractice('melee');advance(s,.3);s.combat.counterAt=Infinity;
 s.combat.attack([0,0,-1]);
 for(let i=0;i<3;i++){advance(s,.2);s.combat.attack([0,0,-1]);while(s.combat.strike?.index===i)advance(s,1/120);}
 advance(s,1);
 const hits=s.events.filter(e=>e.type==='actor-damaged');assert.deepEqual(hits.map(e=>e.combo),[1,2,3,4]);
 assert.equal(hits[3].heavy,true);assert.ok(hits[3].damage>hits[0].damage);assert.equal(s.combat.strike,null);assert.equal(s.combat.combo,0);
});
test('automatic combat pull physically brings the opponent in; friendly pulls start only on toggle',()=>{
 const s=make();s.startPractice('combo');advance(s,.3);const actor=s.actors.get('practice-rival'),start=s.player.position.toArray();
 assert.equal(s.attach(actor.id,actor.body.position.toArray()),true);assert.equal(s.hook.autoReel,true);
 advance(s,1.6);assert.ok(actor.body.position.distanceTo(s.player.position)<2.55);assert.ok(Math.hypot(s.player.position.x-start[0],s.player.position.z-start[2])<.25);
 const friendly=make();advance(friendly,.3);const ally=friendly.actors.get('practice-ally');friendly.attach(ally.id,ally.body.position.toArray());
 const length=friendly.hook.length;advance(friendly,.3);assert.equal(friendly.hook.length,length);
 friendly.toggleReel();advance(friendly,.3);assert.ok(friendly.hook.length<length-1);friendly.toggleReel();const paused=friendly.hook.length;advance(friendly,.3);assert.equal(friendly.hook.length,paused);
});
test('loadouts persist without changing designs, cannot be edited in combat, and selection preserves armor',()=>{
 const slots=defaultLoadout(),storage=store();slots[3]={kind:'creation',creation:catalogCreation('scythe')};saveLoadout(storage,slots);
 assert.deepEqual(loadLoadout(storage).slots,slots);
 const s=make();s.setMeditation(true);assert.equal(s.setLoadout(slots),true);s.setMeditation(false);
 assert.equal(s.selectSlot(2),true);const source=s.source;assert.equal(s.selectSlot(2),true);assert.equal(s.source,source,'selecting active armor is free');
 s.selectSlot(1);assert.equal(s.combat.wearing,true);s.combat.attack([0,0,-1]);assert.equal(s.setLoadout(defaultLoadout()),false);assert.equal(s.setMeditation(true),false);
 const armor=s.combat.armorDefinition;s.dismissSlot(3);assert.equal(s.combat.armorDefinition,armor,'holding an inactive slot must not dismiss another creation');
});
test('combat lock blocks rest, editing and resets, persists across reload, and ends after disengagement',()=>{
 const s=make();s.startPractice('melee');s.combat.attack([0,0,-1]);const source=s.source;s.health=65;
 assert.equal(s.reset(),false);assert.equal(s.resetPractice(),false);assert.equal(s.startPractice('rescue'),false);
 const old=s.creation;s.setCreation(catalogCreation('axe'));assert.equal(s.creation,old);
 advance(s,.2,{meditating:true});assert.equal(s.meditating,false);assert.equal(s.health,65);assert.equal(s.source,source);
 const storage=store();saveSession(storage,s,[0,.6,15],{});const restored=make();restoreSession(restored,loadSession(storage));
 advance(restored,.5,{meditating:true});assert.equal(restored.meditating,false);assert.equal(restored.health,65);
 advance(restored,9);assert.equal(restored.setMeditation(true),true);advance(restored,1,{meditating:true});assert.ok(restored.health>65);
});
test('all catalog tools have distinct finite shapes and supported combat traits',()=>{
 const signatures=new Set();
 for(const entry of CATALOG){const creation=catalogCreation(entry.kind);signatures.add(creation.solid.data);const model=createHook(creation),pos=model.group.children[0].geometry.attributes.position;assert.ok(pos.count>30);assert.ok(pos.array.every(Number.isFinite));model.dispose();}
 assert.equal(signatures.size,CATALOG.length);
});

test('a launched hook retains its captured definition after selecting another prepared hook',()=>{
 const s=make();s.startPractice('combo');advance(s,.3);
 const first=structuredClone(s.tetherCreation),slots=defaultLoadout();
 slots[3]=structuredClone(slots[0]);slots[3].creation.reach=12;slots[3].creation.strength=5;
 s.loadout=slots;s.selectSlot(3);const before=s.source,actor=s.actors.get('practice-rival');
 assert.equal(s.attach(actor.id,actor.body.position.toArray(),first),true);
 assert.equal(s.hook.definition.reach,first.reach);assert.equal(s.hook.strength,first.strength);
 assert.ok(Math.abs(before-s.source-(8+first.reach*.1+first.strength))<1e-8);
 assert.equal(s.tetherCreation.strength,5,'the newly selected hook remains selected');
});
