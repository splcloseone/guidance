import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CREATION, normalizeCreation, loadCreation, saveCreation } from '../src/creation.js';

test('custom creations survive a storage round trip', () => {
  const values = new Map();
  const storage = { getItem: k => values.get(k), setItem: (k, v) => values.set(k, v) };
  const creation = { ...DEFAULT_CREATION, name: 'Crane Hook', color: '#ddbb77', reach: 35, hookSize: 1.4 };
  saveCreation(storage, creation);
  assert.deepEqual(loadCreation(storage).creation, creation);
  assert.equal(loadCreation(storage).saved, true);
});

test('malformed or out-of-range local data cannot break the workshop', () => {
  assert.deepEqual(normalizeCreation(null), DEFAULT_CREATION);
  const result = normalizeCreation({ name: '  ', color: 'url(invalid)', reach: Infinity, strength: -5 });
  assert.equal(result.name, DEFAULT_CREATION.name);
  assert.equal(result.color, DEFAULT_CREATION.color);
  assert.equal(result.reach, DEFAULT_CREATION.reach);
  assert.equal(result.strength, 1);
  assert.deepEqual(loadCreation({ getItem: () => '{' }).creation, DEFAULT_CREATION);
});

test('storage failures are exposed so the UI does not report a false save', () => {
  assert.throws(() => saveCreation({ setItem: () => { throw new Error('quota'); } }, DEFAULT_CREATION));
  assert.equal(loadCreation({ getItem: () => { throw new Error('denied'); } }).available, false);
});
