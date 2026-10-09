import * as THREE from 'three';
import { clayPreset, sculptClay } from './clay.js';
import { creationFromPreset } from './creation.js';
import { createHook } from './models.js';

/** Solid sculpting editor; each edit flows through the normal design autosave. */
export function initClayWorkshop({ getCreation, onChange, toast }) {
  const $=id=>document.getElementById(id), dialog=$('clay-dialog'), canvas=$('clay-canvas');
  let renderer,scene,camera,model,ghost,drag=null,historyId=null;
  const undo=[],redo=[],ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
  function render() {
    if(!renderer || !dialog.open)return;
    const r=canvas.getBoundingClientRect();renderer.setSize(r.width,r.height,false);
    camera.aspect=r.width/r.height;camera.updateProjectionMatrix();renderer.render(scene,camera);
  }
  function sync() {
    if(!dialog.open || getCreation().form!=='clay')return;
    const rotation=model?.group.rotation.clone();
    if(model){scene.remove(model.group);model.dispose();}
    model=createHook(getCreation());
    if(rotation)model.group.rotation.copy(rotation);
    scene.add(model.group);
    $('clay-purpose').value=getCreation().solid.purpose;
    ghost.visible=$('clay-guide').checked && getCreation().solid.purpose==='armor';
    ghost.rotation.copy(model.group.rotation);
    $('clay-undo').disabled=!undo.length;$('clay-redo').disabled=!redo.length;
    render();
  }
  function remember(){undo.push(structuredClone(getCreation()));if(undo.length>24)undo.shift();redo.length=0;}
  function change(solid){onChange({...getCreation(),solid});sync();}
  function initialize() {
    renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    scene=new THREE.Scene();scene.add(new THREE.HemisphereLight('#ffffff','#31534f',3));
    const light=new THREE.DirectionalLight('#fff0d1',4);light.position.set(-3,4,5);scene.add(light);
    camera=new THREE.PerspectiveCamera(40,1,.01,30);camera.position.set(0,0,3.8);
    ghost=new THREE.Group();
    const material=new THREE.MeshBasicMaterial({color:'#dfbd78',wireframe:true,transparent:true,opacity:.3,depthTest:false});
    for(const x of [-.25,.25]){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,1.35,8),material);mesh.position.set(x,-.12,0);ghost.add(mesh);}
    scene.add(ghost);
  }
  function open() {
    if(getCreation().form!=='clay') onChange({...creationFromPreset('orb'),form:'clay',name:'Clay of the Source',solid:clayPreset()});
    if(historyId!==getCreation().id){undo.length=0;redo.length=0;historyId=getCreation().id;}
    dialog.showModal();if(!renderer)initialize();sync();$('clay-close').focus();
  }
  $('open-clay').onclick=open;
  $('clay-close').onclick=()=>dialog.close();
  dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();dialog.close();}});
  dialog.addEventListener('close',()=>{drag=null;toast('Solid design autosaved. Use Save creation to keep it in your library.');});
  for(const kind of ['ball','pants','sword'])$(`clay-${kind}`).onclick=()=>{remember();change(clayPreset(kind));};
  $('clay-purpose').onchange=()=>{remember();change({...getCreation().solid,purpose:$('clay-purpose').value});};
  $('clay-guide').onchange=sync;
  for(const [id,from,to] of [['clay-undo',undo,redo],['clay-redo',redo,undo]])$(id).onclick=()=>{
    if(!from.length)return;to.push(structuredClone(getCreation()));onChange(from.pop());sync();
  };
  function edit(point,delta=[0,0,0]) {
    change(sculptClay(getCreation().solid,{point,delta,tool:$('clay-tool').value,radius:Number($('clay-radius').value),symmetry:$('clay-symmetry').checked}));
  }
  function locate(event) {
    const r=canvas.getBoundingClientRect();pointer.set((event.clientX-r.left)/r.width*2-1,1-(event.clientY-r.top)/r.height*2);
    scene.updateMatrixWorld(true);ray.setFromCamera(pointer,camera);
    const hit=ray.intersectObject(model.group,true)[0];
    if(hit)return model.group.worldToLocal(hit.point.clone());
    const point=new THREE.Vector3();
    if(ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,0,1),0),point))return model.group.worldToLocal(point);
    return null;
  }
  canvas.oncontextmenu=e=>e.preventDefault();
  canvas.onpointerdown=e=>{
    const p=locate(e);if(!p)return;e.preventDefault();canvas.setPointerCapture(e.pointerId);
    if(e.button===0)remember();
    drag={point:p,last:[e.clientX,e.clientY],rotate:e.button===2,pointer:e.pointerId};
    if(!drag.rotate && $('clay-tool').value!=='pull')edit(p.toArray());
  };
  canvas.onpointermove=e=>{
    if(!drag || drag.pointer!==e.pointerId)return;
    const dx=e.clientX-drag.last[0],dy=e.clientY-drag.last[1];
    if(Math.hypot(dx,dy)<3)return;
    if(drag.rotate){model.group.rotation.y+=dx*.01;model.group.rotation.x+=dy*.01;ghost.rotation.copy(model.group.rotation);render();}
    else {
      const delta=new THREE.Vector3(dx/canvas.clientHeight*2.8,-dy/canvas.clientHeight*2.8,0).applyQuaternion(model.group.quaternion.clone().invert());
      const p=$('clay-tool').value==='pull'?drag.point:locate(e);
      if(p){edit(p.toArray(),delta.toArray());drag.point=p.clone().add(delta);}
    }
    drag.last=[e.clientX,e.clientY];
  };
  const end=()=>drag=null;
  canvas.onpointerup=end;canvas.onpointercancel=end;canvas.onlostpointercapture=end;
  $('clay-stamp').onclick=()=>{remember();edit(['x','y','z'].map(a=>Number($(`clay-${a}`).value)),[0,.18,0]);};
  for(const [id,axis,amount] of [['clay-left','y',-.35],['clay-right','y',.35],['clay-up','x',-.35],['clay-down','x',.35]])$(id).onclick=()=>{model.group.rotation[axis]+=amount;ghost.rotation.copy(model.group.rotation);render();};
  new ResizeObserver(render).observe(canvas);
  return {sync,open};
}
