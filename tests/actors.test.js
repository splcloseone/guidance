import test from 'node:test';
import assert from 'node:assert/strict';
import { SourceSimulation } from '../src/simulation.js';
import { PRACTICE_ACTORS } from '../src/actors.js';

const ground = { id: 'ground', position: [0, -0.5, 0], size: [200, 1, 200] };
const ledge = { id: 'rescue-platform', position: [11, 3.5, 0], size: [6, 1, 5] };
const wall = { id: 'wall', position: [-13, 1.5, 3], size: [1, 3, 7] };
const make = () => new SourceSimulation({ obstacles: [ground, ledge, wall], actors: PRACTICE_ACTORS });
const advance = (sim, seconds, input = {}) => {
  for (let i = 0; i < Math.round(seconds * 120); i++) sim.step(1 / 120, input);
};
const catchActor = (sim, id = 'practice-rival') => sim.attach(id, sim.actors.get(id).body.position.toArray());
const tap = sim => { sim.step(1 / 60, { struggle: true }); advance(sim, 0.12, { struggle: false }); };

test('moving practice characters are physical targets and tether reaction moves both bodies', () => {
  const sim = make();
  sim.startPractice('rival');
  advance(sim, 1);
  const actor = sim.actors.get('practice-rival');
  assert.notEqual(actor.body.position.x, -7, 'rival walks independently');
  assert.equal(catchActor(sim), true);
  const targetZ = actor.body.position.z;
  const playerZ = sim.player.position.z;
  advance(sim, 0.6, { reel: 1 });
  assert.ok(actor.body.position.z > targetZ + 0.7, 'captured rival must actually be pulled');
  assert.ok(sim.player.position.z < playerZ - 0.7, 'equal reaction must pull the caster too');
  assert.equal(sim.getSnapshot().actors.find(a => a.id === actor.id).caught, true);
  assert.ok(sim.anchorPosition().almostEquals(actor.body.pointToWorldFrame(sim.hook.localPoint)));
  const velocity = actor.body.velocity.clone();
  sim.release();
  assert.ok(actor.body.velocity.almostEquals(velocity), 'release preserves target momentum');
});

test('allied capture setting and an unshaped orb reject before spending the Source', () => {
  const sim = make();
  const reserve = sim.source;
  sim.allowFriendlyHooks = false;
  assert.equal(catchActor(sim, 'practice-ally'), false);
  assert.equal(sim.source, reserve);
  sim.allowFriendlyHooks = true;
  assert.equal(catchActor(sim, 'practice-ally'), true);
  assert.equal(sim.slam(), false, 'practice allies can be rescued, not deliberately slammed');
  sim.release();
  sim.setCreation({ form: 'orb' });
  const after = sim.source;
  assert.equal(catchActor(sim), false);
  assert.equal(sim.source, after);
});

test('lift and slam spend reserve but damage only comes from actual high speed contact', () => {
  const sim = make();
  sim.startPractice('rival');
  advance(sim, 0.5);
  const actor = sim.actors.get('practice-rival');
  catchActor(sim);
  const reserve = sim.source;
  assert.equal(sim.slam(), true);
  assert.equal(actor.health, 100, 'lift applies momentum, not immediate damage');
  assert.equal(sim.source, reserve - 6);
  assert.equal(sim.slam(), false, 'slam cooldown prevents repeated impulse spam');
  advance(sim, 0.5);
  assert.ok(actor.body.position.y > 3, 'lift must actually leave the floor');
  assert.equal(sim.slam([0, -1, 0]), true);
  assert.equal(actor.health, 100, 'throw itself does not deal damage');
  advance(sim, 1);
  assert.ok(actor.health < 100, 'high speed ground collision applies damage');
  const event = sim.events.find(e => e.type === 'actor-damaged');
  assert.equal(event.surfaceId, 'ground');
  assert.ok(event.speed > 7);
  assert.ok(event.damage > 0);
});

test('a thrown character can damage against a wall, not only the floor', () => {
  const sim = make();
  sim.startPractice('rival');
  advance(sim, 0.5);
  const actor = sim.actors.get('practice-rival');
  actor.body.position.set(-9, 2, 3);
  actor.body.velocity.setZero();
  catchActor(sim);
  actor.slamArmedUntil = sim.elapsed + 3;
  actor.body.velocity.set(-18, 0, 0);
  advance(sim, 0.3);
  const impact = sim.events.find(e => e.type === 'actor-damaged');
  assert.equal(impact?.surfaceId, 'wall');
  assert.ok(actor.health < 100);
});

