import { execFileSync, spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Publishes only generated web assets. It never changes the checkout or index,
// and the push is a normal fast-forward (concurrent publishing fails safely).
const root = fileURLToPath(new URL('../', import.meta.url));
const git = (args, input) => execFileSync('git', args, { cwd: root, input, encoding: 'utf8' }).trim();
const filenames = ['.nojekyll', 'LICENSES.txt', 'index.html'];
const contents = await Promise.all(filenames.map(name => readFile(new URL(`../releases/web/${name}`, import.meta.url))));
if (!contents[2].includes(Buffer.from('id="loading-state"'))) throw new Error('Build the playable release before publishing.');

if (!process.argv.includes('--publish')) {
  console.log('Prepared web files:', filenames.join(', '));
  console.log('Run npm run package:play and verify the build, then add --publish to push it to origin/gh-pages.');
} else {
  const remoteRef = git(['ls-remote', '--heads', 'origin', 'refs/heads/gh-pages']);
  const parent = remoteRef.split(/\s/)[0];
  if (parent) git(['fetch', 'origin', 'gh-pages']);
  const entries = filenames.map((name, index) => `100644 blob ${git(['hash-object', '-w', '--stdin'], contents[index])}\t${name}\n`).join('');
  const tree = git(['mktree'], entries);
  if (parent && git(['rev-parse', `${parent}^{tree}`]) === tree) {
    console.log(`The same web build is already published at ${parent}.`);
  } else {
    const commit = git(['commit-tree', tree, ...(parent ? ['-p', parent] : []), '-m', 'Update The Source creation and practice prototype']);
    const pushed = spawnSync('git', ['push', 'origin', `${commit}:refs/heads/gh-pages`], { cwd: root, stdio: 'inherit' });
    if (pushed.status !== 0) throw new Error('Publishing failed. No force push was attempted.');
    await writeFile(new URL('../releases/hosting-commit.txt', import.meta.url), `${commit}\n`);
    console.log(`Published web commit ${commit}. Check GitHub Pages build status before sharing the updated site.`);
  }
}
