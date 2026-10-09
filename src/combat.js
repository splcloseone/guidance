import { clayHasVolume } from './clay.js';
import { normalizeCreation } from './creation.js';
export const AURA = Object.freeze({ activation: 5, upkeep: 2, attack: 1.5, protection: .3 });
export const SWINGS = Object.freeze([
  { windup:.15, active:.18, recovery:.16, damage:20 },
  { windup:.13, active:.18, recovery:.16, damage:18 },
  { windup:.14, active:.19, recovery:.17, damage:18 },
  { windup:.26, active:.22, recovery:.40, damage:34, heavy:true },
]);
export const TOOL_PROFILES=Object.freeze({
  sword:{speed:1,damage:1,reach:1,arc:.45},axe:{speed:1.3,damage:1.25,reach:.95,arc:.45},
  pickaxe:{speed:1.15,damage:1.15,reach:1,arc:.78},hoe:{speed:1.05,damage:.8,reach:.9,arc:.3},
  sickle:{speed:.8,damage:.75,reach:.7,arc:.2},scythe:{speed:1.3,damage:1.05,reach:1.2,arc:.1},
});
export function solidCosts(definition) {return {activation:7+definition.strength,upkeep:(.4+definition.strength*.2)*definition.hookSize};}
export class Combat {
  constructor(sim){this.sim=sim;this.weapon='tether';this.reset();}
  reset(){
    if(this.weapon==='source-sword')this.weapon='fists';
    this.spiking=false;this.strike=null;this.combo=0;this.lastEnd=-10;this.wearing=false;this.manifested=false;
    this.armorDefinition=null;this.weaponDefinition=null;this.counterAt=0;this.counterWindup=0;
  }
  toggleAura(){
    const s=this.sim;if(s.meditating||s.health<=0)return false;
    if(this.spiking){this.spiking=false;return true;}
    if(s.source<AURA.activation){s._event('combat-message',{message:'You need 5 of the Source to spike. Rest outside combat.'});return false;}
    s.source-=AURA.activation;this.spiking=true;s._event('aura-spiked');return true;
  }
  equip(weapon){
    if(!['tether','fists','sword','source-sword'].includes(weapon)||this.strike)return false;
    if(weapon==='source-sword'&&!this.manifested)return false;
    if(weapon!==this.weapon){this.combo=0;this.lastEnd=-10;}
    this.weapon=weapon;return true;
  }
  manifest(definition=this.sim.creation){
    const s=this.sim, d=normalizeCreation(definition), purpose=d.solid?.purpose;
    if(s.meditating||d.form!=='clay'||!clayHasVolume(d.solid)||!['armor','sword'].includes(purpose))return false;
    const existing=purpose==='armor'?this.armorDefinition:this.weaponDefinition;
    if(existing?.id===d.id){if(purpose==='sword')return this.equip('source-sword');return true;}
    if(purpose==='sword'&&this.strike)return false;
    const cost=solidCosts(d);
    if(s.source<cost.activation){s._event('combat-message',{message:`Manifesting needs ${cost.activation} of the Source.`});return false;}
    s.source-=cost.activation;
    if(purpose==='armor'){this.armorDefinition=d;this.wearing=true;}
    else{this.weaponDefinition=d;this.manifested=true;this.equip('source-sword');}
    s._event('summoned',{form:purpose});return true;
  }
  dismiss(kind='all'){
    if(kind==='all'||kind==='armor'){this.wearing=false;this.armorDefinition=null;}
    if(kind==='all'||kind==='sword'){
      this.manifested=false;this.weaponDefinition=null;
      if(this.weapon==='source-sword'){this.weapon='fists';this.strike=null;}
    }
  }
  attack(direction){
    const s=this.sim;
    if(s.meditating||s.health<=0||this.weapon==='tether'||!Array.isArray(direction)||direction.length!==3||!direction.every(Number.isFinite))return false;
    const length=Math.hypot(direction[0],direction[2]);if(length<.01)return false;
    const facing=[direction[0]/length,0,direction[2]/length];
    if(this.strike){
      if(this.strike.index<3&&this.strike.t>=.08){this.strike.queued=true;this.strike.nextDirection=facing;}
      return false;
    }
    const index=s.elapsed-this.lastEnd<.7?this.combo%4:0;
    const cost=this.weapon==='fists'?5:index===3?14:8;
    if(s.stamina<cost)return false;s.stamina-=cost;
    const definition=this.weapon==='source-sword'?this.weaponDefinition:null;
    const profile=TOOL_PROFILES[definition?.solid?.kind]||TOOL_PROFILES.sword;
    const base=this.weapon==='fists'?{windup:.12,active:.14,recovery:.20,damage:9}:SWINGS[index];
    const rule={...base,windup:base.windup*profile.speed,active:base.active*profile.speed,recovery:base.recovery*profile.speed,
      damage:base.damage*profile.damage*(definition?(.7+definition.strength*.1):1),
      reach:this.weapon==='fists'?1.55:2.55*profile.reach*(definition?.hookSize||1),arc:profile.arc};
    this.strike={t:0,index,rule,direction:facing,hits:new Set(),queued:false};
    s.markCombat();s._event('melee-start',{weapon:this.weapon,index,heavy:!!rule.heavy});return true;
  }
  damagePlayer(amount,kind='melee'){
    const s=this.sim;
    if(kind!=='fall')s.markCombat();
    const armor=this.wearing?(.1+(this.armorDefinition?.strength||3)*.05):0;
    const protection=kind==='fall'?0:Math.min(.65,(this.spiking?AURA.protection:0)+armor);
    const damage=Math.min(s.health,Math.max(0,amount)*(1-protection));s.health=Math.max(0,s.health-damage);
    if(damage>0)s._event('player-damaged',{damage,protected:protection>0,kind,position:s.player.position.toArray()});return damage;
  }
  visibleTarget(body){
    const s=this.sim,from=s.player.position.clone();from.y+=.35;let blocked=false;
    s.world.raycastAll(from,body.position,{skipBackfaces:true},hit=>{if(hit.body!==s.player&&hit.body!==body&&!s.actors.has(hit.body.userData?.id))blocked=true;});return !blocked;
  }
  step(dt){
    const s=this.sim;if(s.meditating){this.reset();return;}
    const upkeep=(this.spiking?AURA.upkeep:0)+(this.wearing?solidCosts(this.armorDefinition).upkeep:0)+(this.manifested?solidCosts(this.weaponDefinition).upkeep:0);
    s.source=Math.max(0,s.source-upkeep*dt);
    if(s.source<=0){if(this.spiking||this.wearing||this.manifested)s._event('exhausted');this.spiking=false;this.dismiss();s.release('exhausted');}
    const strike=this.strike;
    if(strike){
      strike.t+=dt;const {windup,active,recovery,damage,reach,arc,heavy}=strike.rule;
      if(strike.t>=windup&&strike.t<windup+active){
        for(const actor of s.actors.values()){
          if(actor.role!=='rival'||actor.health<=0||strike.hits.has(actor.id))continue;
          const offset=actor.body.position.vsub(s.player.position),distance=Math.hypot(offset.x,offset.z);
          const forward=(offset.x*strike.direction[0]+offset.z*strike.direction[2])/Math.max(.01,distance);
          if(distance>reach||Math.abs(offset.y)>1.5||forward<arc||!this.visibleTarget(actor.body))continue;
          strike.hits.add(actor.id);s.markCombat();
          const dealt=Math.min(actor.health,damage*(this.spiking?AURA.attack:s.source<=.01?.7:1));actor.health-=dealt;
          const push=heavy?5:.3;actor.body.velocity.x+=strike.direction[0]*push;actor.body.velocity.z+=strike.direction[2]*push;
          actor.staggerUntil=s.elapsed+(heavy?.6:.24);
          s._event('actor-damaged',{actorId:actor.id,damage:dealt,health:actor.health,kind:this.weapon,heavy:!!heavy,combo:indexLabel(strike.index),position:actor.body.position.toArray()});
          if(heavy&&s.hook?.bodyId===actor.id)s.release('heavy-finish');
          if(actor.health<=0){if(s.hook?.bodyId===actor.id)s.release('defeated');if(s.incomingTether?.actorId===actor.id)s._releaseIncoming('defeated');s.practice.status='defeated';}
        }
      }
      if(strike.t>=windup+active+recovery){
        this.combo=strike.index===3?0:strike.index+1;this.lastEnd=s.elapsed;this.strike=null;
        if(strike.queued&&strike.index<3)this.attack(strike.nextDirection||strike.direction);
      }
    }
    const rival=s.actors.get('practice-rival');
    if(!['melee','combo'].includes(s.practice.mode)||!rival||rival.health<=0||s.hook?.bodyId===rival.id||rival.staggerUntil>s.elapsed){this.counterWindup=0;return;}
    const distance=rival.body.position.distanceTo(s.player.position);
    if(this.counterWindup){
      if(s.elapsed>=this.counterWindup){if(distance<2.5&&this.visibleTarget(rival.body))this.damagePlayer(12);this.counterWindup=0;this.counterAt=s.elapsed+2.3;}
    }else if(distance<2.5&&s.elapsed>this.counterAt){this.counterWindup=s.elapsed+.85;s.markCombat();s._event('combat-message',{message:'Counter incoming—move or test your protection!'});}
  }
  snapshot(){const a=this.strike;return {spiking:this.spiking,weapon:this.weapon,wearing:this.wearing,manifested:this.manifested,
    armorDefinition:this.armorDefinition,weaponDefinition:this.weaponDefinition,counterWindup:this.counterWindup,
    attack:a?{t:a.t,index:a.index,queued:a.queued,direction:[...a.direction],...a.rule}:null};}
}
const indexLabel=index=>index+1;