test('a rival gradually struggles free, and a reinforced tether takes longer to break', () => {
  const durations = [];
  for (const strength of [1, 5]) {
    const sim = make();
    sim.setCreation({ strength });
    sim.startPractice('rival');
    advance(sim, 0.5);
    catchActor(sim);
    let time = 0;
    while (sim.hook && time < 15) { advance(sim, 0.1); time += 0.1; }
    assert.equal(sim.hook, null);
    assert.ok(time > 6, `escape must require effort, got ${time}s`);
    assert.ok(sim.events.some(e => e.type === 'actor-escaped'));
    durations.push(time);
  }
  assert.ok(durations[1] > durations[0] + 2);
});

test('shape thickness changes actual tether force, costs, and escape effort beyond the strength slider cap', () => {
  const results = [];
  for (const thickness of [.025, .055, .16]) {
    const sim = make();
    sim.setCreation({ strength: 5, shape: { thickness } });
    sim.startPractice('rival');
    advance(sim, .5);
    const activation = sim.activationCost;
    const upkeep = sim.upkeepCost;
    assert.equal(catchActor(sim), true);
    const reinforcement = sim.hook.strength;
    const requiredPresses = sim.getSnapshot().hook.requiredPresses;
    sim.hook.length = 2;
    sim.step(1 / 120);
    results.push({ activation, upkeep, requiredPresses, tension: sim.hook.tension,
      speed: sim.actors.get('practice-rival').body.velocity.length() });
    sim.setCreation({ strength: 1, shape: { thickness: .025 } });
    assert.equal(sim.hook.strength, reinforcement, 'editing a design cannot silently replace its live tether');
    assert.equal(sim.hook.requiredPresses, requiredPresses);
  }
  assert.equal(results[1].activation, 15.8, 'standard thickness retains the original activation cost');
  assert.equal(results[1].upkeep, 1.6, 'standard thickness retains the original upkeep');
  assert.equal(results[1].requiredPresses, 25);
  assert.ok(results[2].requiredPresses > 25, 'thicker shapes still reinforce maximum-strength designs');
  for (const field of ['activation', 'upkeep', 'requiredPresses', 'tension', 'speed']) {
    assert.ok(results[0][field] < results[1][field] && results[1][field] < results[2][field], `${field} must increase with actual thickness`);
  }
  const sim = make();
  sim.setCreation({ strength: 5, shape: { thickness: .16 } });
  sim.startPractice('breakout');
  assert.equal(sim.incomingTether.requiredPresses, results[2].requiredPresses, 'incoming and outgoing tethers share reinforcement rules');
});

test('the simulation accepts every saved form and preserves partial shape updates safely', () => {
  const sim = make();
  sim.setCreation({ form: 'orb' });
  sim.setCreation({ form: 'claw' });
  assert.equal(sim.creation.form, 'claw');
  assert.equal(catchActor(sim), true, 'a claw selected after an orb can be cast');
  const points = sim.creation.shape.points.map(point => [...point]);
  const settings = sim.setCreation({ shape: { thickness: .12 } });
  assert.deepEqual(settings.shape.points, points);
  settings.shape.points[0][0] = 1.5;
  assert.deepEqual(sim.creation.shape.points, points, 'returned design data is not a mutable simulation reference');
});

test('breakout requires deliberate repeated presses; holding and impossible tap rates cannot escape', () => {
  const sim = make();
  sim.startPractice('breakout');
  advance(sim, 1, { struggle: true, moveX: 1 });
  assert.equal(sim.incomingTether.acceptedPresses, 1);
  assert.ok(sim.player.position.x > -7 + 0.3, 'a caught player can still move');
  for (let i = 0; i < 20; i++) {
    sim.step(1 / 120, { struggle: false });
    sim.step(1 / 120, { struggle: true });
  }
  assert.ok(sim.incomingTether.acceptedPresses <= 5, 'rate limit rejects excessively fast toggles');
  assert.ok(sim.incomingTether);
  let presses = 0;
  while (sim.incomingTether && presses < 40) { tap(sim); presses++; }
  assert.equal(sim.incomingTether, null);
  assert.ok(presses > 15, 'escape must require sustained effort');
  assert.equal(sim.practice.status, 'escaped');
});

