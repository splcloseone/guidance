import * as THREE from 'three';
/** The orb is a world mesh in front of the seated character, never a HUD image. */
export function createSummoningView(avatar){
  const group=new THREE.Group();group.position.set(0,.82,-1.05);avatar.group.add(group);
  const material=new THREE.MeshStandardMaterial({color:'#ffffff',emissive:'#ffffff',emissiveIntensity:1.6,roughness:.18});
  const orb=new THREE.Mesh(new THREE.SphereGeometry(.20,20,14),material);group.add(orb);
  const glow=new THREE.Mesh(new THREE.SphereGeometry(.26,16,12),new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.18,depthWrite:false}));group.add(glow);
  const rings=[];
  for(let i=0;i<2;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(.35,.009,4,48),new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.6}));ring.rotation.set(i*.8,.6,i);group.add(ring);rings.push(ring);}
  let burst=0;
  return {
    event(e){if(e.type==='summoned')burst=.28;},
    visible:()=>group.visible,
    update(meditating,dt,time){
      burst=Math.max(0,burst-dt);group.visible=meditating||burst>0;
      const size=meditating?1:Math.max(.08,burst/.28);group.scale.setScalar(size);
      group.position.y=(meditating?.82:1.08)+Math.sin(time*2)*.04;
      group.position.z=meditating?-1.05:-.7;
      glow.scale.setScalar(1+Math.sin(time*4)*.1);rings.forEach((ring,i)=>{ring.rotation.y=time*(i?-.7:.8);ring.rotation.z=time*.45+i;});
    },
  };
}
