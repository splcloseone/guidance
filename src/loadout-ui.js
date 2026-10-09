import { CATALOG, catalogCreation, slotName, saveLoadout } from './loadout.js';
export function initLoadoutUI({simulation,storage,getCreation,onChange,onSelect,toast}){
  const $=id=>document.getElementById(id);
  for(const entry of CATALOG){const button=document.createElement('button');button.type='button';button.textContent=entry.name;button.title=entry.description;button.dataset.catalog=entry.kind;button.onclick=()=>{if(!simulation.meditating||simulation.inCombat)return;onChange(catalogCreation(entry.kind));$('catalog-description').textContent=entry.description;};$('preset-catalog').append(button);}
  const buttons=[];
  for(let i=0;i<4;i++){
    const button=document.createElement('button');button.type='button';button.dataset.slot=String(i);button.innerHTML=`<kbd>${i+1}</kbd><span></span><small></small>`;
    let timer,held=false,pointer=null;
    button.addEventListener('pointerdown',e=>{e.preventDefault();pointer=e.pointerId;button.setPointerCapture(pointer);held=false;timer=setTimeout(()=>{held=true;simulation.dismissSlot(i);},480);});
    button.addEventListener('pointerup',e=>{if(e.pointerId!==pointer)return;clearTimeout(timer);pointer=null;if(!held)onSelect(i);});
    for(const event of ['pointercancel','lostpointercapture'])button.addEventListener(event,()=>{clearTimeout(timer);pointer=null;});
    button.addEventListener('click',e=>{if(e.detail===0)onSelect(i);});
    $('summon-slots').append(button);buttons.push(button);
  }
  $('assign-slot').onclick=()=>{
    if(!simulation.meditating||simulation.inCombat){toast('Prepare your slots in meditation, outside combat.');return;}
    const slots=structuredClone(simulation.loadout),index=Number($('slot-destination').value),type=$('slot-content').value;
    slots[index]=type==='creation'?{kind:'creation',creation:getCreation()}:{kind:type};
    if(!simulation.setLoadout(slots))return;
    try{saveLoadout(storage,simulation.loadout);toast(`Slot ${index+1} saved. It is ready for battle.`);}
    catch{toast('Slot updated for this session. Device storage could not save it.');}
    update();
  };
  function update(){
    buttons.forEach((button,i)=>{
      const slot=simulation.loadout[i],definition=slot.creation,c=simulation.combat;
      const active=slot.kind==='physical'?c.weapon==='sword':slot.kind==='fists'?c.weapon==='fists':definition?.solid?.purpose==='armor'?c.armorDefinition?.id===definition.id:definition?.solid?.purpose==='sword'?c.weaponDefinition?.id===definition.id:!!simulation.hook&&simulation.hook.definition?.id===definition?.id;
      button.querySelector('span').textContent=slotName(slot);
      button.querySelector('small').textContent=active?'ACTIVE':slot.kind==='empty'?'EMPTY':'READY';
      button.setAttribute('aria-pressed',String(i===simulation.selectedSlot));button.classList.toggle('active',!!active);button.disabled=simulation.meditating;
    });
    $('loadout-summary').textContent=simulation.loadout.map((slot,i)=>`${i+1}. ${slotName(slot)}`).join(' · ');
  }
  update();return {update};
}
