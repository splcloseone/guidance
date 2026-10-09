export const SESSION_KEY = 'the-source.session.v1';
const bounded = (value, minimum, maximum, fallback) => Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, value)) : fallback;
const vector = (value, limit = 1000) => Array.isArray(value) && value.length === 3 && value.every(n => Number.isFinite(n) && Math.abs(n) < limit);

export function loadSession(storage) {
  try {
    const state = JSON.parse(storage.getItem(SESSION_KEY));
    if (!state || state.version !== 1 || !vector(state.position, 100) || state.position[1] < 0) return null;
    return {
      ...state,
      combatRemaining: bounded(state.combatRemaining, 0, 8, 0),
      source: bounded(state.source, 0, 100, 100),
      health: bounded(state.health, 1, 100, 100),
      stamina: bounded(state.stamina, 0, 100, 100),
      objects: Array.isArray(state.objects) ? state.objects.filter(item =>
        typeof item.id === 'string' && vector(item.position) && item.position[1] > -5 &&
        Array.isArray(item.quaternion) && item.quaternion.length === 4 && item.quaternion.every(Number.isFinite)) : [],
      objectives: { hookCount: bounded(state.objectives?.hookCount, 0, 100000, 0), swingComplete: !!state.objectives?.swingComplete, pullComplete: !!state.objectives?.pullComplete },
    };
  } catch { return null; }
}

export function saveSession(storage, simulation, lastSafePosition, objectives) {
  const snapshot = simulation.getSnapshot();
  const state = {
    version: 1, savedAt: new Date().toISOString(),
    position: [...lastSafePosition],
    combatRemaining: snapshot.combatRemaining,
    source: snapshot.source, health: snapshot.health, stamina: snapshot.stamina,
    // Practice actors restart their scenario after reload; never restore a body
    // without its corresponding health/AI/capture state.
    objects: snapshot.objects.filter(item => simulation.bodies.get(item.id)?.mass > 0 && !simulation.actors?.has(item.id)),
    objectives: { ...objectives },
  };
  // Deliberately save designs and safe physical state, never an active manifestation.
  storage.setItem(SESSION_KEY, JSON.stringify(state));
  return state;
}

export function restoreSession(simulation, state) {
  if (!state) return;
  simulation.player.position.set(...state.position);
  simulation.player.velocity.setZero();
  simulation.combatUntil = simulation.elapsed + (state.combatRemaining || 0);
  simulation.source = state.source;
  simulation.health = state.health;
  simulation.stamina = state.stamina;
  for (const item of state.objects) {
    const body = simulation.bodies.get(item.id);
    if (!body || body.mass <= 0 || simulation.actors?.has(item.id)) continue;
    body.position.set(...item.position);
    body.quaternion.set(...item.quaternion);
    body.quaternion.normalize();
    body.velocity.setZero();
    body.angularVelocity.setZero();
    body.aabbNeedsUpdate = true;
  }
  simulation.world.broadphase.dirty = true;
}
