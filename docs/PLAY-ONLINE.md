# Play and publish

The public prototype is hosted on [GitHub Pages](https://splcloseone.github.io/guidance/).
Use desktop Chrome or Edge with WebGL2 and a keyboard/mouse or standard controller.
The source checkout may include work newer than the published game; PROGRESS.md
records the verified release status.

## Download

[Download the hosted build](https://github.com/splcloseone/guidance/archive/refs/heads/gh-pages.zip),
extract the ZIP, and open index.html. `npm run package:play` also generates an
offline ZIP at releases/The-Source-Play.zip containing The-Source.html, instructions
and licenses. Direct file navigation cannot be verified in the managed cloud
browser; the same self-contained HTML is checked from an isolated HTTP server.

## Update the public game

GitHub Pages is already configured for **Deploy from a branch → gh-pages → / (root)**.
The GitHub Actions workflow prepared before hosting was enabled is no longer used.

1. Run the tests and browser checks described in README.md.
2. Run `npm run package:play` and validate the standalone file.
3. Run `npm run publish:pages` to inspect the publishing instructions.
4. When publishing is intended, run `npm run publish:pages -- --publish`.
5. Check GitHub Pages build status and verify the public URL before reporting a
   release as live. Compare the downloaded HTML to releases/web/index.html.

The helper sends only index.html, LICENSES.txt and .nojekyll to the hosting branch.
It preserves the current checkout and index, creates a normal descendant commit,
and refuses a non-fast-forward push. A concurrent update must be reviewed and
retried; never force-push around it. Source code is kept separately from web assets.
The helper does not enable Pages or change repository settings.

## Saves and devices

Saves belong to the browser and website origin. Updating the site at its existing
URL preserves compatible local saves. A downloaded file uses separate storage;
moving it or clearing browser data may lose access to those saves. Phone/tablet
touch controls are not implemented.
