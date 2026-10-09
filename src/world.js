import * as THREE from 'three';
import { createPracticeView } from './practice-view.js';

// Everything with substantial collision has one corresponding, named AABB.
// Decorations intentionally stay outside the playable path or below ankle height.
export function createWorld() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#9eb4bb');
  scene.fog = new THREE.FogExp2('#9eb4bb', 0.0108);
  const objects = new Map();
  const obstacles = [];
  const dynamicObjects = [];
  const hookTargets = [];
  const animated = [];
  let seed = 7419;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

  const materials = {
    stone: new THREE.MeshStandardMaterial({ color: '#65736b', roughness: 0.91 }),
    darkStone: new THREE.MeshStandardMaterial({ color: '#3a514c', roughness: 0.87 }),
    paleStone: new THREE.MeshStandardMaterial({ color: '#98a191', roughness: 0.86 }),
    gold: new THREE.MeshStandardMaterial({ color: '#bd9659', metalness: 0.68, roughness: 0.36 }),
    darkGold: new THREE.MeshStandardMaterial({ color: '#7b684b', metalness: 0.6, roughness: 0.52 }),
    glow: new THREE.MeshStandardMaterial({ color: '#9ffff0', emissive: '#69eaca', emissiveIntensity: 1.7, roughness: 0.3 }),
    dimGlow: new THREE.MeshStandardMaterial({ color: '#85c6b5', emissive: '#45b9a6', emissiveIntensity: 0.55 }),
    grass: new THREE.MeshStandardMaterial({ color: '#557666', roughness: 1, side: THREE.DoubleSide }),
    trunk: new THREE.MeshStandardMaterial({ color: '#555346', roughness: 1 }),
    leaves: new THREE.MeshStandardMaterial({ color: '#294e48', roughness: 1 }),
    wood: new THREE.MeshStandardMaterial({ color: '#8b7656', roughness: 0.86 }),
    woodDark: new THREE.MeshStandardMaterial({ color: '#524e3e', roughness: 0.82 }),
    iron: new THREE.MeshStandardMaterial({ color: '#344a47', metalness: 0.65, roughness: 0.48 }),
    fire: new THREE.MeshBasicMaterial({ color: '#ffdc96', transparent: true, opacity: 0.9 }),
  };

  const hemi = new THREE.HemisphereLight('#d4e8f1', '#344d40', 2.3);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffe5b2', 3.4);
  sun.position.set(-24, 37, 17);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -38, right: 38, top: 38, bottom: -38, near: 1, far: 110 });
  sun.shadow.normalBias = 0.04;
  sun.shadow.bias = -0.00015;
  sun.target.position.set(0, 0, -3);
  scene.add(sun, sun.target);

  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 12);
  const dummy = new THREE.Object3D();

  function decorativeBox(position, size, material, parent = scene) {
    const mesh = new THREE.Mesh(boxGeometry, material);
    mesh.position.set(...position);
    mesh.scale.set(...size);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function body(id, name, position, size, material, options = {}) {
    const mesh = decorativeBox(position, size, material);
    mesh.name = name;
    mesh.userData.bodyId = id;
    mesh.userData.hookable = !!options.hookable;
    objects.set(id, mesh);
    const description = { id, name, position: [...position], size: [...size] };
    if (options.mass) dynamicObjects.push({ ...description, mass: options.mass });
    else obstacles.push(description);
    if (options.hookable) hookTargets.push(mesh);
    return mesh;
  }

  function torus(position, radius, tube, material, rotation = [Math.PI / 2, 0, 0], parent = scene) {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 6, 48), material);
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    parent.add(mesh);
    return mesh;
  }

  function textSign(text, position, width, color = '#d0dacf', rotationX = -Math.PI / 2) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.font = '500 43px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(text, 512, 64);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width / 8), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.9 }));
    mesh.position.set(...position);
    mesh.rotation.x = rotationX;
    scene.add(mesh);
    return mesh;
  }

  // A stone island above a sea. The single ground collider exactly meets y = 0.
  body('ground', 'Terrace', [0, -0.75, 0], [64, 1.5, 64], materials.darkStone);
  decorativeBox([0, -2.1, 0], [62, 1.5, 62], materials.darkStone);
  const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(3.92, 0.028, 3.92), materials.stone, 256);
  const tileColor = new THREE.Color();
  for (let z = 0; z < 16; z++) {
    for (let x = 0; x < 16; x++) {
      const i = z * 16 + x;
      dummy.position.set(-30 + x * 4, -0.003, -30 + z * 4);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      tiles.setMatrixAt(i, dummy.matrix);
      tileColor.setHSL(0.30 + random() * 0.04, 0.08 + random() * 0.07, 0.32 + random() * 0.12);
      tiles.setColorAt(i, tileColor);
    }
  }
  tiles.receiveShadow = true;
  scene.add(tiles);

  // Brass paths link the three practice areas without obstructing movement.
  for (const x of [-2.65, 2.65]) decorativeBox([x, 0.025, -4], [0.042, 0.012, 39], materials.darkGold);
  for (const z of [1.4, 6.6]) decorativeBox([10, 0.025, z], [14.7, 0.012, 0.042], materials.darkGold);
  for (const z of [-23, -12, 0]) {
    const inlay = decorativeBox([0, 0.024, z], [0.62, 0.014, 0.62], materials.darkGold);
    inlay.rotation.y = Math.PI / 4;
  }
  for (const x of [-31.8, 31.8]) decorativeBox([x, 0.07, 0], [0.4, 0.14, 64], materials.paleStone);
  for (const z of [-31.8, 31.8]) decorativeBox([0, 0.07, z], [64, 0.14, 0.4], materials.paleStone);

  // Meditation dais: a shallow, accessible square plinth with an inlaid circle.
  body('meditation-plinth', 'Meditation dais', [0, 0.11, 15], [8.4, 0.22, 8.4], materials.darkStone);
  torus([0, 0.235, 15], 3.5, 0.033, materials.gold);
  torus([0, 0.237, 15], 3.24, 0.015, materials.dimGlow);
  torus([0, 0.24, 15], 1.55, 0.018, materials.gold);
  for (let i = 0; i < 12; i++) {
    const angle = i / 12 * Math.PI * 2;
    const mark = decorativeBox([Math.sin(angle) * 2.94, 0.238, 15 + Math.cos(angle) * 2.94], [0.036, 0.012, i % 3 === 0 ? 0.36 : 0.16], i % 3 === 0 ? materials.glow : materials.gold);
    mark.rotation.y = angle;
  }
  textSign('THE STILL CIRCLE', [0, 0.245, 18.85], 6.2, '#d5c49d');
  const daisLight = new THREE.PointLight('#7ceccc', 8, 9, 2);
  daisLight.position.set(0, 1.2, 15);
  scene.add(daisLight);

  // A pair of substantial frames gives several heights and lines for swinging.
  for (let archIndex = 0; archIndex < 2; archIndex++) {
    const z = archIndex === 0 ? -7 : -17;
    const y = archIndex === 0 ? 7.1 : 8.4;
    const halfWidth = archIndex === 0 ? 8.2 : 9.2;
    for (const side of [-1, 1]) {
      const x = side * halfWidth;
      body(`frame-${archIndex}-post-${side}`, 'Stone anchor pillar', [x, (y - 0.35) / 2, z], [1.3, y - 0.35, 1.6], materials.paleStone, { hookable: true });
      body(`frame-${archIndex}-foot-${side}`, 'Pillar footing', [x, 0.26, z], [2.05, 0.52, 2.3], materials.darkStone, { hookable: true });
      decorativeBox([x, y - 1.05, z], [1.42, 0.18, 1.74], materials.darkGold);
      decorativeBox([x, 1.05, z], [1.38, 0.11, 1.69], materials.darkGold);
      decorativeBox([x, y / 2, z + 0.817], [0.065, y - 2.2, 0.025], materials.dimGlow);
    }
    const beamId = `frame-${archIndex}-beam`;
    body(beamId, 'High anchor beam', [0, y, z], [halfWidth * 2 + 2, 0.72, 1.75], materials.darkStone, { hookable: true });
    decorativeBox([0, y + 0.38, z], [halfWidth * 2 + 2.3, 0.13, 1.96], materials.paleStone);
    decorativeBox([0, y - 0.14, z + 0.886], [halfWidth * 2 + 1.7, 0.055, 0.032], materials.gold);
    for (const x of [-4.4, 0, 4.4]) {
      const anchorId = `frame-${archIndex}-anchor-${x}`;
      const anchorBody = body(anchorId, 'Brass hook anchor', [x, y - 0.77, z + 0.2], [1.1, 1.1, 0.22], materials.gold);
      anchorBody.visible = false;
      // The hook can catch through the ring opening, not just its thin visible rim.
      hookTargets.push(anchorBody);
      const ring = torus([x, y - 0.77, z + 0.2], 0.46, 0.09, materials.gold, [0, 0, 0]);
      ring.castShadow = true;
      ring.name = 'Hook anchor ring';
      ring.userData.bodyId = anchorId;
      ring.userData.hookable = true;
      hookTargets.push(ring);
      decorativeBox([x, y - 0.32, z + 0.2], [0.11, 0.38, 0.11], materials.gold);
      torus([x, y - 0.77, z + 0.21], 0.33, 0.018, materials.glow, [0, 0, 0]);
    }
  }
  textSign('THE CROSSING', [0, 0.035, -2.9], 6.6, '#c4c6ad');

  // Catchable raised terraces make pulling yourself upward a useful action.
  body('left-platform', 'Raised landing', [-14, 1.3, -11], [6, 2.6, 6], materials.darkStone, { hookable: true });
  decorativeBox([-14, 2.64, -11], [6.05, 0.08, 6.05], materials.paleStone);
  for (const x of [-16.6, -11.4]) decorativeBox([x, 2.69, -11], [0.035, 0.018, 5.2], materials.gold);
  body('right-platform', 'High landing', [14.2, 2, -17], [6.5, 4, 6.5], materials.darkStone, { hookable: true });
  decorativeBox([14.2, 4.045, -17], [6.58, 0.09, 6.58], materials.paleStone);
  torus([14.2, 4.1, -17], 2.4, 0.03, materials.gold);

  // The receiving mark is paint/inlay, never an invisible obstacle.
  torus([12, 0.034, 4], 2.45, 0.045, materials.gold);
  torus([12, 0.032, 4], 2.14, 0.023, materials.dimGlow);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    const dash = decorativeBox([12 + Math.sin(a) * 2.6, 0.036, 4 + Math.cos(a) * 2.6], [0.07, 0.017, 0.52], materials.gold);
    dash.rotation.y = a;
  }
  textSign('WEIGHT & WILL', [12, 0.04, 8.0], 7, '#c4c6ad');

  function crate(id, position, mass) {
    const mesh = body(id, mass < 30 ? 'Supply crate · 15 kg' : 'Ironbound crate · 40 kg', position, [2, 2, 2], materials.wood, { mass, hookable: true });
    // Child measurements are in unit-cube coordinates; the body scales them.
    for (const x of [-0.32, 0.32]) {
      const band = decorativeBox([x, 0, 0], [0.065, 1.018, 1.018], materials.iron, mesh);
      band.userData.bodyId = id;
    }
    for (const z of [-0.505, 0.505]) {
      for (const y of [-0.23, 0.23]) {
        const seam = decorativeBox([0, y, z], [0.99, 0.012, 0.012], materials.woodDark, mesh);
        seam.userData.bodyId = id;
      }
    }
    const badge = decorativeBox([0, 0.02, 0.516], [0.21, 0.21, 0.025], materials.gold, mesh);
    badge.rotation.z = Math.PI / 4;
    badge.userData.bodyId = id;
    mesh.traverse(child => { child.userData.bodyId = id; });
  }
  crate('crate-light', [5, 1, 5], 15);
  crate('crate-heavy', [-6, 1, -3], 40);

  // Actor practice fits beside the existing crossing, leaving its main approach
  // and both movable crates unobstructed. Every raised piece has a real collider.
  body('practice-rescue-platform', 'Rescue ledge', [11, 3.5, 0], [6, 1, 5], materials.darkStone, { hookable: true });
  decorativeBox([11, 4.035, 0], [6.05, 0.07, 5.05], materials.paleStone);
  for (const x of [8.12, 13.88]) decorativeBox([x, 4.078, 0], [0.045, 0.015, 4.55], materials.gold);
  // Slim supports remain well inside the platform's footprint.
  for (const x of [9, 13]) body(`practice-rescue-support-${x}`, 'Ledge support', [x, 1.5, 0], [0.7, 3, 0.7], materials.darkStone);
  textSign('RESCUE LEDGE', [11, 4.082, 1.65], 4.6, '#d6e9d7');
  body('practice-slam-wall', 'Impact wall', [-13, 1.5, 3], [1, 3, 7], materials.darkStone, { hookable: true });
  decorativeBox([-13, 3.04, 3], [1.08, 0.08, 7.08], materials.paleStone);
  for (const z of [0.3, 3, 5.7]) decorativeBox([-12.485, 1.5, z], [0.025, 2.25, 0.045], materials.gold);
  textSign('TETHER TRIAL', [-7, 0.045, 8.4], 6, '#dbb895');
  torus([-7, 0.033, 5], 1.8, 0.024, materials.darkGold);

  // Bodies are owned by SourceSimulation; these descriptors stay serializable.
  // Actor transforms are rendered by updatePractice, independently of crates.
  const actors = [
    { id: 'practice-rival', name: 'Practice rival', role: 'rival', friendly: false, position: [-7, 0.9, 5], size: [0.8, 1.8, 0.7], mass: 70 },
    { id: 'practice-ally', name: 'Practice ally', role: 'ally', friendly: true, position: [7, 0.9, 5], size: [0.8, 1.8, 0.7], mass: 70 },
  ];
  const practiceView = createPracticeView({ scene, actors, objects, hookTargets });

  // Fragmented sanctum at the far end: an architectural destination, not a wall.
  for (const x of [-4, 4]) {
    body(`sanctum-column-${x}`, 'Sanctum pillar', [x, 3.6, -27], [1.4, 7.2, 1.4], materials.paleStone, { hookable: true });
    decorativeBox([x, 7.2, -27], [1.85, 0.28, 1.85], materials.darkStone);
    decorativeBox([x, 0.3, -27], [1.75, 0.5, 1.75], materials.darkStone);
  }
  body('sanctum-lintel', 'Sanctum lintel', [0, 7.65, -27], [10, 0.65, 1.8], materials.darkStone, { hookable: true });
  const halo = torus([0, 4.9, -27.3], 2.05, 0.06, materials.darkGold, [0, 0, 0]);
  const innerHalo = torus([0, 4.9, -27.28], 1.86, 0.023, materials.dimGlow, [0, 0, 0]);
  animated.push({ type: 'halo', mesh: innerHalo });
  const floatingGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.3), materials.glow);
  floatingGem.position.set(0, 4.9, -27.1);
  scene.add(floatingGem);
  animated.push({ type: 'gem', mesh: floatingGem, baseY: 4.9 });

  function fireBowl(x, z) {
    body(`brazier-${x}-${z}`, 'Brazier pedestal', [x, 0.55, z], [0.8, 1.1, 0.8], materials.darkStone);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.36, 0.26, 10), materials.darkGold);
    bowl.position.set(x, 1.16, z);
    scene.add(bowl);
    const flame = new THREE.Mesh(new THREE.OctahedronGeometry(0.23), materials.fire);
    flame.position.set(x, 1.54, z);
    flame.scale.set(1, 1.6, 1);
    scene.add(flame);
    const light = new THREE.PointLight('#ffbb64', 5, 6, 2);
    light.position.set(x, 1.7, z);
    scene.add(light);
    animated.push({ type: 'flame', mesh: flame, light, offset: x + z });
  }
  fireBowl(-5.5, 13.5);
  fireBowl(5.5, 13.5);
  fireBowl(-5.5, -25);
  fireBowl(5.5, -25);

  // Repeated vegetation is instanced to leave budget for the actual creations.
  const trees = [[-23, 20, 1.1], [-26, 9, 1.35], [-25, -5, 1], [-22, -23, 1.4], [25, 19, 1.25], [27, 3, 1.1], [25, -8, 1.35], [23, -25, 1.3]];
  const trunks = new THREE.InstancedMesh(cylinderGeometry, materials.trunk, trees.length);
  const crowns = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), materials.leaves, trees.length * 3);
  trees.forEach(([x, z, scale], i) => {
    dummy.position.set(x, 1.55 * scale, z);
    dummy.scale.set(0.24 * scale, 3.1 * scale, 0.24 * scale);
    dummy.rotation.set(0, i, 0);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    for (let j = 0; j < 3; j++) {
      dummy.position.set(x, (3.15 + j * 1.17) * scale, z);
      dummy.scale.set((1.35 - j * 0.29) * scale, (4.2 - j * 0.6) * scale, (1.35 - j * 0.29) * scale);
      dummy.updateMatrix();
      crowns.setMatrixAt(i * 3 + j, dummy.matrix);
    }
    // AABB trunks are slim enough that foliage doesn't become an invisible wall.
    obstacles.push({ id: `tree-${i}`, name: 'Cypress trunk', position: [x, 1.55 * scale, z], size: [0.48 * scale, 3.1 * scale, 0.48 * scale] });
  });
  trunks.castShadow = crowns.castShadow = true;
  scene.add(trunks, crowns);

  const grassGeometry = new THREE.BufferGeometry();
  grassGeometry.setAttribute('position', new THREE.Float32BufferAttribute([-0.12, 0, 0, 0.05, 0.62, 0, 0.12, 0, 0, 0, 0, -0.12, 0, 0.53, 0.06, 0, 0, 0.12], 3));
  grassGeometry.computeVertexNormals();
  const grass = new THREE.InstancedMesh(grassGeometry, materials.grass, 380);
  for (let i = 0; i < 380; i++) {
    const side = random() > 0.5 ? 1 : -1;
    dummy.position.set(side * (20 + random() * 10), 0.015, -30 + random() * 58);
    dummy.rotation.set(0, random() * Math.PI * 2, 0);
    const s = 0.5 + random() * 1.0;
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    grass.setMatrixAt(i, dummy.matrix);
  }
  scene.add(grass);

  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), materials.darkStone, 30);
  for (let i = 0; i < 30; i++) {
    const a = random() * Math.PI * 2;
    const r = 35 + random() * 6;
    dummy.position.set(Math.cos(a) * r, -2.1 - random() * 1.3, Math.sin(a) * r);
    dummy.rotation.set(random(), random(), random());
    dummy.scale.set(2 + random() * 2, 2 + random() * 2, 2 + random() * 3);
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
  }
  rocks.castShadow = true;
  scene.add(rocks);

  const water = new THREE.Mesh(new THREE.PlaneGeometry(620, 620, 60, 60).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uFog: { value: new THREE.Color('#9eb4bb') } },
    vertexShader: `varying vec3 vWorld; uniform float uTime;
      void main() { vec3 p = position; p.y += sin(p.x * .18 + uTime * .48) * .09 + cos(p.z * .23 - uTime * .35) * .07;
      vec4 world = modelMatrix * vec4(p, 1.); vWorld = world.xyz; gl_Position = projectionMatrix * viewMatrix * world; }`,
    fragmentShader: `varying vec3 vWorld; uniform float uTime; uniform vec3 uFog;
      void main() { float wave = sin(vWorld.x * .78 + sin(vWorld.z * .21 + uTime * .25) * 2. + uTime * .5);
      float ripple = pow(max(0., wave), 16.) * .075; float broad = sin(vWorld.x * .035 + vWorld.z * .045) * .025;
      vec3 col = vec3(.075,.22,.23) + ripple + broad;
      float dist = length(cameraPosition - vWorld); col = mix(col,uFog,1. - exp(-dist * dist * .000095)); gl_FragColor = vec4(col, 1.); }`,
  }));
  water.position.y = -3.8;
  scene.add(water);

  const mountainMat = new THREE.MeshStandardMaterial({ color: '#5f7c7b', roughness: 1, flatShading: true });
  const mountains = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 5), mountainMat, 23);
  for (let i = 0; i < 23; i++) {
    const a = i / 23 * Math.PI * 2;
    const r = 104 + random() * 48;
    const height = 24 + random() * 62;
    dummy.position.set(Math.cos(a) * r, height / 2 - 8, Math.sin(a) * r);
    dummy.rotation.set(0, random() * Math.PI, 0);
    dummy.scale.set(13 + random() * 22, height, 13 + random() * 22);
    dummy.updateMatrix();
    mountains.setMatrixAt(i, dummy.matrix);
  }
  scene.add(mountains);

  const particlesGeo = new THREE.BufferGeometry();
  const particlesPos = new Float32Array(90 * 3);
  for (let i = 0; i < 90; i++) {
    particlesPos[i * 3] = (random() - 0.5) * 48;
    particlesPos[i * 3 + 1] = 0.5 + random() * 8;
    particlesPos[i * 3 + 2] = (random() - 0.5) * 48;
  }
  particlesGeo.setAttribute('position', new THREE.BufferAttribute(particlesPos, 3));
  const particles = new THREE.Points(particlesGeo, new THREE.PointsMaterial({ color: '#b9f7df', size: 0.048, transparent: true, opacity: 0.63, depthWrite: false, sizeAttenuation: true }));
  scene.add(particles);

  function update(time, dt) {
    water.material.uniforms.uTime.value = time;
    particles.rotation.y = time * 0.008;
    particles.position.y = Math.sin(time * 0.32) * 0.18;
    for (const entry of animated) {
      if (entry.type === 'gem') {
        entry.mesh.rotation.y = time * 0.42;
        entry.mesh.position.y = entry.baseY + Math.sin(time * 1.1) * 0.12;
      } else if (entry.type === 'halo') entry.mesh.rotation.z = time * 0.035;
      else if (entry.type === 'flame') {
        const pulse = 1 + Math.sin(time * 8.3 + entry.offset) * 0.09 + Math.sin(time * 13.1 + entry.offset) * 0.06;
        entry.mesh.scale.y = 1.6 * pulse;
        entry.mesh.rotation.y = time * 0.4;
        entry.light.intensity = 5 * pulse;
      }
    }
  }

  return {
    scene, objects, obstacles, dynamicObjects, actors, hookTargets,
    spawn: [0, 1.2, 15], update,
    updatePractice: practiceView.update,
    disposePractice: practiceView.dispose,
  };
}
