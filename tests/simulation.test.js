import test from 'node:test';
import assert from 'node:assert/strict';
import { SourceSimulation } from '../src/simulation.js';

const ground = { id: 'ground', name: 'Training floor', position: [0, -0.5, 0], size: [200, 1, 200] };
const overhead = { id: 'beam', name: 'Swing beam', position: [0, 12, 0], size: [12, 1, 1] };
const makeSimulation = (extras = {}) => new SourceSimulation({ obstacles: [ground, overhead], ...extras });
const advance = (simulation, seconds, input = {}) => {
  for (let i = 0; i < Math.round(seconds * 120); i++) simulation.step(1 / 120, input);
};
const approximately = (actual, expected, tolerance = 0.01) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be within ${tolerance} of ${expected}`);

test('ground collision, directional movement, jumping, and stamina work together', () => {
  const simulation = makeSimulation();
  advance(simulation, 1);
  assert.equal(simulation.grounded, true);
  approximately(simulation.player.position.y, 0.6, 0.02);
  const startZ = simulation.player.position.z;
  advance(simulation, 1, { moveZ: -1 });
  assert.ok(simulation.player.position.z < startZ - 4);
  assert.ok(simulation.player.velocity.z < -5.5);
  simulation.step(1 / 60, { jump: true, moveZ: -1 });
  assert.ok(simulation.player.velocity.y > 7);
  assert.ok(simulation.stamina < 100);
  assert.equal(simulation.grounded, false);
  advance(simulation, 1.5);
  assert.equal(simulation.grounded, true);
});

test('a hanging rope supports the player and preserves lateral swing momentum on release', () => {
  const simulation = makeSimulation();
  simulation.player.position.set(0, 5, 0);
  simulation.player.velocity.set(7, 0, 0);
  assert.equal(simulation.attach('beam', [0, 11.5, 0]), true);
  const length = simulation.hook.length;
  advance(simulation, 0.5);
  const distance = simulation.player.position.distanceTo(simulation.anchorPosition());
  assert.ok(distance <= length + 0.15, `rope stretched to ${distance}, expected ${length}`);
  assert.ok(simulation.player.position.x > 2, 'player should swing sideways');
  assert.ok(simulation.player.position.y > 4.8, 'rope should prevent a free fall');
  const velocity = simulation.player.velocity.clone();
  simulation.release();
  assert.equal(simulation.hook, null);
  assert.ok(simulation.player.velocity.almostEquals(velocity), 'release must preserve all velocity');
  advance(simulation, 0.1);
  assert.ok(simulation.player.velocity.x > 3, 'forward momentum continues after release');
});

test('a slack rope does not push or instantly pull its player', () => {
  const simulation = makeSimulation();
  simulation.player.position.set(0, 5, 0);
  simulation.attach('beam', [0, 11.5, 0]);
  simulation.hook.length = 20;
  advance(simulation, 0.1);
  approximately(simulation.player.velocity.x, 0);
  assert.ok(simulation.player.velocity.y < -1.8, 'gravity applies while the rope is slack');
  assert.equal(simulation.hook.tension, 0);
});

test('reeling pulls a movable crate and anchor follows its motion', () => {
  const simulation = makeSimulation({ dynamicObjects: [{ id: 'crate', name: 'Crate', position: [0, 0.7, 7], size: [1.4, 1.4, 1.4], mass: 12 }] });
  advance(simulation, 1);
  const crate = simulation.bodies.get('crate');
  const startZ = crate.position.z;
  const startPlayerZ = simulation.player.position.z;
  assert.equal(simulation.attach('crate', [0, 0.7, 7.7]), true);
  const initialLength = simulation.hook.length;
  advance(simulation, 0.6, { reel: 1 });
  assert.ok(simulation.hook.length < initialLength - 3);
  assert.ok(crate.position.z > startZ + 1, 'crate must move toward the player');
  assert.ok(simulation.player.position.z <= startPlayerZ, 'reaction pulls the player toward the crate too');
  const expectedAnchor = crate.pointToWorldFrame(simulation.hook.localPoint);
  assert.ok(simulation.anchorPosition().almostEquals(expectedAnchor));
});

test('reel length is clamped and paying out never exceeds saved reach', () => {
  const simulation = makeSimulation();
  simulation.player.position.set(0, 5, 0);
  simulation.attach('beam', [0, 11.5, 0]);
  advance(simulation, 2, { reel: 1 });
  approximately(simulation.hook.length, 2);
  advance(simulation, 5, { reel: -1 });
  approximately(simulation.hook.length, simulation.creation.reach);
});

test('activation and upkeep spend the Source; exhaustion dismisses; only meditation restores it', () => {
  const simulation = makeSimulation();
  advance(simulation, 1);
  const before = simulation.source;
  assert.equal(simulation.attach('beam', [0, 11.5, 0]), true);
  approximately(simulation.source, before - simulation.activationCost);
  const afterActivation = simulation.source;
  advance(simulation, 1);
  approximately(simulation.source, afterActivation - simulation.upkeepCost, 0.02);
  simulation.source = 0.02;
  advance(simulation, 0.1);
  assert.equal(simulation.source, 0);
  assert.equal(simulation.hook, null);
  assert.equal(simulation.getSnapshot().weakened, true);
  advance(simulation, 1);
  assert.equal(simulation.source, 0, 'standing in the field must not regenerate the reserve');
  advance(simulation, 1, { meditating: true });
  approximately(simulation.source, 16, 0.02);
  assert.equal(simulation.getSnapshot().weakened, false);
});

test('range, available reserve, and real attachment points are validated before spending', () => {
  const simulation = makeSimulation();
  const before = simulation.source;
  assert.equal(simulation.attach('beam', [300, 12, 0]), false);
  assert.equal(simulation.attach('beam', [5, 7, 0]), false);
  assert.equal(simulation.attach('missing', [0, 0, 0]), false);
  assert.equal(simulation.source, before);
  simulation.source = 1;
  assert.equal(simulation.attach('beam', [0, 11.5, 0]), false);
  assert.equal(simulation.source, 1);
});

test('meditation dismisses creations and does not permit movement or jumping', () => {
  const simulation = makeSimulation();
  advance(simulation, 1);
  simulation.attach('beam', [0, 11.5, 0]);
  const start = simulation.player.position.clone();
  advance(simulation, 1, { meditating: true, moveX: 1, jump: true });
  assert.equal(simulation.hook, null);
  approximately(simulation.player.position.x, start.x);
  approximately(simulation.player.position.y, start.y, 0.02);
  assert.equal(simulation.attach('beam', [0, 11.5, 0]), false);
});

test('reset restores physical props and vitals without losing the saved creation', () => {
  const simulation = makeSimulation({ dynamicObjects: [{ id: 'crate', position: [0, 1, 5], size: [1, 1, 1], mass: 12 }] });
  simulation.setCreation({ name: 'My Hook', reach: 32, strength: 4, color: '#efcb90' });
  const crate = simulation.bodies.get('crate');
  crate.position.set(25, 10, 1);
  crate.velocity.set(1, 2, 3);
  simulation.health = 20;
  simulation.source = 30;
  simulation.player.position.set(0, -20, 0);
  simulation.step(1 / 60);
  assert.deepEqual(simulation.player.position.toArray(), [0, 1.2, 15]);
  assert.deepEqual(crate.position.toArray(), [0, 1, 5]);
  assert.deepEqual(crate.velocity.toArray(), [0, 0, 0]);
  assert.equal(simulation.health, 100);
  assert.equal(simulation.source, 100);
  assert.equal(simulation.creation.name, 'My Hook');
  assert.ok(simulation.events.some(event => event.type === 'reset'));
});

test('a hard landing applies fall damage and invalid dt does not corrupt simulation', () => {
  const simulation = makeSimulation();
  simulation.player.position.set(0, 10, 15);
  advance(simulation, 1.1);
  assert.ok(simulation.health < 100 && simulation.health > 0);
  const snapshot = simulation.getSnapshot();
  simulation.step(NaN);
  simulation.step(-1);
  assert.deepEqual(simulation.getSnapshot(), snapshot);
  assert.doesNotThrow(() => JSON.stringify(snapshot));
});
