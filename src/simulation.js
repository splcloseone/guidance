import { Combat } from './combat.js';
import * as CANNON from 'cannon-es';
import { createActor, resetActor, actorSnapshot, escapeThreshold, STRUGGLE_RULES } from './actors.js';
import { normalizeCreation } from './creation.js';

const FIXED_STEP = 1 / 120;
const PLAYER_RADIUS = 0.6;
const SPAWN = [0, 1.2, 15];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

/** A deterministic local physics lab. Rendering and input mapping live outside it. */
export class SourceSimulation {
  constructor({ obstacles = [], dynamicObjects = [], actors = [] } = {}) {
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -20, 0) });
    this.world.allowSleep = false;
    this.world.solver.iterations = 16;
    this.world.defaultContactMaterial.friction = 0.35;
    this.world.defaultContactMaterial.restitution = 0;
    this.world.defaultContactMaterial.contactEquationStiffness = 1e8;
    this.world.defaultContactMaterial.contactEquationRelaxation = 3;
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);

    this.allowFriendlyHooks = true;
    this.actors = new Map();
    this.practice = { mode: null, status: 'idle', startedAt: 0 };
    this.incomingTether = null;
    this._struggleWasDown = false;
    this._lastSlamAt = -Infinity;
    this.bodies = new Map();
    this.descriptors = new Map();
    this.initialStates = new Map();
    this.events = [];
    this.creation = normalizeCreation();
    this.source = 100;
    this.health = 100;
    this.stamina = 100;
    this.hook = null;
    this.grounded = false;
    this.meditating = false;
    this.elapsed = 0;
    this._accumulator = 0;
    this._jumpWasDown = false;
    this._jumpQueued = false;
    this._jumpGrace = 0;
    this._impactSpeed = 0;
    this._exhausted = false;
    this.combat = new Combat(this);

    const floorMaterial = new CANNON.Material('world');
    const playerMaterial = new CANNON.Material('player');
    this.world.addContactMaterial(new CANNON.ContactMaterial(playerMaterial, floorMaterial, {
      friction: 0,
      restitution: 0,
      contactEquationStiffness: 1e8,
    }));
    for (const [descriptors, dynamic] of [[obstacles, false], [dynamicObjects, true], [actors, true]]) {
      for (const descriptor of descriptors) {
        const { id, size = [1, 1, 1], position = [0, 0, 0] } = descriptor;
        if (!id || this.bodies.has(id)) throw new Error('Every physics object needs a unique id.');
        if (!size.every(v => Number.isFinite(v) && v > 0) || !position.every(Number.isFinite)) {
          throw new Error(`Invalid physics dimensions for ${id}.`);
        }
        const body = new CANNON.Body({
          mass: dynamic ? Math.max(1, finite(descriptor.mass, 12)) : 0,
          position: new CANNON.Vec3(...position),
          material: floorMaterial,
          shape: new CANNON.Box(new CANNON.Vec3(size[0] / 2, size[1] / 2, size[2] / 2)),
          linearDamping: dynamic ? 0.18 : 0,
          angularDamping: dynamic ? 0.65 : 0,
        });
        body.userData = { id, name: descriptor.name || id };
        this.world.addBody(body);
        this.bodies.set(id, body);
        if (descriptors === actors) {
          body.material = playerMaterial;
          body.fixedRotation = true;
          body.updateMassProperties();
          const actor = createActor(descriptor, body);
          this.actors.set(id, actor);
          body.addEventListener('collide', ({ contact }) => this._actorCollision(actor, contact));
        }
        this.descriptors.set(id, descriptor);
        this.initialStates.set(id, { position: body.position.clone(), quaternion: body.quaternion.clone() });
      }
    }
    this.player = new CANNON.Body({
      mass: 70,
      position: new CANNON.Vec3(...SPAWN),
      shape: new CANNON.Sphere(PLAYER_RADIUS),
      fixedRotation: true,
      linearDamping: 0.015,
      material: playerMaterial,
    });
    this.player.updateMassProperties();
    this.player.userData = { id: 'player', name: 'You' };
    this.world.addBody(this.player);
  }

  _event(type, extra = {}) {
    this.events.push({ type, ...extra });
    // A consumer can drain this array; leaving it unread never grows memory forever.
    if (this.events.length > 80) this.events.splice(0, this.events.length - 80);
  }

  setCreation(settings = {}) {
    this.combat.dismiss();
    this.creation = normalizeCreation({ ...this.creation, ...settings,
      shape: { ...this.creation.shape, ...settings?.shape } });
    return normalizeCreation(this.creation);
  }

  get reinforcement() {
    // The standard .055 thickness preserves the original force and reserve costs.
    // A square-root curve rewards thicker shaping without making thin forms unusable.
    return this.creation.strength * Math.sqrt(this.creation.shape.thickness / 0.055);
  }

  get activationCost() {
    return 8 + this.creation.reach * 0.1 + this.reinforcement;
  }

  get upkeepCost() {
    return 0.5 + this.reinforcement * 0.22;
  }

  attach(bodyId, worldPointArray) {
    const body = this.bodies.get(bodyId);
    if (!body || !Array.isArray(worldPointArray) || worldPointArray.length !== 3 || !worldPointArray.every(Number.isFinite)) return false;
    if (['orb','clay'].includes(this.creation.form)) {
      this._event('hook-failed', { reason: 'Shape the ball into a hook or lasso before casting.' });
      return false;
    }
    if (this.actors.get(bodyId)?.health <= 0) return false;
    if (this.actors.get(bodyId)?.role === 'ally' && !this.allowFriendlyHooks) {
      this._event('hook-failed', { reason: 'Friendly hooks are disabled in practice settings.' });
      return false;
    }
    if (this.meditating) {
      this._event('hook-failed', { reason: 'Leave meditation to manifest your hook.' });
      return false;
    }
    const anchor = new CANNON.Vec3(...worldPointArray);
    const distance = anchor.distanceTo(this.player.position);
    if (distance > this.creation.reach + 0.05) {
      this._event('hook-failed', { reason: 'Beyond your hook’s reach.' });
      return false;
    }
    if (this.source + 1e-8 < this.activationCost) {
      this._event('hook-failed', { reason: 'Not enough of the Source. Rest in meditation.' });
      return false;
    }
    // A render raycast supplies the hit point; still reject points detached from a body.
    const localPoint = body.pointToLocalFrame(anchor);
    const half = body.shapes[0].halfExtents;
    if (Math.abs(localPoint.x) > half.x + 0.15 || Math.abs(localPoint.y) > half.y + 0.15 || Math.abs(localPoint.z) > half.z + 0.15) return false;
    if (this.hook) this.release('replaced');
    this.source = Math.max(0, this.source - this.activationCost);
    // A character hit is often on the near face, away from their center of mass.
    // Allow a closer pull so that their whole body can reach the rescuer's footing.
    // World anchors retain the longer clearance used for swinging and climbing.
    const minLength = this.actors.has(bodyId) ? 1 : 2;
    this.hook = {
      bodyId,
      localPoint,
      anchor,
      length: Math.max(minLength, distance),
      minLength,
      maxLength: this.creation.reach,
      tension: 0,
      distance,
      strength: this.reinforcement,
      requiredPresses: escapeThreshold(this.reinforcement),
      reelSpeed: this.creation.reelSpeed,
      upkeep: this.upkeepCost,
      stage: 'held',
    };
    const actor = this.actors.get(bodyId);
    if (actor) {
      actor.caught = true;
      actor.caughtAt = this.elapsed;
      actor.escapeProgress = 0;
      actor.lastStruggleAt = this.elapsed;
    }
    body.wakeUp();
    this._event('attached', { bodyId, name: body.userData.name });
    return true;
  }

  anchorPosition() {
    if (!this.hook) return null;
    const body = this.bodies.get(this.hook.bodyId);
    body.pointToWorldFrame(this.hook.localPoint, this.hook.anchor);
    return this.hook.anchor;
  }

  release(reason = 'released') {
    if (!this.hook) return false;
    const bodyId = this.hook.bodyId;
    const actor = this.actors.get(bodyId);
    if (actor) { actor.caught = false; actor.escapeProgress = 0; }
    this.hook = null;
    // Never modify velocity here: letting go preserves the player's swing momentum.
    this._event('released', { reason, bodyId });
    return true;
  }

  _readGrounded(body = this.player) {
    for (const contact of this.world.contacts) {
      if (!contact.enabled) continue;
      if (contact.bi === body && contact.ni.y < -0.55) return true;
      if (contact.bj === body && contact.ni.y > 0.55) return true;
    }
    return false;
  }

  _move(dt, input) {
    const player = this.player;
    let x = this.meditating ? 0 : finite(input.moveX);
    let z = this.meditating ? 0 : finite(input.moveZ);
    const magnitude = Math.hypot(x, z);
    if (magnitude > 1) { x /= magnitude; z /= magnitude; }
    const moving = Math.hypot(x, z) > 0.02;
    const sprinting = !!input.sprint && moving && this.stamina > 0 && !this.meditating;
    const weakened = this.source <= 0.01;
    const speed = (sprinting ? 10 : 6) * (weakened ? 0.65 : 1);
    const underTension = (this.hook?.tension || 0) > 100 || (this.incomingTether?.tension || 0) > 100;
    const acceleration = (this.grounded ? 42 : 8) * (underTension ? 0.45 : 1);
    if (this.grounded || moving) {
      // Air input adds control but never erases momentum above running speed.
      if (this.grounded) {
        const maxChange = acceleration * dt;
        player.velocity.x += clamp(x * speed - player.velocity.x, -maxChange, maxChange);
        player.velocity.z += clamp(z * speed - player.velocity.z, -maxChange, maxChange);
      } else {
        const along = player.velocity.x * x + player.velocity.z * z;
        if (along < speed) {
          player.velocity.x += x * acceleration * dt;
          player.velocity.z += z * acceleration * dt;
        }
      }
    }
    if (sprinting && this.grounded) this.stamina = Math.max(0, this.stamina - dt * 8);
    else this.stamina = Math.min(100, this.stamina + dt * 12);
    this._jumpGrace = this.grounded ? 0.08 : Math.max(0, this._jumpGrace - dt);
    if (this._jumpQueued && this._jumpGrace > 0 && this.stamina >= 8 && !this.meditating) {
      player.velocity.y = weakened ? 6 : 8.3;
      this.stamina -= 8;
      this._jumpQueued = false;
      this._jumpGrace = 0;
      this.grounded = false;
      this._event('jumped');
    }
  }

  _rope(dt) {
    if (!this.hook) return;
    this._solveTether(dt, this.hook, this.player, this.bodies.get(this.hook.bodyId), this.anchorPosition());
  }

  /** Unilateral constraint shared by outgoing and incoming tethers; never pushes on slack. */
  _solveTether(dt, tether, caster, target, anchor) {
    const direction = anchor.vsub(caster.position);
    const distance = direction.length();
    tether.distance = distance;
    tether.tension = 0;
    if (distance < 1e-5) return;
    direction.scale(1 / distance, direction);
    const extension = distance - tether.length;
    if (extension < -0.015) return;
    const anchorVelocity = new CANNON.Vec3();
    target.getVelocityAtWorldPoint(anchor, anchorVelocity);
    const closingSpeed = caster.velocity.vsub(anchorVelocity).dot(direction);
    const desiredClosingSpeed = clamp(Math.max(0, extension) * 0.22 / dt, 0, 30);
    const inverseMass = caster.invMass + target.invMass;
    const maxForce = 2300 + tether.strength * 1350;
    const impulseMagnitude = clamp((desiredClosingSpeed - closingSpeed) / inverseMass, 0, maxForce * dt);
    if (impulseMagnitude <= 0) return;
    const impulse = direction.scale(impulseMagnitude);
    caster.applyImpulse(impulse);
    if (target.mass > 0) target.applyImpulse(impulse.negate());
    tether.tension = impulseMagnitude / dt;
    if (extension > 0.035) {
      const correction = Math.min(extension - 0.015, maxForce * dt * dt * inverseMass);
      caster.position.vadd(direction.scale(correction * caster.invMass / inverseMass), caster.position);
      if (target.mass > 0) target.position.vsub(direction.scale(correction * target.invMass / inverseMass), target.position);
      caster.aabbNeedsUpdate = true;
      target.aabbNeedsUpdate = true;
    }
  }

  _restoreBody(id) {
    const body = this.bodies.get(id);
    const initial = this.initialStates.get(id);
    if (!body || !initial) return;
    body.position.copy(initial.position);
    body.quaternion.copy(initial.quaternion);
    body.velocity.setZero();
    body.angularVelocity.setZero();
    body.force.setZero();
    body.torque.setZero();
    body.previousPosition.copy(body.position);
    body.interpolatedPosition.copy(body.position);
    body.aabbNeedsUpdate = true;
    body.wakeUp();
  }

  resetPractice() {
    if (this.hook && this.actors.has(this.hook.bodyId)) this.release('practice-reset');
    this._releaseIncoming('practice-reset');
    for (const actor of this.actors.values()) {
      this._restoreBody(actor.id);
      resetActor(actor);
    }
    this.practice = { mode: null, status: 'idle', startedAt: this.elapsed };
    this._lastSlamAt = -Infinity;
    this.combat.reset();
    this.world.broadphase.dirty = true;
    this._event('practice-reset');
  }

  startPractice(mode) {
    if (!['rival', 'rescue', 'breakout', 'melee'].includes(mode)) return false;
    const actorId = mode === 'rescue' ? 'practice-ally' : 'practice-rival';
    const actor = this.actors.get(actorId);
    if (!actor) return false;
    this.resetPractice();
    this.release('practice-start');
    this.meditating = false;
    this.practice = { mode, status: 'active', startedAt: this.elapsed };
    this.player.position.set(...(mode === 'rescue' ? [11, 4.7, 0] : mode === 'melee' ? [-7, 1.2, 7.1] : [-7, 1.2, 13]));
    this.player.velocity.setZero();
    this.player.force.setZero();
    this.player.previousPosition.copy(this.player.position);
    this.player.interpolatedPosition.copy(this.player.position);
    this.player.aabbNeedsUpdate = true;
    this.grounded = false;
    this._impactSpeed = 0;
    if (mode === 'rescue') {
      actor.body.position.set(8.6, 4.91, 1.3);
      actor.body.previousPosition.copy(actor.body.position);
      actor.body.interpolatedPosition.copy(actor.body.position);
      actor.body.aabbNeedsUpdate = true;
    }
    if (mode === 'melee') { this.combat.equip('sword'); this.combat.counterAt = this.elapsed + 3; }
    if (mode === 'breakout') {
      this.incomingTether = {
        actorId: actor.id, length: 6, tension: 0, strength: this.reinforcement,
        escapeProgress: 0, acceptedPresses: 0, lastPressAt: -Infinity,
        requiredPresses: escapeThreshold(this.reinforcement), upkeep: this.upkeepCost,
      };
    }
    this._struggleWasDown = false;
    this.world.broadphase.dirty = true;
    this._event('practice-started', { mode });
    return true;
  }

  _releaseIncoming(reason) {
    if (!this.incomingTether) return false;
    const actorId = this.incomingTether.actorId;
    this.incomingTether = null;
    if (reason === 'escaped') this.practice.status = 'escaped';
    this._event(reason === 'escaped' ? 'escaped' : 'incoming-released', { reason, actorId });
    return true;
  }

  _struggle() {
    const tether = this.incomingTether;
    if (!tether || this.meditating || this.elapsed - tether.lastPressAt < STRUGGLE_RULES.minimumInterval) return;
    tether.lastPressAt = this.elapsed;
    tether.acceptedPresses++;
    tether.escapeProgress++;
    this._event('struggled', { progress: tether.escapeProgress / tether.requiredPresses });
    if (tether.escapeProgress >= tether.requiredPresses) this._releaseIncoming('escaped');
  }

  /** First activation lifts; the next sends the captive toward the aimed surface. */
  slam(directionArray = [0, -1, 0]) {
    const actor = this.hook && this.actors.get(this.hook.bodyId);
    if (!actor || actor.role !== 'rival' || actor.health <= 0 || this.meditating) return false;
    if (this.elapsed - this._lastSlamAt < 0.45) return false;
    const lifting = this.hook.stage !== 'lifted';
    const cost = lifting ? 6 : 8;
    if (this.source < cost) { this._event('slam-failed', { reason: 'Not enough of the Source.' }); return false; }
    this.source -= cost;
    this._lastSlamAt = this.elapsed;
    if (lifting) {
      const speed = 9 + this.hook.strength * 0.7;
      actor.body.applyImpulse(new CANNON.Vec3(0, actor.body.mass * Math.max(0, speed - actor.body.velocity.y), 0));
      // Extra slack allows the lifted body to rise; the tether still catches its motion.
      this.hook.length = Math.min(this.hook.maxLength, this.hook.length + 3);
      this.hook.stage = 'lifted';
      this._event('lifted', { actorId: actor.id });
    } else {
      const supplied = Array.isArray(directionArray) && directionArray.length === 3 && directionArray.every(Number.isFinite);
      const direction = supplied ? new CANNON.Vec3(...directionArray) : new CANNON.Vec3(0, -1, 0);
      if (direction.lengthSquared() < 0.01) direction.set(0, -1, 0);
      // Looking horizontally throws forward and down; looking at a wall retains lateral force.
      direction.y = Math.min(-0.45, direction.y);
      direction.normalize();
      actor.body.applyImpulse(direction.scale(actor.body.mass * (12 + this.hook.strength * 1.3)));
      actor.slamArmedUntil = this.elapsed + 3;
      this.hook.stage = 'slammed';
      this._event('slammed', { actorId: actor.id });
    }
    actor.body.wakeUp();
    return true;
  }

  _actorCollision(actor, contact) {
    if (actor.health <= 0 || this.elapsed > actor.slamArmedUntil || this.elapsed - actor.lastDamageAt < 0.3) return;
    const other = contact.bi === actor.body ? contact.bj : contact.bi;
    if (other === this.player || this.actors.has(other.userData?.id)) return;
    const speed = Math.abs(contact.getImpactVelocityAlongNormal());
    if (speed <= 7) return;
    const damage = Math.min(65, (speed - 7) * 3.5);
    actor.health = Math.max(0, actor.health - damage);
    actor.lastDamageAt = this.elapsed;
    actor.slamArmedUntil = 0;
    this._event('actor-damaged', { actorId: actor.id, damage, health: actor.health, speed, surfaceId: other.userData?.id });
    if (actor.health <= 0) {
      if (this.hook?.bodyId === actor.id) this.release('defeated');
      if (this.incomingTether?.actorId === actor.id) this._releaseIncoming('defeated');
      this.practice.status = 'defeated';
    }
  }

  _stepActors(dt) {
    for (const actor of this.actors.values()) {
      const body = actor.body;
      actor.grounded = this._readGrounded(body);
      if (actor.health <= 0 || this.meditating) continue;
      const captured = this.hook?.bodyId === actor.id;
      if (captured && actor.role === 'rival') {
        actor.escapeProgress = Math.max(0, actor.escapeProgress - STRUGGLE_RULES.decayPerSecond * dt);
        if (this.elapsed - actor.caughtAt > STRUGGLE_RULES.rivalDelay && this.elapsed - actor.lastStruggleAt > STRUGGLE_RULES.rivalInterval) {
          actor.lastStruggleAt = this.elapsed;
          actor.escapeProgress++;
          if (actor.escapeProgress >= this.hook.requiredPresses) {
            this.release('struggled-free');
            this._event('actor-escaped', { actorId: actor.id });
          }
        }
      }
      let targetX = 0;
      if (actor.role === 'rival' && !['breakout', 'melee'].includes(this.practice.mode)) targetX = Math.cos((this.elapsed - this.practice.startedAt) * 0.65) * 1.3;
      if (actor.role === 'ally' && this.practice.mode === 'rescue' && !actor.rescued && this.elapsed - this.practice.startedAt > 2.5) targetX = -1.3;
      if (actor.grounded) {
        const maxChange = (captured ? 3 : 10) * dt;
        body.velocity.x += clamp(targetX - body.velocity.x, -maxChange, maxChange);
        body.velocity.z += clamp(-body.velocity.z, -maxChange, maxChange);
      }
      if (this.practice.mode === 'rescue' && actor.role === 'ally' && !actor.rescued) {
        if (captured && this.hook.tension > 80) actor.rescueTensioned = true;
        // Pulling someone back from the ledge is also a rescue: do not require the
        // player to let their ally fall first. The safe area is inset from its edges.
        const pulledToSafety = captured && actor.rescueTensioned && actor.grounded &&
          body.position.y > 4.5 && body.position.x > 9.35 && body.position.x < 12.65 && Math.abs(body.position.z) < 1.65;
        if (!actor.grounded && captured && body.position.y > 1.5 && body.position.y < 4.5) actor.rescueAirborne = true;
        if (!actor.grounded) actor.impactSpeed = Math.min(actor.impactSpeed, body.velocity.y);
        if (actor.rescueAirborne) {
          actor.rescueLowestY = Math.min(actor.rescueLowestY, body.position.y);
          const arrested = captured && this.hook.tension > 80 && body.position.y > 1.7 && body.velocity.y > -0.8;
          const landedSafe = actor.grounded && actor.impactSpeed > -10 && captured;
          if (arrested || landedSafe) {
            actor.rescued = true;
            this.practice.status = 'rescued';
            this._event('actor-rescued', { actorId: actor.id });
          }
        }
        if (pulledToSafety && !actor.rescued) {
          actor.rescued = true;
          this.practice.status = 'rescued';
          this._event('actor-rescued', { actorId: actor.id });
        }
      }
      if (body.position.y < -15) {
        if (captured) this.release('actor-fell');
        this._restoreBody(actor.id);
        resetActor(actor);
        this.practice.status = 'retry';
      }
    }
    if (this.incomingTether) {
      const tether = this.incomingTether;
      const caster = this.actors.get(tether.actorId);
      if (!caster || caster.health <= 0 || caster.source <= 0 || this.health <= 0 || this.meditating) {
        this._releaseIncoming(this.meditating ? 'meditation' : 'exhausted');
      } else {
        caster.source = Math.max(0, caster.source - tether.upkeep * dt);
        tether.escapeProgress = Math.max(0, tether.escapeProgress - STRUGGLE_RULES.decayPerSecond * dt);
      }
    }
  }

  step(dt, input = {}) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    const frameDt = Math.min(dt, 0.1);
    this.meditating = !!input.meditating;
    if (this.meditating) { this.release('meditation'); this._releaseIncoming('meditation'); }
    const struggleDown = !!input.struggle;
    if (struggleDown && !this._struggleWasDown) this._struggle();
    this._struggleWasDown = struggleDown;
    const jumpDown = !!input.jump;
    if (jumpDown && !this._jumpWasDown && !this.meditating) this._jumpQueued = true;
    this._jumpWasDown = jumpDown;
    this._accumulator += frameDt;
    while (this._accumulator + 1e-10 >= FIXED_STEP) {
      this._accumulator -= FIXED_STEP;
      this.elapsed += FIXED_STEP;
      if (this.meditating) {
        this.source = Math.min(100, this.source + 16 * FIXED_STEP);
        this.health = Math.min(100, this.health + 3 * FIXED_STEP);
      }
      if (this.hook) {
        const reel = clamp(finite(input.reel), -1, 1);
        this.hook.length = clamp(this.hook.length - reel * this.hook.reelSpeed * FIXED_STEP, this.hook.minLength, this.hook.maxLength);
        const drain = this.hook.upkeep + (reel > 0 ? 0.65 : 0);
        this.source = Math.max(0, this.source - drain * FIXED_STEP);
        if (this.source <= 0) {
          this.release('exhausted');
          if (!this._exhausted) this._event('exhausted');
          this._exhausted = true;
        }
      }
      if (this.source > 0.1) this._exhausted = false;
      this.combat.step(FIXED_STEP);
      this._stepActors(FIXED_STEP);
      this._move(FIXED_STEP, input);
      const wasGrounded = this.grounded;
      const verticalBeforeContact = this.player.velocity.y;
      this._impactSpeed = Math.min(this._impactSpeed, this.player.velocity.y);
      this.world.step(FIXED_STEP);
      const groundContact = this._readGrounded();
      if (groundContact && verticalBeforeContact <= 0 && this.player.velocity.y > 0 && !this.hook) {
        // Penetration correction must not bounce the character after a hard landing.
        this.player.velocity.y = 0;
      }
      this._rope(FIXED_STEP);
      if (this.incomingTether) {
        const caster = this.actors.get(this.incomingTether.actorId).body;
        this._solveTether(FIXED_STEP, this.incomingTether, caster, this.player, this.player.position);
      }
      this.grounded = groundContact && this.player.velocity.y < 1.5;
      if (groundContact) {
        if (!wasGrounded && this._impactSpeed < -12) {
          const damage = Math.min(100, (-this._impactSpeed - 12) * 4);
          this.combat.damagePlayer(damage, 'fall');
          this._event('fall-damage', { damage });
        }
        this._impactSpeed = 0;
      }
      if (this.player.position.y < -15 || this.health <= 0 || !Number.isFinite(this.player.position.x)) {
        this.reset();
        break;
      }
    }
    // Jump must be deliberately pressed; a missed grounded jump does not trigger later.
    this._jumpQueued = false;
  }

  reset() {
    this.release('reset');
    this.resetPractice();
    for (const [id, body] of this.bodies) {
      const initial = this.initialStates.get(id);
      body.position.copy(initial.position);
      body.quaternion.copy(initial.quaternion);
      body.velocity.setZero();
      body.angularVelocity.setZero();
      body.force.setZero();
      body.torque.setZero();
      body.previousPosition.copy(body.position);
      body.interpolatedPosition.copy(body.position);
      body.aabbNeedsUpdate = true;
      body.wakeUp();
    }
    this.player.position.set(...SPAWN);
    this.player.previousPosition.copy(this.player.position);
    this.player.interpolatedPosition.copy(this.player.position);
    this.player.velocity.setZero();
    this.player.angularVelocity.setZero();
    this.player.force.setZero();
    this.player.torque.setZero();
    this.player.aabbNeedsUpdate = true;
    this.player.wakeUp();
    this.world.broadphase.dirty = true;
    this.source = this.health = this.stamina = 100;
    this.grounded = false;
    this._accumulator = 0;
    this._impactSpeed = 0;
    this._jumpQueued = false;
    this._jumpWasDown = false;
    this._jumpGrace = 0;
    this._exhausted = false;
    this._event('reset');
  }

  getSnapshot() {
    const anchor = this.anchorPosition();
    return {
      combat: this.combat.snapshot(),
      practice: { ...this.practice },
      actors: [...this.actors.values()].map(actor => ({ ...actorSnapshot(actor), escapeProgress: actor.escapeProgress / (this.hook?.bodyId === actor.id ? this.hook.requiredPresses : escapeThreshold(this.reinforcement)) })),
      incomingTether: this.incomingTether ? {
        actorId: this.incomingTether.actorId, anchor: this.actors.get(this.incomingTether.actorId).body.position.toArray(),
        length: this.incomingTether.length, tension: this.incomingTether.tension,
        escapeProgress: this.incomingTether.escapeProgress / this.incomingTether.requiredPresses,
        requiredPresses: this.incomingTether.requiredPresses, acceptedPresses: this.incomingTether.acceptedPresses,
      } : null,
      player: { position: this.player.position.toArray(), velocity: this.player.velocity.toArray() },
      source: this.source,
      health: this.health,
      stamina: this.stamina,
      grounded: this.grounded,
      meditating: this.meditating,
      weakened: this.source <= 0.01,
      creation: normalizeCreation(this.creation),
      reinforcement: this.reinforcement,
      activationCost: this.activationCost,
      upkeepCost: this.upkeepCost,
      hook: this.hook ? {
        bodyId: this.hook.bodyId,
        actorId: this.actors.has(this.hook.bodyId) ? this.hook.bodyId : null,
        stage: this.hook.stage,
        escapeProgress: (this.actors.get(this.hook.bodyId)?.escapeProgress || 0) / this.hook.requiredPresses,
        requiredPresses: this.hook.requiredPresses,
        anchor: anchor.toArray(),
        length: this.hook.length,
        minLength: this.hook.minLength,
        distance: this.player.position.distanceTo(anchor),
        maxLength: this.hook.maxLength,
        tension: this.hook.tension,
      } : null,
      objects: Array.from(this.bodies, ([id, body]) => ({
        id,
        position: body.position.toArray(),
        quaternion: body.quaternion.toArray(),
      })),
    };
  }
}
