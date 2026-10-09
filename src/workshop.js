/**
 * Meditation workshop adapter. Creation rules and persistence live in creation.js;
 * this module only translates accessible controls and pointer input into edits.
 * No simulation state is owned here: the caller applies each normalized edit.
 */
import {
  CREATION_PRESETS, creationFromPreset, normalizeCreation, describeCreation,
  loadLibrary, saveLibrary, upsertLibrary,
} from './creation.js';

const SHAPE_LIMIT = 1.5;
const MIN_POINTS = 3;
const MAX_POINTS = 12;
const $ = (id) => document.getElementById(id);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const ICONS = {
  orb: '<circle cx="20" cy="20" r="10"/><circle cx="17" cy="17" r="3" opacity=".35"/>',
  hook: '<path d="M23 5v20c0 12-17 12-17 1 0-6 5-9 9-5"/><path d="m10 18 6 3-2 5"/><circle cx="23" cy="5" r="3"/>',
  lasso: '<ellipse cx="18" cy="17" rx="10" ry="12"/><path d="M24 26c13 6 6 13 2 9"/>',
  claw: '<path d="M20 4v14m0 0C7 17 4 22 8 32l6-7m6-7c13-1 16 4 12 14l-6-7m-6-7v16"/>',
};

export function initWorkshop({ getCreation, onChange, storage, toast = () => {} }) {
  const controller = new AbortController();
  const listen = (element, event, callback) => element.addEventListener(event, callback, { signal: controller.signal });
  const loadedLibrary = loadLibrary(storage);
  let library = loadedLibrary.creations;
  let selectedPoint = 0;
  let dragging = false;
  let dragPointer = null;
  const canvas = $('shape-canvas');
  const context = canvas.getContext('2d');

  function setPanel(name, open) {
    $(`${name}-toggle`).setAttribute('aria-expanded', String(open));
    $(`${name}-panel`).hidden = !open;
    const mark = $(`${name}-toggle`).lastElementChild;
    if (name !== 'library') mark.textContent = open ? '−' : '+';
    if (name === 'shape' && open) drawShape();
  }

  for (const name of ['description', 'shape', 'library']) {
    listen($(`${name}-toggle`), 'click', () => setPanel(name, $(`${name}-panel`).hidden));
  }

  function commit(value) {
    const next = normalizeCreation(value);
    onChange(next);
    sync(next);
    return next;
  }

  for (const preset of CREATION_PRESETS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'creation-preset';
    button.dataset.preset = preset.id;
    button.title = preset.description;
    button.setAttribute('aria-pressed', 'false');
    // This SVG is a fixed local icon, never a description or user-supplied value.
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 40 40');
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = ICONS[preset.id] || ICONS.hook;
    const label = document.createElement('span');
    label.textContent = preset.id === 'orb' ? 'Ball' : preset.label;
    button.append(icon, label);
    button.setAttribute('aria-label', preset.label);
    listen(button, 'click', () => {
      selectedPoint = 0;
      commit(creationFromPreset(preset.id));
      $('description-status').textContent = '';
      toast(`${preset.label} is ready to shape. Your saved designs remain in your library.`);
    });
    $('creation-presets').append(button);
  }

  listen($('stretch-creation'), 'click', () => {
    const current = getCreation();
    const hook = creationFromPreset('hook');
    selectedPoint = 0;
    commit({ ...current, form: 'hook', name: current.name === 'Ball of the Source' ? hook.name : current.name, shape: { ...hook.shape, assisted: current.shape.assisted } });
    setPanel('shape', true);
    $('shape-status').textContent = 'Your ball now has a curve. Drag its points or adjust them below.';
    toast('The ball has become a hook. Shape its curve to make it yours.');
  });

  listen($('describe-creation'), 'click', () => {
    const result = describeCreation($('creation-description').value, getCreation());
    $('description-status').textContent = result.message;
    $('description-status').dataset.state = result.creation ? 'success' : 'unsupported';
    if (result.creation) {
      selectedPoint = 0;
      commit(result.creation);
      toast('Your described design is ready to adjust.');
    }
  });

  listen($('shaping-assistance'), 'change', () => {
    const current = getCreation();
    commit({ ...current, shape: { ...current.shape, assisted: $('shaping-assistance').checked } });
  });

  function editPoint(axis, value) {
    const current = getCreation();
    const points = current.shape.points.map((point) => [...point]);
    selectedPoint = clamp(selectedPoint, 0, points.length - 1);
    points[selectedPoint][axis] = clamp(value, -SHAPE_LIMIT, SHAPE_LIMIT);
    commit({ ...current, shape: { ...current.shape, points } });
  }

  for (const [axis, index] of [['x', 0], ['y', 1], ['z', 2]]) {
    listen($(`shape-${axis}`), 'input', () => editPoint(index, Number($(`shape-${axis}`).value)));
  }
  listen($('shape-point'), 'change', () => {
    selectedPoint = Number($('shape-point').value);
    sync(getCreation());
  });
  listen($('shape-thickness'), 'input', () => {
    const current = getCreation();
    commit({ ...current, shape: { ...current.shape, thickness: Number($('shape-thickness').value) } });
  });

  listen($('shape-add-point'), 'click', () => {
    const current = getCreation();
    const points = current.shape.points.map((point) => [...point]);
    if (points.length >= MAX_POINTS) return;
    const after = selectedPoint === points.length - 1 && current.form !== 'lasso' ? selectedPoint - 1 : selectedPoint;
    const a = points[after], b = points[(after + 1) % points.length];
    const midpoint = a.map((value, axis) => (value + b[axis]) / 2);
    points.splice(after + 1, 0, midpoint);
    selectedPoint = after + 1;
    commit({ ...current, shape: { ...current.shape, points } });
    $('shape-status').textContent = 'Point added between its neighbors.';
  });
  listen($('shape-remove-point'), 'click', () => {
    const current = getCreation();
    const points = current.shape.points.map((point) => [...point]);
    if (points.length <= MIN_POINTS) return;
    points.splice(selectedPoint, 1);
    selectedPoint = Math.min(selectedPoint, points.length - 1);
    commit({ ...current, shape: { ...current.shape, points } });
    $('shape-status').textContent = 'Point removed. Your curve connects its remaining points.';
  });

  function canvasSpace() {
    const rect = canvas.getBoundingClientRect();
    return { width: rect.width || 280, height: rect.height || 210, scale: Math.min(rect.width || 280, rect.height || 210) / 3.5 };
  }
  function project(point, space) {
    return [space.width / 2 + point[0] * space.scale, space.height / 2 - point[1] * space.scale];
  }
  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  }
  function dragPoint(event) {
    const current = getCreation();
    if (!dragging) return;
    const space = canvasSpace(), [x, y] = pointerPosition(event);
    const snap = (value) => current.shape.assisted ? Math.round(value / 0.05) * 0.05 : Math.round(value * 1000) / 1000;
    const points = current.shape.points.map((point) => [...point]);
    points[selectedPoint][0] = clamp(snap((x - space.width / 2) / space.scale), -SHAPE_LIMIT, SHAPE_LIMIT);
    points[selectedPoint][1] = clamp(snap((space.height / 2 - y) / space.scale), -SHAPE_LIMIT, SHAPE_LIMIT);
    commit({ ...current, shape: { ...current.shape, points } });
  }
  listen(canvas, 'pointerdown', (event) => {
    if (event.button !== 0) return;
    const space = canvasSpace(), pointer = pointerPosition(event);
    let nearest = -1, distance = 22;
    getCreation().shape.points.forEach((point, index) => {
      const p = project(point, space), d = Math.hypot(p[0] - pointer[0], p[1] - pointer[1]);
      if (d < distance) { nearest = index; distance = d; }
    });
    if (nearest < 0) return;
    event.preventDefault();
    selectedPoint = nearest;
    dragging = true;
    dragPointer = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    sync(getCreation());
  });
  listen(canvas, 'pointermove', (event) => { if (dragging && event.pointerId === dragPointer) dragPoint(event); });
  const endDrag = () => { dragging = false; dragPointer = null; };
  listen(canvas, 'pointerup', endDrag);
  listen(canvas, 'pointercancel', endDrag);
  listen(canvas, 'lostpointercapture', endDrag);

  function drawShape() {
    if (!context || $('shape-panel').hidden) return;
    const current = getCreation(), space = canvasSpace();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(space.width * dpr);
    canvas.height = Math.round(space.height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, space.width, space.height);
    context.lineWidth = 1;
    for (let value = -1.5; value <= 1.5; value += 0.25) {
      context.strokeStyle = value === 0 ? '#7b9b844d' : '#7b9b8418';
      const startX = project([value, 0], space)[0], startY = project([0, value], space)[1];
      context.beginPath(); context.moveTo(startX, 0); context.lineTo(startX, space.height); context.stroke();
      context.beginPath(); context.moveTo(0, startY); context.lineTo(space.width, startY); context.stroke();
    }
    const points = current.shape.points.map((point) => project(point, space));
    if (current.form === 'orb') {
      const left = Math.min(...points.map(point => point[0])), right = Math.max(...points.map(point => point[0]));
      const top = Math.min(...points.map(point => point[1])), bottom = Math.max(...points.map(point => point[1]));
      const cx = (left + right) / 2, cy = (top + bottom) / 2;
      const rx = Math.max(5, (right - left) / 2), ry = Math.max(5, (bottom - top) / 2);
      const gradient = context.createRadialGradient(cx - rx * .2, cy - ry * .2, 2, cx, cy, Math.max(rx, ry));
      gradient.addColorStop(0, '#f0fff9'); gradient.addColorStop(.35, current.color); gradient.addColorStop(1, `${current.color}20`);
      context.fillStyle = gradient;
      context.beginPath(); context.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); context.fill();
    }
    if (current.form !== 'orb') {
    context.strokeStyle = `${current.color}70`; context.lineWidth = 1;
    context.setLineDash([3, 4]); context.beginPath();
    points.forEach((p, index) => index ? context.lineTo(...p) : context.moveTo(...p));
    if (current.form === 'lasso') context.closePath();
    context.stroke(); context.setLineDash([]);

    // A sampled Catmull-Rom guide joins the editable handles; the 3D preview is
    // authoritative for the tube, lasso closure, and the claw's mirrored branch.
    function curvePath(pathPoints = points) {
      const closed = current.form === 'lasso';
      const at = (index) => pathPoints[closed ? (index + pathPoints.length) % pathPoints.length : clamp(index, 0, pathPoints.length - 1)];
      context.beginPath();
      if (!current.shape.assisted) {
        pathPoints.forEach((p, index) => index ? context.lineTo(...p) : context.moveTo(...p));
        if (closed) context.closePath();
        context.stroke();
        return;
      }
      const segments = closed ? pathPoints.length : pathPoints.length - 1;
      for (let segment = 0; segment < segments; segment++) {
        const p0 = at(segment - 1), p1 = at(segment), p2 = at(segment + 1), p3 = at(segment + 2);
        for (let step = 0; step <= 12; step++) {
          const t = step / 12, t2 = t * t, t3 = t2 * t;
          const p = [0, 1].map((axis) => .5 * (2 * p1[axis] + (-p0[axis] + p2[axis]) * t + (2 * p0[axis] - 5 * p1[axis] + 4 * p2[axis] - p3[axis]) * t2 + (-p0[axis] + 3 * p1[axis] - 3 * p2[axis] + p3[axis]) * t3));
          if (!segment && !step) context.moveTo(...p); else context.lineTo(...p);
        }
      }
      context.stroke();
    }
    context.lineCap = 'round'; context.lineJoin = 'round';
    context.strokeStyle = current.color; context.lineWidth = Math.max(2, current.shape.thickness * space.scale * 2);
    curvePath();
    if (current.form === 'claw') {
      context.globalAlpha = .45;
      for (const angle of [Math.PI * 2 / 3, Math.PI * 4 / 3]) {
        curvePath(current.shape.points.map(point => project([point[0] * Math.cos(angle) + point[2] * Math.sin(angle), point[1]], space)));
      }
      context.globalAlpha = 1;
    }
    }
    points.forEach((point, index) => {
      context.beginPath(); context.arc(...point, index === selectedPoint ? 7 : 5, 0, Math.PI * 2);
      context.fillStyle = index === selectedPoint ? '#e0c88e' : '#153532'; context.fill();
      context.strokeStyle = index === selectedPoint ? '#fff1c8' : current.color; context.lineWidth = 1.5; context.stroke();
      context.font = '10px sans-serif'; context.fillStyle = '#e0e8d7';
      context.fillText(String(index + 1), point[0] + 9, point[1] - 7);
    });
  }

  function syncLibrary(preferredId = getCreation().id) {
    const select = $('creation-library');
    const existingSelection = select.value;
    select.replaceChildren();
    if (!library.length) select.add(new Option('No saved designs yet', ''));
    for (const item of library) select.add(new Option(item.name, item.id));
    select.value = library.some((item) => item.id === preferredId) ? preferredId : library.some((item) => item.id === existingSelection) ? existingSelection : library[0]?.id || '';
    $('library-load').disabled = !library.length;
    select.disabled = !library.length;
    $('library-count').textContent = `${library.length} / 20`;
  }
  listen($('library-load'), 'click', () => {
    const item = library.find((design) => design.id === $('creation-library').value);
    if (!item) return;
    selectedPoint = 0;
    commit(item);
    toast(`${item.name} loaded. Edit it or enter the proving ground.`);
  });
  listen($('library-new'), 'click', () => {
    selectedPoint = 0;
    commit(creationFromPreset('orb'));
    $('library-status').textContent = 'A fresh ball is ready. Save creation to add this design to your library.';
    toast('A new ball of the Source. Your saved designs are still here.');
  });

  function saveDesign(value = getCreation()) {
    let candidate;
    try { candidate = upsertLibrary(library, value); }
    catch (error) {
      $('library-status').textContent = error.message;
      toast(error.message, 5000);
      return false;
    }
    try {
      library = saveLibrary(storage, candidate);
      $('library-status').textContent = 'Design saved on this device. Edit and save again to update it, or choose a new preset to start another.';
      syncLibrary(value.id);
      return true;
    } catch {
      // Retain the working library for this session, but never claim durable save.
      library = candidate;
      syncLibrary(value.id);
      $('library-status').textContent = 'Device storage is unavailable. Your library will last only for this session.';
      toast('Your design is available for this session. Device storage could not save the library.', 5000);
      return false;
    }
  }

  function sync(value = getCreation()) {
    const current = normalizeCreation(value);
    document.querySelectorAll('[data-preset]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.preset === current.form)));
    $('stretch-creation').hidden = current.form !== 'orb';
    $('shaping-assistance').checked = current.shape.assisted;
    selectedPoint = clamp(selectedPoint, 0, current.shape.points.length - 1);
    const pointSelect = $('shape-point');
    if (pointSelect.options.length !== current.shape.points.length) {
      pointSelect.replaceChildren();
      current.shape.points.forEach((point, index) => pointSelect.add(new Option(`Point ${index + 1}`, String(index))));
    }
    pointSelect.value = String(selectedPoint);
    const point = current.shape.points[selectedPoint];
    for (const [axis, index] of [['x', 0], ['y', 1], ['z', 2]]) {
      $(`shape-${axis}`).value = String(point[index]);
      $(`shape-${axis}-value`).textContent = point[index].toFixed(2);
    }
    $('shape-add-point').disabled = current.form === 'orb' || current.shape.points.length >= MAX_POINTS;
    $('shape-remove-point').disabled = current.form === 'orb' || current.shape.points.length <= MIN_POINTS;
    $('shape-thickness').value = current.shape.thickness;
    $('shape-thickness-value').textContent = current.shape.thickness.toFixed(3);
    $('shape-thickness').disabled = current.form === 'orb';
    $('shape-help').textContent = current.form === 'orb' ? 'These six handles stretch the ball. Select a point and adjust its depth to shape the front or back, or stretch it into a hook above.' : current.form === 'claw' ? 'Drag the numbered points. Two more prongs repeat your curve around the center. Depth bends the shape toward or away from you.' : 'Drag a point to reshape it. Use Depth to bend it toward or away from you. The preview above shows the full form.';
    drawShape();
  }

  const observer = new ResizeObserver(drawShape);
  observer.observe(canvas);
  if (!loadedLibrary.available) $('library-status').textContent = 'Device storage is unavailable. Designs can be tested during this session.';
  syncLibrary();
  sync();
  return {
    sync, saveDesign,
    dispose() { controller.abort(); observer.disconnect(); },
  };
}
