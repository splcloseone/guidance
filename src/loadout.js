import { normalizeCreation, creationFromPreset } from './creation.js';
import { clayPreset } from './clay.js';
export const LOADOUT_KEY = 'the-source.loadout.v1';
export const CATALOG = Object.freeze([
  {kind:'sword',name:'Sword',description:'Balanced four-strike chain with a heavy finish.'},
  {kind:'pants',name:'Leg armor',description:'Sustained protection that stays active when you change weapons.'},
  {kind:'axe',name:'Axe',description:'Slower, harder hits. Woodcutting is planned.'},
  {kind:'pickaxe',name:'Pickaxe',description:'Focused, narrow strikes. Mining is planned.'},
  {kind:'hoe',name:'Hoe',description:'A short sweeping tool. Cultivating soil is planned.'},
  {kind:'sickle',name:'Sickle',description:'Quick close-range sweeps. Harvesting is planned.'},
  {kind:'scythe',name:'Scythe',description:'Wide, longer sweeps with slower recovery. Harvesting is planned.'},
]);
export function catalogCreation(kind) {
  const entry=CATALOG.find(e=>e.kind===kind)||CATALOG[0];
  return normalizeCreation({...creationFromPreset('orb'),form:'clay',name:`${entry.name} of the Source`,solid:clayPreset(entry.kind)});
}
export function defaultLoadout(){return [
  {kind:'creation',creation:creationFromPreset('hook')},{kind:'physical'},
  {kind:'creation',creation:catalogCreation('pants')},{kind:'creation',creation:catalogCreation('sword')},
];}
export function normalizeLoadout(value){
  return Array.from({length:4},(_,i)=>{
    const slot=value?.[i];
    if(slot?.kind==='creation' && slot.creation && typeof slot.creation==='object')return {kind:'creation',creation:normalizeCreation(slot.creation)};
    return {kind:['physical','fists'].includes(slot?.kind)?slot.kind:'empty'};
  });
}
export function loadLoadout(storage){
  try {const raw=storage.getItem(LOADOUT_KEY);return {slots:raw?normalizeLoadout(JSON.parse(raw)?.slots):defaultLoadout(),available:true};}
  catch{return {slots:defaultLoadout(),available:false};}
}
export function saveLoadout(storage,slots){const data=normalizeLoadout(slots);storage.setItem(LOADOUT_KEY,JSON.stringify({version:1,slots:data}));return data;}
export const slotName=slot=>slot?.kind==='creation'?slot.creation.name:slot?.kind==='physical'?'Physical sword':slot?.kind==='fists'?'Fists':'Empty slot';
