import * as THREE from 'three';
import { createHook } from './models.js';

/** Animation and feedback only. Damage is emitted by the simulation. */
export function createCombatView(avatar, scene, camera) {
  const white=new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.7,depthWrite:false});
  const aura=new THREE.Group(), flares=[];
  for(let i=0;i<14;i++){
    const flare=new THREE.Mesh(new THREE.ConeGeometry(.06,.6,3),white);
    const angle=i/14*Math.PI*2;
    flare.position.set(Math.cos(angle)*.38,.25+(i%4)*.29,Math.sin(angle)*.32);flare.rotation.z=-Math.cos(angle)*.2;
    aura.add(flare);flares.push(flare);
  }
  avatar.group.add(aura);
  const pulse=new THREE.Mesh(new THREE.TorusGeometry(.55,.018,5,48),white.clone());pulse.rotation.x=Math.PI/2;pulse.position.y=.05;avatar.group.add(pulse);
  const fists=avatar.arms.map(arm=>{const mesh=new THREE.Mesh(new THREE.IcosahedronGeometry(.12,1),white);mesh.position.y=-.4;arm.add(mesh);return mesh;});
  const sword=new THREE.Group();sword.position.y=-.40;avatar.arms[1].add(sword);
  const steel=new THREE.MeshStandardMaterial({color:'#c7d4dc',metalness:.85,roughness:.24});
  const brass=new THREE.MeshStandardMaterial({color:'#c5a16a',metalness:.7,roughness:.3});
  const grip=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.24,8),new THREE.MeshStandardMaterial({color:'#382e2c'}));grip.position.y=.04;sword.add(grip);
  const guard=new THREE.Mesh(new THREE.BoxGeometry(.38,.045,.075),brass);guard.position.y=.17;sword.add(guard);
  const bladeShape=new THREE.Shape();bladeShape.moveTo(-.065,.2);bladeShape.lineTo(.065,.2);bladeShape.lineTo(.06,1.13);bladeShape.lineTo(0,1.30);bladeShape.lineTo(-.06,1.13);bladeShape.closePath();
  const blade=new THREE.Mesh(new THREE.ExtrudeGeometry(bladeShape,{depth:.035,bevelEnabled:true,bevelSize:.012,bevelThickness:.01,bevelSegments:1,steps:1}),steel);blade.position.z=-.02;sword.add(blade);
  const coating=new THREE.Mesh(blade.geometry,white);coating.scale.set(1.25,1.01,1.5);sword.add(coating);
  const trailPositions=new Float32Array(18*3),trailGeometry=new THREE.BufferGeometry();trailGeometry.setAttribute('position',new THREE.BufferAttribute(trailPositions,3));
  const trail=new THREE.Line(trailGeometry,new THREE.LineBasicMaterial({color:'#ffffff',transparent:true,opacity:.65}));trail.frustumCulled=false;scene.add(trail);
  let signature='',solid=null,baseVertices=null,pulseAge=10,wasSpiking=false,trailCount=0;
  const numbers=[];let audioContext;
  function sound(type){
    try{
      audioContext ||= new (window.AudioContext||window.webkitAudioContext)();
      if(audioContext.state!=='running')return;
      const osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.connect(gain);gain.connect(audioContext.destination);
      osc.type=type==='aura'?'sine':'triangle';osc.frequency.setValueAtTime(type==='aura'?110:300,audioContext.currentTime);osc.frequency.exponentialRampToValueAtTime(45,audioContext.currentTime+.16);
      gain.gain.setValueAtTime(.04,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+.2);osc.start();osc.stop(audioContext.currentTime+.21);
    }catch{/* Audio support must never block controls. */}
  }
  function unlock(){try{audioContext ||=new(window.AudioContext||window.webkitAudioContext)();audioContext.resume().catch(()=>{});}catch{}}
  window.addEventListener('pointerdown',unlock,{once:true});window.addEventListener('keydown',unlock,{once:true});
  function event(e,sim){
    if(e.type==='aura-spiked')sound('aura');
    if(!['actor-damaged','player-damaged'].includes(e.type))return;
    const point=e.position || sim.bodies.get(e.actorId)?.position.toArray();if(!point)return;
    const el=document.createElement('span');el.className=`damage-number ${e.type==='player-damaged'?'incoming':''} ${e.protected?'protected':''}`;
    el.textContent=`−${Number(e.damage.toFixed(1))}${e.protected?' • guarded':''}`;document.getElementById('damage-layer').append(el);
    numbers.push({el,point:new THREE.Vector3(...point),age:0});
    if(numbers.length>24)numbers.shift().el.remove();sound('hit');
  }
  function update(snapshot,creation,dt,time){
    const c=snapshot.combat;
    aura.visible=c.spiking;fists.forEach(f=>f.visible=c.spiking);coating.visible=c.spiking;
    if(c.spiking&&!wasSpiking)pulseAge=0;wasSpiking=c.spiking;pulseAge+=dt;
    pulse.visible=pulseAge<.65;pulse.scale.setScalar(1+pulseAge*3);pulse.material.opacity=Math.max(0,1-pulseAge/.65);
    flares.forEach((f,i)=>{f.scale.y=.6+(Math.sin(time*13+i*2)+1)*.6;});
    sword.visible=c.weapon==='sword';
    const nextSignature=creation.form==='clay'?JSON.stringify([creation.solid,creation.color]):'';
    if(signature!==nextSignature){
      signature=nextSignature;if(solid){solid.group.removeFromParent();solid.dispose();solid=null;}
      if(nextSignature){solid=createHook(creation);avatar.group.add(solid.group);baseVertices=solid.group.children[0].geometry.attributes.position.array.slice();}
    }
    if(solid){
      solid.group.visible=c.wearing||(c.manifested&&c.weapon==='source-sword');
      solid.material.emissive.set(c.spiking?'#ffffff':creation.color);solid.material.emissiveIntensity=c.spiking?.8:.34;
      const mesh=solid.group.children[0], pos=mesh.geometry.attributes.position;
      if(c.wearing){
        avatar.group.add(solid.group);solid.group.position.set(0,.36,0);solid.group.scale.set(.57,.43,.57);solid.group.rotation.set(0,0,0);
        for(let i=0;i<pos.count;i++){
          const x=baseVertices[i*3],y=baseVertices[i*3+1],z=baseVertices[i*3+2];
          const bend=avatar.legs[x<0?0:1].rotation.x*Math.max(0,Math.min(1,(.38-y)*2));
          pos.setXYZ(i,x,.38+(y-.38)*Math.cos(bend)-z*Math.sin(bend), (y-.38)*Math.sin(bend)+z*Math.cos(bend));
        }pos.needsUpdate=true;mesh.geometry.computeVertexNormals();
      }else{
        avatar.arms[1].add(solid.group);solid.group.position.set(0,.25,0);solid.group.scale.setScalar(.9);solid.group.rotation.set(0,0,0);
        pos.array.set(baseVertices);pos.needsUpdate=true;
      }
    }
    avatar.torso.rotation.set(0,0,0);
    avatar.arms.forEach(arm=>{arm.rotation.y=0;arm.rotation.z=0;});
    const attack=c.attack;
    if(attack){
      const t=attack.t,w=attack.windup,a=attack.active,r=attack.recovery;
      const swing=t<w?-.25*Math.sin(t/w*Math.PI/2):t<w+a?-.25+1.25*(t-w)/a:1-(t-w-a)/r;
      const side=attack.index===1?-1:1;
      avatar.group.rotation.y=Math.atan2(-attack.direction[0],-attack.direction[2]);
      avatar.torso.rotation.y=side*(swing-.3)*.65;
      avatar.torso.rotation.x=attack.index===2?swing*.2:0;
      avatar.arms[1].rotation.set(c.weapon==='fists'?-swing*1.65:-.4-swing*1.7,0,attack.index===2?.15:side*(.8-swing*1.5));
      avatar.arms[0].rotation.x=-.65;
      avatar.legs[1].rotation.x-=Math.sin(Math.min(1,t/(w+a+r))*Math.PI)*.25;
    }else if(sword.visible||c.manifested)avatar.arms[1].rotation.x=-.35;
    const active=attack&&attack.t>=attack.windup&&attack.t<attack.windup+attack.active;
    trail.visible=!!active&&c.spiking&&(sword.visible||c.manifested);
    if(trail.visible){
      avatar.group.updateMatrixWorld(true);const tip=new THREE.Vector3(0,1.25,0).applyMatrix4(sword.matrixWorld);
      if(!trailCount)for(let i=0;i<18;i++)tip.toArray(trailPositions,i*3);
      trailPositions.copyWithin(0,3);tip.toArray(trailPositions,51);trailGeometry.attributes.position.needsUpdate=true;trailCount++;
    }else trailCount=0;
    for(let i=numbers.length-1;i>=0;i--){const n=numbers[i];n.age+=dt;if(n.age>1.2){n.el.remove();numbers.splice(i,1);continue;}
      const point=n.point.clone();point.y+=1+n.age*.8;point.project(camera);
      n.el.hidden=point.z>1||point.z< -1;n.el.style.left=`${(point.x*.5+.5)*innerWidth}px`;n.el.style.top=`${(-point.y*.5+.5)*innerHeight}px`;n.el.style.opacity=String(Math.min(1,(1.2-n.age)*3));
    }
  }
  return {update,event};
}
