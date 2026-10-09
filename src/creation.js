/**
 * Serializable creation definitions. No renderer or simulation objects belong here.
 * The historical storage key is retained so existing installations upgrade in place.
 */
export const STORAGE_KEY = 'the-source.creation.v1';
export const LIBRARY_KEY = 'the-source.library.v2';
export const CREATION_VERSION = 2;
export const MAX_LIBRARY_SIZE = 20;

function freezeDeep(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeDeep);
    Object.freeze(value);
  }
  return value;
}

const HOOK_POINTS = [[0, .55, 0], [0, -.08, 0], [-.12, -.32, 0], [-.39, -.33, 0], [-.53, -.13, 0], [-.45, .10, 0]];
const LASSO_POINTS = Array.from({ length: 8 }, (_, index) => {
  const angle = Math.PI / 2 + index * Math.PI / 4;
  return [Math.cos(angle) * .48, Math.sin(angle) * .62, 0];
});
const SHAPES = freezeDeep({
  hook: { points: HOOK_POINTS, thickness: .055, assisted: true },
  lasso: { points: LASSO_POINTS, thickness: .045, assisted: true },
  claw: { points: [[0, .55, 0], [0, .08, 0], [.17, -.20, 0], [.40, -.20, 0], [.51, .07, 0], [.39, .30, 0]], thickness: .065, assisted: true },
  // For an orb these points are extent handles; the workshop can stretch it into a path.
  orb: { points: [[-.32, 0, 0], [.32, 0, 0], [0, -.32, 0], [0, .32, 0], [0, 0, -.32], [0, 0, .32]], thickness: .055, assisted: true },
});

export const DEFAULT_CREATION = freezeDeep({
  version: CREATION_VERSION, id: 'creation-default', form: 'hook',
  name: 'Tethered Hook', color: '#8fdcc8', reach: 28, reelSpeed: 7, strength: 3, hookSize: 1,
  shape: SHAPES.hook,
});

export const CREATION_PRESETS = freezeDeep([
  { id: 'orb', label: 'Ball of the Source', description: 'A blank form to shape. Stretch it into a tether creation before casting.', creation: { ...DEFAULT_CREATION, form: 'orb', name: 'Ball of the Source', color: '#ffffff', shape: SHAPES.orb } },
  { id: 'hook', label: 'Tethered Hook', description: 'An open curve for catching anchors, objects, and practice characters.', creation: DEFAULT_CREATION },
  { id: 'lasso', label: 'Looping Lasso', description: 'A closed loop for catching and pulling with a tether.', creation: { ...DEFAULT_CREATION, form: 'lasso', name: 'Looping Lasso', color: '#ebc477', shape: SHAPES.lasso } },
  { id: 'claw', label: 'Threefold Claw', description: 'Three matching curved prongs, shaped together from one editable path.', creation: { ...DEFAULT_CREATION, form: 'claw', name: 'Threefold Claw', color: '#a9b9ff', shape: SHAPES.claw } },
]);

const clamp = (value, min, max, fallback) => {
  if (value === null || value === '' || typeof value === 'boolean') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

function normalizeShape(value, form) {
  const defaults = SHAPES[form];
  let points = Array.isArray(value?.points) ? value.points
    .filter(point => Array.isArray(point) && point.length === 3 && point.every(coordinate => typeof coordinate === 'number' && Number.isFinite(coordinate)))
    .slice(0, 12)
    .map(point => point.map(coordinate => Math.max(-1.5, Math.min(1.5, coordinate)))) : [];
  // Consecutive duplicate points create degenerate tube segments; keep the path usable.
  points = points.filter((point, index) => index === 0 || point.some((coordinate, axis) => Math.abs(coordinate - points[index - 1][axis]) > .0001));
  if (form === 'lasso' && points.length > 1 && points[0].every((coordinate, axis) => Math.abs(coordinate - points.at(-1)[axis]) < .0001)) points.pop();
  if (points.length < 3) points = defaults.points.map(point => [...point]);
  return {
    points,
    thickness: clamp(value?.thickness, .025, .16, defaults.thickness),
    assisted: typeof value?.assisted === 'boolean' ? value.assisted : defaults.assisted,
  };
}

export function normalizeCreation(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) value = {};
  const form = Object.hasOwn(SHAPES, value.form) ? value.form : DEFAULT_CREATION.form;
  return {
    version: CREATION_VERSION,
    id: typeof value.id === 'string' && /^[\w-]{1,80}$/.test(value.id) ? value.id : DEFAULT_CREATION.id,
    form,
    name: typeof value.name === 'string' ? value.name.trim().slice(0, 36) || DEFAULT_CREATION.name : DEFAULT_CREATION.name,
    color: typeof value.color === 'string' && /^#[\da-f]{6}$/i.test(value.color) ? value.color : DEFAULT_CREATION.color,
    reach: clamp(value.reach, 12, 40, DEFAULT_CREATION.reach),
    reelSpeed: clamp(value.reelSpeed, 3, 12, DEFAULT_CREATION.reelSpeed),
    strength: clamp(value.strength, 1, 5, DEFAULT_CREATION.strength),
    hookSize: clamp(value.hookSize, .6, 1.6, DEFAULT_CREATION.hookSize),
    shape: normalizeShape(value.shape, form),
  };
}

