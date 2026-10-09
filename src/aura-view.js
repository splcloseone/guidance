import * as THREE from 'three';
/** Animated back-face extrusion follows each body/weapon mesh, including articulated parts. */
export function createAuraView(){
  const material=new THREE.ShaderMaterial({
    uniforms:{time:{value:0},width:{value:.045}},side:THREE.BackSide,depthWrite:false,
    vertexShader:`uniform float time;uniform float width;void main(){float wave=sin(position.y*34.0+position.x*19.0+time*8.0)*.5+.5;vec3 p=position+normal*width*(.8+wave*.8);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`,
    fragmentShader:'void main(){gl_FragColor=vec4(1.0,1.0,1.0,1.0);}',
  });
  const layers=[];
  function add(root){
    const meshes=[];root.traverse(o=>{if(o.isMesh&&!o.userData.aura&&o.geometry.attributes.normal)meshes.push(o);});
    for(const mesh of meshes){const shell=new THREE.Mesh(mesh.geometry,material);shell.userData.aura=true;shell.raycast=()=>{};shell.visible=false;mesh.add(shell);layers.push(shell);}
  }
  function remove(root){for(let i=layers.length-1;i>=0;i--){let parent=layers[i];while(parent&&parent!==root)parent=parent.parent;if(parent){layers[i].removeFromParent();layers.splice(i,1);}}}
  return {add,remove,update(active,time){material.uniforms.time.value=time;layers.forEach(shell=>shell.visible=active);},visible:()=>layers.some(s=>s.visible)};
}
