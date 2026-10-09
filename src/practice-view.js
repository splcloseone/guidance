import * as THREE from 'three';
import { createAvatar } from './models.js';

const PALETTES = Object.freeze({
  rival: { cloth: '#c18469', dark: '#4c3540', accent: '#ffc38e', label: '#ffd6b0' },
  ally: { cloth: '#93c3b2', dark: '#284b52', accent: '#a2f8df', label: '#c4ffed' },
});

/**
 * The practice actors are ordinary named physics bodies. This layer only draws
 * their snapshot state: it never moves a simulation body or grants a catch.
 * Invisible body-sized proxies are the only actor meshes used for hook aiming.
 */
export function createPracticeView({ scene, actors, objects, hookTargets }) {
  const views = new Map();
  const resources = new Set();
  const own = resource => { resources.add(resource); return resource; };
  const noRaycast = () => {};
  const loopGeometry = own(new THREE.TorusGeometry(0.53, 0.029, 6, 40));
  const hitMaterial = own(new THREE.MeshBasicMaterial({ visible: false }));
  let previousTime = null;

  function makeLabel(name, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 144;
    const context = canvas.getContext('2d');
    const texture = own(new THREE.CanvasTexture(canvas));
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = own(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(3.8, 1.07, 1);
    sprite.position.y = 1.64;
    sprite.raycast = noRaycast;
    let lastStatus = '';

    const update = status => {
      if (status === lastStatus) return;
      lastStatus = status;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = 'rgba(13, 32, 36, 0.85)';
      context.beginPath();
      context.roundRect(14, 13, 484, 117, 15);
      context.fill();
      context.strokeStyle = color;
      context.globalAlpha = 0.5;
      context.lineWidth = 2;
      context.stroke();
      context.globalAlpha = 1;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillStyle = color;
      context.font = '600 28px system-ui, sans-serif';
      context.fillText(name.toUpperCase(), 256, 51);
      context.fillStyle = '#edf1e8';
      context.font = '24px system-ui, sans-serif';
      context.fillText(status, 256, 94);
      texture.needsUpdate = true;
    };
    update('Ready');
    return { sprite, update };
  }

  for (const descriptor of actors) {
    const palette = PALETTES[descriptor.role] || PALETTES.rival;
    const proxy = new THREE.Mesh(own(new THREE.BoxGeometry(...descriptor.size)), hitMaterial);
    proxy.position.set(...descriptor.position);
    proxy.name = descriptor.name;
    proxy.userData = { bodyId: descriptor.id, hookable: true, actorRole: descriptor.role };

    const avatar = createAvatar();
    avatar.group.position.y = -descriptor.size[1] / 2;
    avatar.group.scale.setScalar(1.15);
    avatar.group.traverse(child => {
      child.raycast = noRaycast;
      if (!child.isMesh) return;
      own(child.geometry);
      for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
        own(material);
        const color = material.color?.getHexString();
        if (color === 'e8decb') material.color.set(palette.cloth);
        if (color === '203a40') material.color.set(palette.dark);
      }
    });
    avatar.aura.material.color.set(palette.accent);
    avatar.aura.material.opacity = 0.85;
    avatar.aura.scale.setScalar(1.25);
    proxy.add(avatar.group);

    const collarMaterial = own(new THREE.MeshBasicMaterial({ color: palette.accent, transparent: true, opacity: 0.8 }));
    const collar = new THREE.Mesh(own(new THREE.TorusGeometry(0.29, 0.014, 5, 32)), collarMaterial);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.36;
    collar.raycast = noRaycast;
    proxy.add(collar);

    const boundMaterial = own(new THREE.MeshBasicMaterial({ color: '#d7fff3', transparent: true, opacity: 0.95 }));
    const boundLoop = new THREE.Mesh(loopGeometry, boundMaterial);
    boundLoop.rotation.x = Math.PI / 2;
    boundLoop.position.y = 0.02;
    boundLoop.visible = false;
    boundLoop.raycast = noRaycast;
    proxy.add(boundLoop);

    const label = makeLabel(descriptor.name, palette.label);
    proxy.add(label.sprite);
    scene.add(proxy);
    objects.set(descriptor.id, proxy);
    hookTargets.push(proxy);
    views.set(descriptor.id, { descriptor, proxy, avatar, label, boundLoop, previousPosition: proxy.position.clone(), speed: 0 });
  }

  // The incoming practice tether is a separate connection from the player's
  // creation. Its warm color matches the rival even if the player changes color.
  const incomingPositions = new Float32Array(25 * 3);
  const incomingGeometry = own(new THREE.BufferGeometry());
  incomingGeometry.setAttribute('position', new THREE.BufferAttribute(incomingPositions, 3));
  const incomingMaterial = own(new THREE.LineBasicMaterial({ color: PALETTES.rival.accent, transparent: true, opacity: 0.9 }));
  const incomingLine = new THREE.Line(incomingGeometry, incomingMaterial);
  incomingLine.frustumCulled = false;
  incomingLine.visible = false;
  incomingLine.raycast = noRaycast;
  scene.add(incomingLine);
  const incomingLoop = new THREE.Mesh(loopGeometry, own(new THREE.MeshBasicMaterial({ color: PALETTES.rival.accent, transparent: true, opacity: 0.95 })));
  incomingLoop.rotation.x = Math.PI / 2;
  incomingLoop.visible = false;
  incomingLoop.raycast = noRaycast;
  scene.add(incomingLoop);

  function update(snapshot, time = 0, creation = {}) {
    if (!snapshot) return;
    const dt = previousTime === null ? 1 / 60 : Math.max(1 / 240, Math.min(0.1, time - previousTime));
    previousTime = time;
    const states = new Map((snapshot.actors || []).map(actor => [actor.id, actor]));
    const bodies = new Map((snapshot.objects || []).map(body => [body.id, body]));

    for (const [id, view] of views) {
      const state = states.get(id);
      const body = state || bodies.get(id);
      const { proxy, avatar, label, boundLoop, descriptor } = view;
      if (body?.position) proxy.position.fromArray(body.position);
      if (body?.quaternion) proxy.quaternion.fromArray(body.quaternion);
      const dx = proxy.position.x - view.previousPosition.x;
      const dz = proxy.position.z - view.previousPosition.z;
      const speed = Math.min(12, Math.hypot(dx, dz) / dt);
      view.speed += (speed - view.speed) * Math.min(1, dt * 12);
      if (speed > 0.15 && speed < 12) {
        const angle = Math.atan2(-dx, -dz);
        const current = avatar.group.rotation.y;
        avatar.group.rotation.y += Math.atan2(Math.sin(angle - current), Math.cos(angle - current)) * Math.min(1, dt * 9);
      }
      view.previousPosition.copy(proxy.position);
      const caught = Boolean(state?.caught || snapshot.hook?.bodyId === id);
      const stride = Math.min(0.55, view.speed * 0.15);
      avatar.legs.forEach((leg, index) => { leg.rotation.x = Math.sin(time * 9 + index * Math.PI) * stride; });
      avatar.arms.forEach((arm, index) => { arm.rotation.x = caught ? -0.85 : Math.sin(time * 9 + (1 - index) * Math.PI) * stride * 0.7; });
      if(snapshot.practice?.mode==='melee' && descriptor.role==='rival') {
        const p=snapshot.player.position;
        avatar.group.rotation.y=Math.atan2(proxy.position.x-p[0],proxy.position.z-p[2]);
        if(snapshot.combat?.counterWindup) avatar.arms[1].rotation.x=-1.4;
      }
      avatar.aura.rotation.z = time * 0.4;
      boundLoop.visible = caught;
      boundLoop.material.color.set(creation.color || snapshot.creation?.color || '#d7fff3');
      boundLoop.material.opacity = 0.8 + Math.sin(time * 7) * 0.15;
      const escape = Math.round((state?.escapeProgress || 0) * 100);
      const health = Math.max(0, Math.ceil(state?.health ?? 100));
      let status = descriptor.role === 'ally' ? 'Friendly · ready to rescue' : `Moving rival · ${health} health`;
      if (state?.rescued) status = 'Rescued · safe landing';
      if (caught) status = descriptor.role === 'ally' ? 'Caught · pull to safety' : `Bound · escape ${escape}% · ${health} HP`;
      if (snapshot.incomingTether?.actorId === id) status = 'Holding your tether';
      if (snapshot.practice?.mode==='melee' && descriptor.role==='rival') status = `${snapshot.combat?.counterWindup ? 'COUNTER INCOMING' : 'Sword practice'} · ${health} HP`;
      if (health <= 0) status = 'Down · reset to practice';
      label.update(status);
    }

    const incoming = snapshot.incomingTether;
    incomingLine.visible = incomingLoop.visible = Boolean(incoming && snapshot.player?.position);
    if (incomingLine.visible) {
      const source = incoming.anchor || states.get(incoming.actorId)?.position || views.get(incoming.actorId)?.proxy.position.toArray();
      if (!source) { incomingLine.visible = incomingLoop.visible = false; return; }
      const destination = snapshot.player.position;
      const start = [source[0], source[1] + 0.15, source[2]];
      const end = [destination[0], destination[1] + 0.25, destination[2]];
      const distance = Math.hypot(end[0] - start[0], end[1] - start[1], end[2] - start[2]);
      const sag = Math.min(1.8, Math.max(0, (incoming.length || distance) - distance) * 0.35 + 0.08);
      for (let i = 0; i < 25; i++) {
        const t = i / 24;
        incomingPositions[i * 3] = start[0] + (end[0] - start[0]) * t;
        incomingPositions[i * 3 + 1] = start[1] + (end[1] - start[1]) * t - Math.sin(t * Math.PI) * sag;
        incomingPositions[i * 3 + 2] = start[2] + (end[2] - start[2]) * t;
      }
      incomingGeometry.attributes.position.needsUpdate = true;
      incomingLoop.position.set(...end);
      incomingLoop.material.opacity = 0.75 + Math.sin(time * 9) * 0.2;
    }
  }

  function dispose() {
    for (const [id, { proxy }] of views) {
      scene.remove(proxy);
      if (objects.get(id) === proxy) objects.delete(id);
      const index = hookTargets.indexOf(proxy);
      if (index >= 0) hookTargets.splice(index, 1);
    }
    scene.remove(incomingLine, incomingLoop);
    for (const resource of resources) resource.dispose();
    views.clear();
  }

  return { update, dispose };
}
