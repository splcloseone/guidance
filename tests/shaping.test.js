import test from 'node:test';
import assert from 'node:assert/strict';
import { creationFromPreset, saveCreation, loadCreation } from '../src/creation.js';
import { shapeFromStroke, stretchBall } from '../src/shaping.js';
import { createHook } from '../src/models.js';

test('a drawn ball becomes the traced curve, retaining its identity and settings', () => {
  const ball = creationFromPreset('orb');
  ball.color = '#aabbcc'; ball.strength = 5; ball.shape.assisted = false;
  const stroke = [[0,0,0],[0,.8,0],[.7,.8,0],[.7,.3,0],[.3,.3,0]];
  const shaped = shapeFromStroke(ball, stroke);
  assert.equal(shaped.form, 'hook'); assert.equal(shaped.id, ball.id);
  assert.equal(shaped.color, '#aabbcc'); assert.equal(shaped.strength, 5);
  assert.equal(shaped.shape.assisted, false);
  assert.deepEqual(shaped.shape.points[0], stroke[0]);
  assert.deepEqual(shaped.shape.points.at(-1), stroke.at(-1));
  assert(shaped.shape.points.some(point => point[0] > .6 && point[1] > .6));
  assert.notDeepEqual(shaped.shape.points, creationFromPreset('hook').shape.points);
  assert.equal(ball.form, 'orb');
  const mesh = createHook(shaped);
  assert([...mesh.group.children[0].geometry.attributes.position.array].every(Number.isFinite));
  mesh.dispose();
  let saved; const storage = { setItem: (k,v) => { saved = v; }, getItem: () => saved };
  saveCreation(storage, shaped);
  assert.deepEqual(loadCreation(storage).creation.shape.points, shaped.shape.points);
});

test('controller stretching produces an unbent strand rather than a finished preset', () => {
  const strand = stretchBall(creationFromPreset('orb'));
  assert.equal(strand.form, 'hook');
  assert(strand.shape.points.every(point => point[0] === 0 && point[2] === 0));
  assert.equal(strand.shape.points[0][1], .65);
  assert.equal(strand.shape.points.at(-1)[1], -.65);
});

test('clicks, tiny drags, and malformed paths cannot replace an existing design', () => {
  const ball = creationFromPreset('orb');
  for (const stroke of [null, [], [[0,0,0]], [[0,0,0],[0,.01,0]], [[NaN,0,0],[0,0,0]]]) assert.equal(shapeFromStroke(ball, stroke), null);
  const long = shapeFromStroke(ball, Array.from({length:100}, (_,i) => [i / 30, Math.sin(i / 8), 0]));
  assert(long.shape.points.length <= 12);
  assert(long.shape.points.flat().every(n => Number.isFinite(n) && Math.abs(n) <= 1.5));
});
