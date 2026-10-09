import { normalizeCreation } from './creation.js';

/** Turn a traced path into bounded, evenly spaced editable handles. */
export function shapeFromStroke(creation, stroke) {
  const points = [];
  for (const point of Array.isArray(stroke) ? stroke.slice(0, 1024) : []) {
    if (!Array.isArray(point) || point.length !== 3 || !point.every(Number.isFinite)) continue;
    const next = point.map(n => Math.max(-1.5, Math.min(1.5, n)));
    const last = points.at(-1);
    if (!last || Math.hypot(...next.map((n, i) => n - last[i])) > .001) points.push(next);
  }
  if (points.length < 2) return null;
  const distances = [0];
  for (let i = 1; i < points.length; i++) distances.push(distances.at(-1) + Math.hypot(...points[i].map((n, axis) => n - points[i - 1][axis])));
  const length = distances.at(-1);
  if (length < .12) return null; // A click or a tiny tremor leaves the ball intact.
  const count = Math.min(12, Math.max(3, Math.ceil(length / .16) + 1));
  let segment = 1;
  const handles = Array.from({ length: count }, (_, i) => {
    const distance = length * i / (count - 1);
    while (segment < distances.length - 1 && distances[segment] < distance) segment++;
    const t = (distance - distances[segment - 1]) / (distances[segment] - distances[segment - 1]);
    return points[segment].map((value, axis) => points[segment - 1][axis] + (value - points[segment - 1][axis]) * t);
  });
  const current = normalizeCreation(creation);
  return normalizeCreation({
    ...current,
    form: current.form === 'orb' ? 'hook' : current.form,
    name: current.name === 'Ball of the Source' ? 'Hand-shaped tether' : current.name,
    shape: { ...current.shape, points: handles },
  });
}

/** Controller/keyboard starting point: stretch raw material into an unbent strand. */
export function stretchBall(creation) {
  return shapeFromStroke(creation, [[0, .65, 0], [0, -.65, 0]]);
}
