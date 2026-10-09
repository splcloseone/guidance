import * as THREE from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { CLAY_SIZE, decodeClay } from './clay.js';
export function clayGeometry(solid) {
  const material = new THREE.MeshBasicMaterial();
  const mc = new MarchingCubes(CLAY_SIZE, material, false, false, 50000);
  mc.isolation=128;
  mc.field.set(decodeClay(solid.data)); mc.update();
  const count=mc.geometry.drawRange.count;
  const geometry=new THREE.BufferGeometry();
  for(const key of ['position','normal']) geometry.setAttribute(key,new THREE.BufferAttribute(mc.geometry.attributes[key].array.slice(0,count*3),3));
  geometry.computeBoundingSphere(); mc.geometry.dispose();material.dispose();
  return geometry;
}
