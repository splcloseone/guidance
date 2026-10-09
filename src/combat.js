import { clayHasVolume } from './clay.js';
/** Local melee authority. All tuning, hit windows, costs and damage live here. */
export const AURA = Object.freeze({ activation: 5, upkeep: 2, attack: 1.5, protection: .3 });
export const SWINGS = Object.freeze([
  { windup: .18, active: .22, recovery: .26, damage: 20 },
  { windup: .16, active: .22, recovery: .27, damage: 22 },
  { windup: .28, active: .2, recovery: .38, damage: 28 },
]);
export class Combat {
  constructor(sim) { this.sim = sim; this.weapon = 'tether'; this.reset(); }
  reset() { if (this.weapon === 'source-sword') this.weapon = 'fists'; this.spiking = false; this.strike = null; this.combo = 0; this.lastEnd = -10; this.wearing = false; this.manifested = false; this.counterAt = 0; this.counterWindup = 0; }
  toggleAura() {
    const s = this.sim;
    if (s.meditating || s.health <= 0) return false;
    if (this.spiking) { this.spiking = false; return true; }
    if (s.source < AURA.activation) { s._event('combat-message', { message: 'You need 5 of the Source to spike. Rest in meditation.' }); return false; }
    s.source -= AURA.activation; this.spiking = true;
    s._event('aura-spiked'); return true;
  }
  equip(weapon) {
    if (!['tether', 'fists', 'sword', 'source-sword'].includes(weapon) || this.strike) return false;
    if (weapon === 'source-sword' && (!this.manifested || this.sim.creation.solid?.purpose !== 'sword')) return false;
    this.weapon = weapon; return true;
  }
  manifest() {
    const s = this.sim, purpose = s.creation.solid?.purpose;
    if (s.meditating || s.creation.form !== 'clay' || !clayHasVolume(s.creation.solid) || !['armor','sword'].includes(purpose)) return false;
    if (this.wearing || this.manifested) { this.dismiss(); return true; }
    if (s.source < 10) { s._event('combat-message', { message: 'Manifesting this design needs 10 of the Source.' }); return false; }
    s.source -= 10;
    if (purpose === 'armor') this.wearing = true;
    else { this.manifested = true; this.weapon = 'source-sword'; }
    return true;
  }
  dismiss() { this.wearing = this.manifested = false; if (this.weapon === 'source-sword') { this.weapon = 'fists'; this.strike = null; } }
  attack(direction) {
    const s = this.sim;
    if (s.meditating || s.health <= 0 || this.weapon === 'tether') return false;
    if (this.strike) {
      if (this.strike.t >= this.strike.rule.windup + this.strike.rule.active) this.strike.queued = true;
      return false;
    }
    const cost = this.weapon === 'fists' ? 5 : 9;
    if (s.stamina < cost || !Array.isArray(direction) || !direction.every(Number.isFinite)) return false;
    const length = Math.hypot(direction[0], direction[2]);
    if (length < .01) return false;
    s.stamina -= cost;
    const index = s.elapsed - this.lastEnd < .65 ? this.combo % 3 : 0;
    const rule = this.weapon === 'fists' ? { windup: .12, active: .14, recovery: .22, damage: 9 } : SWINGS[index];
    this.strike = { t: 0, index, rule, direction: [direction[0] / length, 0, direction[2] / length], hits: new Set(), queued: false };
    s._event('melee-start', { weapon: this.weapon }); return true;
  }
  damagePlayer(amount, kind = 'melee') {
    const s = this.sim;
    const protection = kind === 'fall' ? 0 : Math.min(.6, (this.spiking ? AURA.protection : 0) + (this.wearing ? .25 : 0));
    const damage = Math.min(s.health, amount * (1 - protection));
    s.health = Math.max(0, s.health - damage);
    if (damage > 0) s._event('player-damaged', { damage, protected: protection > 0, kind, position: s.player.position.toArray() });
    return damage;
  }
  visibleTarget(body) {
    const s = this.sim;
    const from = s.player.position.clone(); from.y += .35;
    // Ignore the player and target; solids between the two block melee.
    let blocked = false;
    s.world.raycastAll(from, body.position, { skipBackfaces: true }, hit => {
      if (hit.body !== s.player && hit.body !== body && !s.actors.has(hit.body.userData?.id)) blocked = true;
    });
    return !blocked;
  }
  step(dt) {
    const s = this.sim;
    if (s.meditating) { this.reset(); return; }
    const upkeep = (this.spiking ? AURA.upkeep : 0) + (this.wearing || this.manifested ? 1 : 0);
    s.source = Math.max(0, s.source - upkeep * dt);
    if (s.source <= 0) {
      if (this.spiking || this.wearing || this.manifested) s._event('exhausted');
      this.spiking = false; this.dismiss(); s.release('exhausted');
    }
    const strike = this.strike;
    if (strike) {
      strike.t += dt;
      const { windup, active, recovery, damage } = strike.rule;
      if (strike.t >= windup && strike.t < windup + active) {
        const reach = this.weapon === 'fists' ? 1.55 : 2.55;
        for (const actor of s.actors.values()) {
          if (actor.role !== 'rival' || actor.health <= 0 || strike.hits.has(actor.id)) continue;
          const offset = actor.body.position.vsub(s.player.position);
          const distance = Math.hypot(offset.x, offset.z);
          const forward = (offset.x * strike.direction[0] + offset.z * strike.direction[2]) / Math.max(.01, distance);
          if (distance > reach || Math.abs(offset.y) > 1.5 || forward < .45 || !this.visibleTarget(actor.body)) continue;
          strike.hits.add(actor.id);
          const dealt = Math.min(actor.health, damage * (this.spiking ? AURA.attack : s.source <= .01 ? .7 : 1));
          actor.health -= dealt;
          actor.body.velocity.x += strike.direction[0] * 1.1; actor.body.velocity.z += strike.direction[2] * 1.1;
          s._event('actor-damaged', { actorId: actor.id, damage: dealt, health: actor.health, kind: this.weapon, position: actor.body.position.toArray() });
          if (actor.health <= 0) {
            if (s.hook?.bodyId === actor.id) s.release('defeated');
            if (s.incomingTether?.actorId === actor.id) s._releaseIncoming('defeated');
            s.practice.status = 'defeated';
          }
        }
      }
      if (strike.t >= windup + active + recovery) {
        this.combo = strike.index + 1; this.lastEnd = s.elapsed; this.strike = null;
        if (strike.queued) this.attack(strike.direction);
      }
    }
    // Deliberate, telegraphed practice counter; never attacks outside this scenario.
    const rival = s.actors.get('practice-rival');
    if (s.practice.mode !== 'melee' || !rival || rival.health <= 0 || s.hook?.bodyId === rival.id) { this.counterWindup = 0; return; }
    const distance = rival.body.position.distanceTo(s.player.position);
    if (this.counterWindup) {
      if (s.elapsed >= this.counterWindup) {
        if (distance < 2.5 && this.visibleTarget(rival.body)) this.damagePlayer(12);
        this.counterWindup = 0; this.counterAt = s.elapsed + 2.3;
      }
    } else if (distance < 2.5 && s.elapsed > this.counterAt) {
      this.counterWindup = s.elapsed + .85;
      s._event('combat-message', { message: 'Rival winding up—move away or test your protection!' });
    }
  }
  snapshot() {
    const a = this.strike;
    return { spiking: this.spiking, weapon: this.weapon, wearing: this.wearing, manifested: this.manifested,
      counterWindup: this.counterWindup, attack: a ? { t: a.t, index: a.index, direction: [...a.direction], ...a.rule } : null };
  }
}
