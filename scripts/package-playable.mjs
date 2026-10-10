import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { build } from 'vite';
import { releaseZip } from './zip.mjs';

// The prototype has no remote assets or dynamic imports. Inline its production
// bundle so players can open one HTML file without a local development server.
await build();
const root = process.cwd();
const dist = resolve(root, 'dist');
let html = await readFile(resolve(dist, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g)];
for (const match of scripts) {
  const filename = resolve(dist, match[1].replace(/^\//, ''));
  if (relative(dist, filename).startsWith('..')) throw new Error('Unexpected script path');
  const javascript = (await readFile(filename, 'utf8')).replace(/<\/script/gi, '<\\/script');
  html = html.replace(match[0], () => `<script type="module">${javascript}</script>`);
}
const styles = [...html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*>/g)];
for (const match of styles) {
  const href = match[0].match(/href="([^"]+)"/)?.[1];
  if (!href) throw new Error('Stylesheet has no path');
  const filename = resolve(dist, href.replace(/^\//, ''));
  if (relative(dist, filename).startsWith('..')) throw new Error('Unexpected stylesheet path');
  const css = (await readFile(filename, 'utf8')).replace(/<\/style/gi, '<\\/style');
  html = html.replace(match[0], () => `<style>${css}</style>`);
}
const favicon = await readFile(resolve(root, 'public/sigil.svg'));
html = html.replace('href="/sigil.svg"', `href="data:image/svg+xml;base64,${favicon.toString('base64')}"`);
const licenses = await Promise.all(['three', 'cannon-es'].map(async name => `${name}\n\n${await readFile(resolve(root, 'node_modules', name, 'LICENSE'), 'utf8')}`));
const licenseText = licenses.join('\n\n----------------------------------------\n\n');
html = html.replace('</body>', () => `<script type="text/plain" id="third-party-licenses">${licenseText.replace(/<\/script/gi, '<\\/script')}</script></body>`);
if (/<(?:script|link)\b[^>]*(?:src|href)="\//.test(html)) throw new Error('Standalone file still has external dependencies');
await mkdir(resolve(root, 'releases'), { recursive: true });
await writeFile(resolve(root, 'releases/The-Source.html'), html);
await writeFile(resolve(root, 'releases/LICENSES.txt'), licenseText);
// The same self-contained build works at a hosting site's root or subdirectory.
// Keeping the upload folder separate avoids publishing source or local settings.
await mkdir(resolve(root, 'releases/web'), { recursive: true });
await writeFile(resolve(root, 'releases/web/index.html'), html);
await writeFile(resolve(root, 'releases/web/LICENSES.txt'), licenseText);
await writeFile(resolve(root, 'releases/web/.nojekyll'), '');
const instructions = `THE SOURCE — PROTOTYPE 3

Open The-Source.html in a current WebGL2 browser. For phones, the hosted
link is easiest: https://splcloseone.github.io/guidance/?v=0.4.0

Enter the proving ground. Choose Hook -> 4-hit combo from Practice.
Slot 1 casts a hook that pulls an opponent to you. Select slot 2, then
attack four times: three strikes followed by a heavy finisher.
Spike surrounds your body and weapon with white aura.

KEYBOARD: WASD move, right-drag look, Space jump, Shift sprint.
1-4 slots | left click attack/use | F dedicated hook cast | C spike
E dismiss selected | Q/R toggle reel/payout outside combat | T lift/slam
B repeated taps to escape | M meditate | G map | H complete guide.

CONTROLLER: sticks move/look, D-pad left/right/up/down selects slots,
RT attack, B spike, LB dismiss, LT toggle reel, RB payout, A jump,
X lift/slam, repeated R3 escape, Y meditate, View map, Menu guide.

TOUCH: stick moves, drag world to look, tap saved slots and buttons.
Hold a slot to dismiss it. Adjust button size/side in meditation.
Landscape recommended. Real device performance still needs testing.

MEDITATION: Choose a preset, customize scale/power/color, then Assign &
save slot. Saved slots are separate from the working design/library.
Save creation stores up to 20 designs. Optional clay/curve editing remains.
Armor can stay active alongside your weapon; both cost reserve upkeep.
Tool presets have combat traits; mining/farming/harvesting are planned.
Combat blocks meditation and practice resets. Disengage first.

Designs, assigned slots and safe player state save in this browser.
Keep the same site/file location and browser. Clearing storage removes
saves. Active creations disappear on reload; remaining combat lock persists.

Local practice only: no online multiplayer, arbitrary creature creation,
world travel, parrying or finished progression. Controller and phone browser
input is tested synthetically; specific hardware is not certified.
No network assets are needed once this file is loaded.
`;
await writeFile(resolve(root, 'releases/START-HERE.txt'), instructions);
await writeFile(resolve(root, 'releases/The-Source-Play.zip'), releaseZip([
  ['The-Source.html', html], ['START-HERE.txt', instructions], ['LICENSES.txt', licenseText],
]));
console.log(`Playable HTML, ZIP, and hosting folder generated in ${resolve(root, 'releases')}`);
