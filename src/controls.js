const editable = (target) => target instanceof HTMLElement && (target.matches('input,textarea,select') || target.isContentEditable);
const deadzone = value => Math.abs(value || 0) < 0.17 ? 0 : (Math.abs(value) - 0.17) / 0.83 * Math.sign(value);

// Embedded browsers can deny Gamepad API access. Keyboard input must keep working.
export function connectedGamepad() {
  try { return Array.from(navigator.getGamepads?.() || []).find(pad => pad?.connected) || null; }
  catch { return null; }
}

export class Controls {
  constructor(canvas) {
    this.keys = new Set();
    this.actions = [];
    this.lookX = 0;
    this.lookY = 0;
    this.device = 'keyboard';
    this.gamepadName = '';
    this.previousButtons = [];
    this.dragging = false;
    this.blockGameplay = false;
    window.addEventListener('keydown', event => {
      if (editable(event.target)) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
      this.device = 'keyboard';
      this.keys.add(event.code);
      if (event.repeat) return;
      const action = { Space: 'jump', KeyF: 'cast', KeyE: 'release', KeyT: 'slam', Digit1: 'practice-rival', Digit2: 'practice-rescue', Digit3: 'practice-breakout', Digit4: 'practice-reset', KeyM: 'meditate', KeyG: 'map', KeyH: 'guide', Escape: 'escape' }[event.code];
      if (action) this.actions.push(action);
    });
    window.addEventListener('keyup', event => this.keys.delete(event.code));
    window.addEventListener('blur', () => this.clear());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.clear(); });
    canvas.addEventListener('contextmenu', event => event.preventDefault());
    canvas.addEventListener('pointerdown', event => {
      this.device = 'keyboard';
      if (event.button === 2) { this.dragging = true; canvas.setPointerCapture(event.pointerId); }
      if (event.button === 0) this.actions.push('cast');
    });
    canvas.addEventListener('pointermove', event => {
      if (this.dragging) { this.lookX += event.movementX; this.lookY += event.movementY; }
    });
    canvas.addEventListener('pointerup', () => { this.dragging = false; });
    canvas.addEventListener('lostpointercapture', () => { this.dragging = false; });
  }

  clear() { this.keys.clear(); this.actions.length = 0; this.dragging = false; this.lookX = this.lookY = 0; }

  read(dt) {
    const pad = connectedGamepad();
    let mx = 0, forward = 0, reel = 0, sprint = false;
    let struggle = this.keys.has('KeyB');
    let lx = this.lookX * 0.004, ly = this.lookY * 0.004;
    this.lookX = this.lookY = 0;
    this.gamepadName = pad?.id || '';
    if (pad) {
      const axes = pad.axes.map(deadzone);
      const down = index => !!pad.buttons[index]?.pressed || (pad.buttons[index]?.value || 0) > 0.45;
      if (axes.some(a => Math.abs(a) > 0.03) || pad.buttons.some(b => b.pressed)) this.device = 'controller';
      mx += axes[0] || 0; forward -= axes[1] || 0;
      lx += (axes[2] || 0) * dt * 2.3; ly += (axes[3] || 0) * dt * 1.8;
      reel += Number(down(6)) - Number(down(5));
      sprint = down(10);
      struggle ||= down(11);
      for (const [index, action] of [[0,'jump'],[1,'escape'],[2,'slam'],[3,'meditate'],[4,'release'],[7,'cast'],[8,'map'],[9,'guide'],[12,'practice-rescue'],[13,'practice-reset'],[14,'practice-rival'],[15,'practice-breakout']]) {
        if (down(index) && !this.previousButtons[index]) this.actions.push(action);
      }
      this.previousButtons = pad.buttons.map((_, index) => down(index));
    } else this.previousButtons = [];
    mx += Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));
    forward += Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) - Number(this.keys.has('KeyS') || this.keys.has('ArrowDown'));
    reel += Number(this.keys.has('KeyQ')) - Number(this.keys.has('KeyR'));
    sprint ||= this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const actions = this.actions.splice(0);
    return { x: mx, forward, reel: Math.sign(reel), sprint, struggle, lookX: lx, lookY: ly, actions };
  }
}
