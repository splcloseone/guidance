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
const instructions = `THE SOURCE — creation and tether practice\n\nOpen The-Source.html in desktop Chrome or Edge.\nChoose a ball, hook, lasso, or claw preset in meditation. Open Shape by hand\nto edit its points; shaping assistance is optional. Description assistance\nunderstands the supported forms, colors and modifiers shown in the workshop.\nSave creation adds your design to the local library.\n\nEnter proving ground, then choose a practice from the panel:\n1: catch a rival | 2: rescue an ally | 3: break a tether | 4: reset practice\nWASD: move | right mouse drag: look | Space: jump | Shift: sprint\nF / left click: cast | E: release | Q / R: reel in / out\nT: lift a caught rival, then press again to slam\nB: repeatedly press to escape an incoming tether; holding does not repeat\nM: meditation | G: map | H: complete controls, including controller bindings\n\nThicker tethers resist breakout and pull harder, but use more of the Source.\nHealth damage from slams is based on actual impacts with the scenery.\n\nDesign edits and safe player state autosave in this browser. Keep the file\nin the same location and use the same browser. Clearing browser storage\nremoves saves. Saved creations stay; active tethers and practice scenarios\nreset on reload. Save creation stores up to 20 designs without silently\ndeleting older designs when full.\n\nThis is a local prototype with practice characters. Multiplayer, free-form\ncreatures, touch controls, and unrestricted text-to-creation are not included.\nController input is implemented; individual hardware models are not verified.\nNo installation or network connection is needed after downloading.\n`;
await writeFile(resolve(root, 'releases/START-HERE.txt'), instructions);
await writeFile(resolve(root, 'releases/The-Source-Play.zip'), releaseZip([
  ['The-Source.html', html], ['START-HERE.txt', instructions], ['LICENSES.txt', licenseText],
]));
console.log(`Playable HTML, ZIP, and hosting folder generated in ${resolve(root, 'releases')}`);