test('incoming tethers decay, drain their caster and dismiss on exhaustion, meditation and reset', () => {
  const sim = make();
  sim.startPractice('breakout');
  tap(sim); tap(sim); tap(sim);
  const progress = sim.incomingTether.escapeProgress;
  const caster = sim.actors.get('practice-rival');
  const source = caster.source;
  advance(sim, 1);
  assert.ok(sim.incomingTether.escapeProgress < progress);
  assert.ok(caster.source < source);
  caster.source = 0.001;
  advance(sim, 0.1);
  assert.equal(sim.incomingTether, null);
  sim.startPractice('breakout');
  advance(sim, 0.1, { meditating: true });
  assert.equal(sim.incomingTether, null);
  sim.startPractice('breakout');
  sim.source = 40;
  sim.resetPractice();
  assert.equal(sim.incomingTether, null);
  assert.equal(sim.source, 40, 'resetting characters cannot refill the player reserve');
});

test('pulling an at-risk ally back from the ledge completes a preventive rescue', () => {
  const sim = make();
  sim.startPractice('rescue');
  advance(sim, 0.4);
  const ally = sim.actors.get('practice-ally');
  catchActor(sim, ally.id);
  assert.equal(ally.rescued, false);
  advance(sim, 2.6);
  assert.equal(ally.rescued, false, 'ally standing on a platform is not yet a rescue');
  advance(sim, 1, { reel: 1 });
  assert.equal(ally.rescued, true, 'catching and safely pulling an ally away from the edge completes rescue');
  assert.ok(ally.body.position.x > 9.35, 'the ally must physically reach the inset safe area');
  assert.equal(ally.grounded, true);
  assert.ok(sim.events.some(e => e.type === 'actor-rescued'));
  assert.equal(ally.escapeProgress, 0, 'friendly actors do not struggle');
});

test('a near-face hook hit can reel the whole ally onto safe footing', () => {
  const sim = make();
  sim.startPractice('rescue');
  advance(sim, .4);
  const ally = sim.actors.get('practice-ally');
  // Actual camera raycasts hit the body surface, not the center-of-mass shortcut.
  const surfacePoint = ally.body.position.toArray().map((value, axis) => value + [.4, .232, -.217][axis]);
  assert.equal(sim.attach(ally.id, surfacePoint), true);
  assert.equal(ally.rescued, false);
  advance(sim, 1, { reel: 1 });
  assert.equal(sim.hook.length, 1, 'character tethers can reel close enough for the whole body to follow');
  assert.equal(sim.getSnapshot().hook.minLength, 1);
  assert.equal(ally.rescued, true);
  assert.ok(ally.body.position.x > 9.35, 'the unchanged safe-zone criterion requires real body movement');
  assert.equal(ally.grounded, true);
  assert.ok(ally.body.position.distanceTo(sim.player.position) > 1, 'solid characters cannot overlap');
});

test('catching and reeling a falling ally physically arrests their fall above the ground', () => {
  const sim = make();
  sim.startPractice('rescue');
  advance(sim, 3.6);
  const ally = sim.actors.get('practice-ally');
  assert.equal(ally.grounded, false);
  assert.ok(ally.body.velocity.y < -5, 'the ally must already be falling before the catch');
  assert.equal(catchActor(sim, ally.id), true);
  assert.equal(ally.rescued, false, 'attachment alone does not complete the rescue');
  // Inspect the actual rescue moment. Continuing to reel afterward can pull the
  // rescuer off the edge too: the tether continues to act on both physical bodies.
  for (let frame = 0; frame < 120 && !ally.rescued; frame++) sim.step(1 / 120, { reel: 1 });
  assert.equal(ally.rescued, true);
  assert.ok(ally.body.position.y > 1.7, 'the tether must support the ally above the ground');
  assert.ok(ally.body.velocity.y > -.8, 'the actual falling motion must be arrested');
  assert.equal(sim.events.filter(event => event.type === 'actor-rescued').length, 1);

  const withoutCatch = make();
  withoutCatch.startPractice('rescue');
  advance(withoutCatch, 4.2);
  assert.equal(withoutCatch.actors.get(ally.id).rescued, false);
  assert.ok(withoutCatch.actors.get(ally.id).body.position.y < 1, 'an uncaught ally falls to the ground');
});

test('practice snapshot is serializable, invalid modes are inert, and defeat dismisses the tether', () => {
  const sim = make();
  assert.equal(sim.startPractice('invalid'), false);
  sim.startPractice('rival');
  catchActor(sim);
  assert.doesNotThrow(() => JSON.stringify(sim.getSnapshot()));
  const actor = sim.actors.get('practice-rival');
  actor.health = 1;
  actor.slamArmedUntil = sim.elapsed + 3;
  actor.body.position.set(-9, 2, 3);
  actor.body.velocity.set(-18, 0, 0);
  advance(sim, 0.3);
  assert.equal(actor.health, 0);
  assert.equal(sim.hook, null);
  assert.equal(sim.practice.status, 'defeated');
});