function newId() {
  return `creation-${globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`}`;
}

export function creationFromPreset(id) {
  const preset = CREATION_PRESETS.find(entry => entry.id === id) || CREATION_PRESETS.find(entry => entry.id === 'hook');
  return normalizeCreation({ ...preset.creation, id: newId() });
}

export function loadCreation(storage) {
  try {
    const saved = storage.getItem(STORAGE_KEY);
    return { creation: normalizeCreation(saved ? JSON.parse(saved) : {}), saved: !!saved, available: true };
  } catch {
    return { creation: normalizeCreation(), saved: false, available: false };
  }
}

export function saveCreation(storage, creation) {
  const normalized = normalizeCreation(creation);
  storage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function upsertLibrary(library, creation) {
  const next = normalizeCreation(creation);
  const creations = [];
  for (const value of Array.isArray(library) ? library : []) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const item = normalizeCreation(value);
    if (item.id !== next.id && !creations.some(existing => existing.id === item.id)) creations.push(item);
  }
  if (creations.length >= MAX_LIBRARY_SIZE) throw new RangeError('Your design library is full. Update an existing saved design; no saved designs have been removed.');
  return [...creations, next];
}

function normalizeLibrary(values) {
  const creations = [];
  for (const value of Array.isArray(values) ? values : []) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const next = normalizeCreation(value);
    const index = creations.findIndex(item => item.id === next.id);
    if (index >= 0) creations[index] = next;
    else if (creations.length < MAX_LIBRARY_SIZE) creations.push(next);
  }
  return creations;
}

export function loadLibrary(storage) {
  try {
    const saved = storage.getItem(LIBRARY_KEY);
    const parsed = saved ? JSON.parse(saved) : {};
    return { creations: normalizeLibrary(Array.isArray(parsed) ? parsed : parsed?.creations), available: true };
  } catch {
    return { creations: [], available: false };
  }
}

export function saveLibrary(storage, creations) {
  const normalized = normalizeLibrary(creations);
  storage.setItem(LIBRARY_KEY, JSON.stringify({ version: CREATION_VERSION, creations: normalized }));
  return normalized;
}

const COLORS = Object.freeze({
  white: '#ffffff', silver: '#c5d2df', red: '#ee6677', crimson: '#bb2849', orange: '#ff9955', amber: '#ebbc68',
  yellow: '#ffdd77', gold: '#e0c68e', green: '#7bc98e', teal: '#8fdcc8', cyan: '#77ddeb', blue: '#779dee',
  purple: '#b592ee', violet: '#b592ee', pink: '#ee9dca', black: '#353641',
});
const FORM_WORDS = Object.freeze({ hook: 'hook', lasso: 'lasso', claw: 'claw', ball: 'orb', orb: 'orb' });
const MODIFIERS = Object.freeze({
  long: ['reach', 40], longer: ['reach', 40], short: ['reach', 16], shorter: ['reach', 16],
  strong: ['strength', 5], stronger: ['strength', 5], heavy: ['strength', 5], light: ['strength', 1], lighter: ['strength', 1],
  fast: ['reelSpeed', 12], faster: ['reelSpeed', 12], slow: ['reelSpeed', 3], slower: ['reelSpeed', 3],
  large: ['hookSize', 1.6], big: ['hookSize', 1.6], small: ['hookSize', .6],
  thick: ['thickness', .12], thin: ['thickness', .03],
});
const GLUE_WORDS = new Set('a an the please make create shape into me my with and of source i want that is it colored colour color coloured grappling tether tethered range reach strength reel speed size very'.split(' '));

/** Offline vocabulary matching, not a model or a promise of arbitrary text-to-geometry. */
export function describeCreation(text, current = DEFAULT_CREATION) {
  const help = 'Try a hook, lasso, claw, or ball; a color; and long/short, strong/light, fast/slow, thick/thin, or large/small. Moving creatures and custom actions are not available yet.';
  if (typeof text !== 'string' || !text.trim()) return { creation: null, message: `Describe a tether design. ${help}` };
  if (text.length > 240) return { creation: null, message: 'Keep the description under 240 characters.' };
  const words = text.toLowerCase().match(/#[a-f\d]{6}\b|[a-z]+|\d+/g) || [];
  const unknown = words.filter(word => !Object.hasOwn(FORM_WORDS, word) && !Object.hasOwn(COLORS, word) && !Object.hasOwn(MODIFIERS, word) && !GLUE_WORDS.has(word) && !/^#[a-f\d]{6}$/.test(word));
  if (unknown.length) return { creation: null, message: `This workshop does not understand “${[...new Set(unknown)].slice(0, 4).join(', ')}”. ${help}` };
  const forms = [...new Set(words.filter(word => Object.hasOwn(FORM_WORDS, word)).map(word => FORM_WORDS[word]))];
  if (forms.length > 1) return { creation: null, message: 'Choose one starting form: hook, lasso, claw, or ball. You can reshape it afterward.' };
  const recognized = words.some(word => Object.hasOwn(FORM_WORDS, word) || Object.hasOwn(COLORS, word) || Object.hasOwn(MODIFIERS, word) || word.startsWith('#'));
  if (!recognized) return { creation: null, message: help };
  const previous = normalizeCreation(current);
  const form = forms[0] || previous.form;
  const base = form === previous.form ? previous : normalizeCreation({ ...CREATION_PRESETS.find(preset => preset.id === form).creation, id: previous.id });
  const next = { ...base, shape: { ...base.shape } };
  for (const word of words) {
    if (Object.hasOwn(COLORS, word)) next.color = COLORS[word];
    else if (/^#[a-f\d]{6}$/.test(word)) next.color = word;
    else if (Object.hasOwn(MODIFIERS, word)) {
      const [field, value] = MODIFIERS[word];
      if (field === 'thickness') next.shape.thickness = value;
      else next[field] = value;
    }
  }
  return { creation: normalizeCreation(next), message: 'Design assembled with offline description assistance. Adjust its shape and test it before saving.' };
}
