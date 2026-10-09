import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createHook } from '../src/models.js';
import { CREATION_PRESETS, creationFromPreset } from '../src/creation.js';

const positions = model => Array.from(model.group.children[0].geometry.attributes.position.array);

test('all presets produce finite geometry and lasso is a single unadorned loop', () => {
  for (const preset of CREATION_PRESETS) {
    const model = createHook(preset.creation);
    assert.ok(positions(model).every(Number.isFinite), preset.id);
    assert.equal(model.group.userData.creationForm, preset.id);
    if (preset.id === 'lasso') {
      assert.equal(model.group.children.length, 1);
      assert.equal(model.group.children[0].geometry.parameters.closed, true);
      const geometry = model.group.children[0].geometry;
      const values = geometry.attributes.position;
      const endIndex = values.count - (geometry.parameters.radialSegments + 1);
      assert.ok(new THREE.Vector3().fromBufferAttribute(values, 0).distanceTo(new THREE.Vector3().fromBufferAttribute(values, endIndex)) < .0001);
    }
    model.dispose();
  }
});

test('editing a saved path changes its rendered geometry rather than only its label', () => {
  const creation = creationFromPreset('hook');
  const original = createHook(creation);
  creation.shape.points[2] = [.9, -.6, .8];
  const edited = createHook(creation);
  assert.notDeepEqual(positions(original), positions(edited));
  assert.ok(positions(edited).some((coordinate, index) => index % 3 === 2 && coordinate > .7));
  original.dispose();
  edited.dispose();
});

test('assistance changes the curve treatment while preserving editable handles', () => {
  const creation = creationFromPreset('hook');
  const smooth = createHook(creation);
  creation.shape.assisted = false;
  const angular = createHook(creation);
  assert.notDeepEqual(positions(smooth), positions(angular));
  assert.ok(positions(angular).every(Number.isFinite));
  smooth.dispose();
  angular.dispose();
});

test('stretching ball extent handles changes the manifested body', () => {
  const creation = creationFromPreset('orb');
  const original = createHook(creation);
  creation.shape.points[1][0] = 1.2;
  const edited = createHook(creation);
  const before = new THREE.Box3().setFromObject(original.group).getSize(new THREE.Vector3());
  const after = new THREE.Box3().setFromObject(edited.group).getSize(new THREE.Vector3());
  assert.ok(after.x > before.x * 2);
  assert.equal(after.y, before.y);
  original.dispose();
  edited.dispose();
});

test('mesh rebuild disposal releases shared claw resources exactly once', () => {
  const model = createHook(creationFromPreset('claw'));
  let geometryDisposals = 0, materialDisposals = 0;
  model.group.children[0].geometry.addEventListener('dispose', () => geometryDisposals++);
  model.material.addEventListener('dispose', () => materialDisposals++);
  model.dispose();
  model.dispose();
  assert.equal(geometryDisposals, 1);
  assert.equal(materialDisposals, 1);
});

test('legacy color-only model callers still work', () => {
  const model = createHook('#ee6677');
  assert.equal(model.material.color.getHexString(), 'ee6677');
  assert.equal(model.group.userData.creationForm, 'hook');
  model.dispose();
});
