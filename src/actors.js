/** Render-independent local practice characters. Multiplayer authority belongs outside this lab. */
export const PRACTICE_ACTORS = Object.freeze([
  { id: 'practice-rival', name: 'Practice rival', role: 'rival', position: [-7, 0.92, 5], size: [0.8, 1.8, 0.7], mass: 70 },
  { id: 'practice-ally', name: 'Practice ally', role: 'ally', position: [7, 0.92, 5], size: [0.8, 1.8, 0.7], mass: 70 },
]);

export const STRUGGLE_RULES = Object.freeze({ minimumInterval: 0.11, decayPerSecond: 0.2, rivalInterval: 0.29, rivalDelay: 1.6 });
// Reinforcement may exceed the workshop's strength slider when the shape is thicker.
export const escapeThreshold = reinforcement => Math.ceil(4 + Math.min(10, Math.max(0.5, Number(reinforcement) || 3)) * .65);

export function createActor(descriptor, body) {
  return {
    id: descriptor.id, name: descriptor.name || descriptor.id, role: descriptor.role === 'ally' ? 'ally' : 'rival', body,
    health: 100, source: 100, caught: false, escapeProgress: 0, caughtAt: 0, lastStruggleAt: -Infinity,
    rescued: false, rescueAirborne: false, rescueLowestY: Infinity, rescueTensioned: false, grounded: false,
    slamArmedUntil: 0, lastDamageAt: -Infinity, impactSpeed: 0,
  };
}

export function resetActor(actor) {
  Object.assign(actor, { health: 100, source: 100, caught: false, escapeProgress: 0, caughtAt: 0,
    lastStruggleAt: -Infinity, rescued: false, rescueAirborne: false, rescueLowestY: Infinity, rescueTensioned: false,
    grounded: false, slamArmedUntil: 0, lastDamageAt: -Infinity, impactSpeed: 0 });
}

export function actorSnapshot(actor) {
  return { id: actor.id, name: actor.name, role: actor.role, health: actor.health, source: actor.source,
    position: actor.body.position.toArray(), quaternion: actor.body.quaternion.toArray(), velocity: actor.body.velocity.toArray(),
    caught: actor.caught, escapeProgress: actor.escapeProgress, rescued: actor.rescued, grounded: actor.grounded };
}
