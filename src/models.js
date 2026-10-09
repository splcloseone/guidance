import * as THREE from 'three';
import { normalizeCreation } from './creation.js';

function creationPath(points, assisted, closed) {
  const vectors = points.map(point => new THREE.Vector3(...point));
  if (assisted) return new THREE.CatmullRomCurve3(vectors, closed, 'centripetal');
  const path = new THREE.CurvePath();
  for (let index = 1; index < vectors.length; index++) path.add(new THREE.LineCurve3(vectors[index - 1], vectors[index]));
  if (closed) path.add(new THREE.LineCurve3(vectors.at(-1), vectors[0]));
  return path;
}

/**
 * Render the serializable shape shared by the workshop and the manifested tether.
 * Size is applied by the caller so the same mesh also works in a fixed-scale preview.
 * A string remains accepted for older integrations that only supply a color.
 */
export function createHook(settings = '#8fdcc8') {
  const creation = normalizeCreation(typeof settings === 'string' ? { color: settings } : settings);
  const group = new THREE.Group();
  group.userData.creationForm = creation.form;
  const material = new THREE.MeshStandardMaterial({ color: creation.color, metalness: .54, roughness: .24, emissive: creation.color, emissiveIntensity: .34 });
  const { points, thickness, assisted } = creation.shape;
  if (creation.form === 'orb') {
    const bounds = new THREE.Box3().setFromPoints(points.map(point => new THREE.Vector3(...point)));
    const radii = bounds.getSize(new THREE.Vector3()).multiplyScalar(.5);
    // Orb handles stretch the ball on each axis. They do not imply an articulated creature.
    radii.set(Math.max(.08, radii.x), Math.max(.08, radii.y), Math.max(.08, radii.z));
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), material);
    body.scale.copy(radii);
    bounds.getCenter(body.position);
    group.add(body);
  } else {
    const closed = creation.form === 'lasso';
    const curve = creationPath(points, assisted, closed);
    const geometry = new THREE.TubeGeometry(curve, Math.max(36, points.length * 10), thickness, 10, closed);
    const body = new THREE.Mesh(geometry, material);
    group.add(body);
    if (creation.form === 'claw') {
      // Three prongs share one editable profile and one geometry allocation.
      for (const angle of [Math.PI * 2 / 3, Math.PI * 4 / 3]) {
        const prong = new THREE.Mesh(geometry, material);
        prong.rotation.y = angle;
        group.add(prong);
      }
    }
    // In particular, a lasso has only the user-shaped loop: no fixed hook tip or collar.
  }
  group.traverse(object => { if (object.isMesh) object.castShadow = true; });
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    const geometries = new Set(), materials = new Set();
    group.traverse(object => {
      if (!object.isMesh) return;
      geometries.add(object.geometry);
      for (const item of Array.isArray(object.material) ? object.material : [object.material]) materials.add(item);
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(item => item.dispose());
  };
  return { group, material, dispose };
}

export function createAvatar() {
  const group = new THREE.Group();
  const cloth = new THREE.MeshStandardMaterial({ color: '#e8decb', roughness: .85 });
  const dark = new THREE.MeshStandardMaterial({ color: '#203a40', roughness: .85 });
  const skin = new THREE.MeshStandardMaterial({ color: '#c99672', roughness: .78 });
  const brass = new THREE.MeshStandardMaterial({ color: '#c5a16a', metalness: .7, roughness: .34 });
  const mesh = (geometry, material, x, y, z, parent = group) => {
    const result = new THREE.Mesh(geometry, material); result.position.set(x,y,z);
    result.castShadow = true; result.receiveShadow = true; parent.add(result); return result;
  };
  mesh(new THREE.CapsuleGeometry(.24, .38, 4, 8), cloth, 0, .9, 0);
  mesh(new THREE.CylinderGeometry(.26,.24,.08,10), brass, 0, .66, 0);
  mesh(new THREE.SphereGeometry(.18, 12, 10), skin, 0, 1.36, -.02);
  const hair = mesh(new THREE.SphereGeometry(.19,12,8,0,Math.PI*2,0,Math.PI*.64), dark, 0, 1.40, .015);
  hair.rotation.x = -.2;
  mesh(new THREE.ConeGeometry(.36,.71,6), dark,0,.80,.18).rotation.x=-.18;
  const legs = [], arms = [];
  for (const sign of [-1,1]) {
    const leg = new THREE.Group(); leg.position.set(sign*.13,.59,0); group.add(leg);
    mesh(new THREE.CapsuleGeometry(.095,.28,3,8),dark,0,-.21,0,leg);
    mesh(new THREE.BoxGeometry(.18,.14,.28),dark,0,-.49,-.035,leg); legs.push(leg);
    const arm = new THREE.Group(); arm.position.set(sign*.27,1.08,0); group.add(arm);
    mesh(new THREE.CapsuleGeometry(.085,.26,3,8),cloth,sign*.025,-.16,0,arm);
    mesh(new THREE.CylinderGeometry(.098,.098,.12,8),brass,sign*.025,-.32,0,arm);
    mesh(new THREE.SphereGeometry(.082,8,6),skin,sign*.025,-.40,0,arm); arms.push(arm);
  }
  const aura = new THREE.Mesh(new THREE.TorusGeometry(.41,.012,6,48),new THREE.MeshBasicMaterial({color:'#8fdcc8',transparent:true,opacity:.65}));
  aura.rotation.x=Math.PI/2; aura.position.y=.05; group.add(aura);
  return {group,legs,arms,aura};
}
