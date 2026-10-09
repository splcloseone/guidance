import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CREATION, CREATION_PRESETS, STORAGE_KEY, LIBRARY_KEY, MAX_LIBRARY_SIZE,
  normalizeCreation, creationFromPreset, loadCreation, saveCreation,
  loadLibrary, saveLibrary, upsertLibrary, describeCreation,
} from '../src/creation.js';

const memoryStorage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};

test('v1 creations migrate in place without losing customized settings', () => {
  const storage = memoryStorage();
  const legacy = { name: 'My old hook', color: '#FfaA99', reach: 39, reelSpeed: 11, strength: 4, hookSize: 1.3 };
  storage.setItem(STORAGE_KEY, JSON.stringify(legacy));
  const { creation, available, saved } = loadCreation(storage);
  assert.equal(available, true);
  assert.equal(saved, true);
  for (const [field, value] of Object.entries(legacy)) assert.equal(creation[field], value);
  assert.equal(creation.version, 2);
  assert.equal(creation.form, 'hook');
  assert.deepEqual(creation.shape, DEFAULT_CREATION.shape);
  saveCreation(storage, creation);
  assert.deepEqual(loadCreation(storage).creation, creation);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).version, 2);
});

test('preset copies have independent points and distinct stable identities', () => {
  for (const preset of CREATION_PRESETS) {
    const first = creationFromPreset(preset.id), second = creationFromPreset(preset.id);
    assert.equal(first.form, preset.id);
    assert.notEqual(first.id, second.id);
    assert.equal(normalizeCreation(first).id, first.id);
    first.shape.points[0][0] = 1.4;
    assert.notEqual(second.shape.points[0][0], 1.4);
    assert.notEqual(preset.creation.shape.points[0][0], 1.4);
  }
});

test('shape normalization bounds edited data and repairs unusable paths', () => {
  const result = normalizeCreation({
    form: 'lasso',
    shape: { points: [[-99, 0, 0], [0, 99, 0], [99, 0, 0], [Infinity, 0, 0], ['0', 0, 0], [-99, 0, 0]], thickness: 5, assisted: false },
  });
  assert.deepEqual(result.shape.points, [[-1.5, 0, 0], [0, 1.5, 0], [1.5, 0, 0]]);
  assert.equal(result.shape.thickness, .16);
  assert.equal(result.shape.assisted, false);
  const repaired = normalizeCreation({ shape: { points: [[0, 0, 0], [0, 0, 0], [0, 0, 0]] } });
  assert.deepEqual(repaired.shape.points, DEFAULT_CREATION.shape.points);
  assert.equal(normalizeCreation({ shape: { points: Array.from({ length: 30 }, (_, i) => [i / 30, 0, 0]) } }).shape.points.length, 12);
  const copy = normalizeCreation(DEFAULT_CREATION);
  copy.shape.points[0][0] = 1;
  assert.equal(DEFAULT_CREATION.shape.points[0][0], 0);
});

test('custom 3D curves survive the active design and library storage round trip', () => {
  const storage = memoryStorage();
  const custom = creationFromPreset('lasso');
  custom.shape = { points: [[-.8, 0, -.2], [0, .9, .1], [.8, 0, .3], [0, -.7, -.1]], thickness: .09, assisted: false };
  saveCreation(storage, custom);
  saveLibrary(storage, [custom]);
  assert.deepEqual(loadCreation(storage).creation, custom);
  assert.deepEqual(loadLibrary(storage), { creations: [custom], available: true });
  assert.equal(JSON.parse(storage.getItem(LIBRARY_KEY)).version, 2);
});

test('library updates by identity and a full library never silently discards a saved design', () => {
  let library = [];
  const first = creationFromPreset('hook');
  library = upsertLibrary(library, first);
  library = upsertLibrary(library, { ...first, name: 'Revised hook' });
  assert.equal(library.length, 1);
  assert.equal(library[0].name, 'Revised hook');
  for (let index = 1; index < MAX_LIBRARY_SIZE; index++) library = upsertLibrary(library, creationFromPreset('lasso'));
  assert.equal(library.length, MAX_LIBRARY_SIZE);
  assert.equal(library.some(item => item.id === first.id), true);
  const before = structuredClone(library);
  assert.throws(() => upsertLibrary(library, creationFromPreset('lasso')), /library is full/);
  assert.deepEqual(library, before);
  const saved = library.at(-1);
  const update = upsertLibrary(library, { ...saved, strength: 5 });
  assert.equal(update.length, MAX_LIBRARY_SIZE);
  assert.equal(update.at(-1).strength, 5);
  assert.notEqual(update.at(-1).shape.points, saved.shape.points);
});

test('library corruption and storage denial are exposed without claiming a save', () => {
  assert.deepEqual(loadLibrary({ getItem: () => '{broken' }), { creations: [], available: false });
  assert.deepEqual(loadLibrary({ getItem: () => { throw new Error('denied'); } }), { creations: [], available: false });
  assert.throws(() => saveLibrary({ setItem: () => { throw new Error('quota'); } }, [DEFAULT_CREATION]), /quota/);
  const storage = memoryStorage();
  storage.setItem(LIBRARY_KEY, JSON.stringify({ version: 2, creations: [null, 4, [], DEFAULT_CREATION] }));
  assert.equal(loadLibrary(storage).creations.length, 1);
});

test('description assistance edits supported forms and properties deterministically', () => {
  const current = creationFromPreset('hook');
  const description = 'Please make a long purple lasso with strong fast thin small';
  const first = describeCreation(description, current), second = describeCreation(description, current);
  assert.deepEqual(first, second);
  assert.equal(first.creation.id, current.id);
  assert.equal(first.creation.form, 'lasso');
  assert.equal(first.creation.color, '#b592ee');
  assert.equal(first.creation.reach, 40);
  assert.equal(first.creation.strength, 5);
  assert.equal(first.creation.reelSpeed, 12);
  assert.equal(first.creation.hookSize, .6);
  assert.equal(first.creation.shape.thickness, .03);
  assert.equal(current.form, 'hook');
  assert.equal(describeCreation('small white ball').creation.form, 'orb');
  assert.equal(describeCreation('short light slow #123abc claw').creation.color, '#123abc');
});

test('describing changes on the current form preserves hand-shaped geometry', () => {
  const custom = creationFromPreset('hook');
  custom.shape.points[0] = [.4, .8, .2];
  const described = describeCreation('a red strong hook', custom).creation;
  assert.deepEqual(described.shape.points, custom.shape.points);
  assert.equal(described.id, custom.id);
  described.shape.points[0][0] = -1;
  assert.equal(custom.shape.points[0][0], .4);
});

test('unsupported creatures or actions are rejected instead of a misleading creation', () => {
  for (const description of ['a horse', 'a horse with a red hook', 'a flying healing lasso', 'a shark', 'hook and claw', '']) {
    const result = describeCreation(description);
    assert.equal(result.creation, null, description);
    assert.ok(result.message.length > 0);
  }
  assert.match(describeCreation('a horse').message, /creatures.*not available/i);
});
