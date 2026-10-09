export function practiceInstructions(practice = {}) {
  const finished = {
    rescued: 'Your ally is safe. Release the tether or reset to try another rescue.',
    escaped: 'You broke free. Try a stronger tether or move to a different practice.',
    defeated: 'Rival defeated. Reset practice to bring them back.',
    retry: 'The partner fell out of the practice area. Reset the scenario to try again.',
  };
  if (finished[practice.status]) return finished[practice.status];
  return {
    rival: 'Catch the rival, reel them closer, then lift and slam. They will struggle to escape.',
    rescue: 'Catch your ally near the ledge and reel them to safety. Their momentum pulls on you too.',
    breakout: 'Tap the struggle button repeatedly. Each new press counts; holding does not. Keep moving while caught.',
  }[practice.mode] || 'Choose a practice: catch a rival, rescue an ally, or break a tether.';
}

/** DOM adapter for the practice scenarios. Physics never depends on these controls. */
export function createPracticeUI({ simulation, startPractice, resetPractice, storage, toast }) {
  const byId = id => document.getElementById(id);
  const settingsKey = 'the-source.practice-settings.v1';
  const friendly = byId('practice-friendly-hooks');
  try {
    const settings = JSON.parse(storage.getItem(settingsKey));
    simulation.allowFriendlyHooks = settings?.allowFriendlyHooks !== false;
  } catch { simulation.allowFriendlyHooks = true; }
  if (friendly) {
    friendly.checked = simulation.allowFriendlyHooks;
    friendly.addEventListener('change', () => {
      simulation.allowFriendlyHooks = friendly.checked;
      if (!friendly.checked && simulation.actors.get(simulation.hook?.bodyId)?.role === 'ally') simulation.release('friendly-disabled');
      try { storage.setItem(settingsKey, JSON.stringify({ allowFriendlyHooks: friendly.checked })); }
      catch { toast('Your friendly-hook preference could not be saved on this device.'); }
    });
  }
  for (const mode of ['rival', 'rescue', 'breakout']) byId(`practice-${mode}`)?.addEventListener('click', () => startPractice(mode));
  byId('practice-reset')?.addEventListener('click', resetPractice);
  return {
    update(snapshot, device) {
      const incoming = snapshot.incomingTether;
      const target = snapshot.actors?.find(actor => actor.id === snapshot.hook?.bodyId);
      const escape = incoming?.escapeProgress ?? target?.escapeProgress ?? 0;
      const status = byId('practice-status');
      if (status) status.textContent = incoming
        ? `Caught · tap ${device === 'controller' ? 'R3' : 'B'} repeatedly · ${Math.round(escape * 100)}% free`
        : practiceInstructions(snapshot.practice);
      const targetVitals = byId('practice-target-vitals');
      if (targetVitals) targetVitals.hidden = !target;
      const struggleMeter = byId('struggle-meter');
      if (struggleMeter) struggleMeter.hidden = !incoming;
      const struggle = byId('struggle-progress');
      if (struggle) { struggle.value = escape * 100; struggle.setAttribute('aria-valuetext', `${Math.round(escape * 100)} percent escaped`); }
      const health = byId('target-health');
      if (health) { health.value = target?.health ?? 100; health.setAttribute('aria-valuetext', target ? `${Math.ceil(target.health)} health` : 'No character caught'); }
      const integrity = byId('tether-integrity');
      if (integrity) { integrity.value = incoming || target ? (1 - escape) * 100 : 0; integrity.setAttribute('aria-valuetext', `${Math.round(incoming || target ? (1 - escape) * 100 : 0)} percent binding strength remains`); }
    },
  };
}
