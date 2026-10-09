import test from 'node:test';
import assert from 'node:assert/strict';
import { SourceSimulation } from '../src/simulation.js';
import { loadSession, saveSession, restoreSession, SESSION_KEY } from '../src/session.js';

const create = () => new SourceSimulation({ obstacles: [{ id:'ground',position:[0,-.5,0],size:[64,1,64] }], dynamicObjects:[{id:'crate',position:[4,1,0],size:[2,2,2],mass:12}] });
const storage = () => { const entries=new Map();return {getItem:k=>entries.get(k)||null,setItem:(k,v)=>entries.set(k,v)}; };

test('autosave restores safe position, vitals, crates, and objectives without resurrecting a tether', () => {
  const sim=create(),store=storage();
  sim.source=61;sim.health=80;sim.stamina=70;
  sim.bodies.get('crate').position.set(8,1,2);
  sim.attach('crate',[8,1,2]);
  const expectedSource=sim.source;
  saveSession(store,sim,[1,.6,6],{hookCount:2,swingComplete:true,pullComplete:false});
  const restored=create(),state=loadSession(store);
  restoreSession(restored,state);
  assert.deepEqual(restored.player.position.toArray(),[1,.6,6]);
  assert.deepEqual(restored.bodies.get('crate').position.toArray(),[8,1,2]);
  assert.equal(restored.source,expectedSource);
  assert.equal(restored.health,80);
  assert.equal(restored.hook,null);
  assert.equal(state.objectives.swingComplete,true);
});

test('invalid and incompatible checkpoints safely fall back to a fresh session', () => {
  const store=storage();
  for(const value of ['{',JSON.stringify({version:9,position:[0,1,0]}),JSON.stringify({version:1,position:[null,1,0]})]){
    store.setItem(SESSION_KEY,value);assert.equal(loadSession(store),null);
  }
  store.setItem(SESSION_KEY,JSON.stringify({version:1,position:[0,.6,3],source:10000,health:-1,stamina:-3,objects:[]}));
  const loaded=loadSession(store);assert.equal(loaded.source,100);assert.equal(loaded.health,1);assert.equal(loaded.stamina,0);
});
