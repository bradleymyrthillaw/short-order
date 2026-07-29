# Short Order — dev kit

Everything needed to keep developing Short Order in a new repo: the game itself,
the Blender asset pipeline, and the Playwright render-check scripts. Extracted
from a larger monorepo (`chez-samoa-3D`) — paths below assume you drop this
folder's *contents* at the root of the new repo (so `tools/blender/` sits next
to `public/short-order/`, matching the layout `build.sh` expects).

```
public/short-order/     the game -- see public/short-order/CLAUDE.md first
tools/blender/           the Blender -> GLB asset pipeline
render-tools/            Playwright screenshot/render-check scripts (moved
                          here from a neighboring project in the old repo)
```

## Play it

Open `public/short-order/index.html` in a browser. No build step. Needs
network access for the three.js r128 CDN `<script>` tag (cdnjs) and the
GLTFLoader tag (unpkg) — see `index.html`'s `<head>`.

## Read this first

**`public/short-order/CLAUDE.md`** — the real developer handoff: architecture,
invariants (things that look like bugs but aren't — read before "fixing"
them), the layout of `index.html`'s ~6,200 lines, tuning dials, and the asset
pipeline section this dev kit is built around. Also:
`MOVEMENT_FEEL_RESEARCH.md` / `MOVEMENT_OVERHAUL_PLAN.md` (design research),
`README.md` (player-facing quickstart), `godot-port/` (a parked, validated-
but-never-run Godot 4 scaffold — pick it up only if the HTML build hits a
wall).

## Test it

```bash
cd public/short-order
node harness.js                    # 3000-frame headless soak: exceptions + NaN
SCENARIO=weapon node harness.js    # weapon pickup/durability/break path
node --check game.js               # syntax (harness writes game.js as a side effect -- gitignore it, never edit it)
```

`harness.js` is a headless simulator (stubs THREE/DOM/WebAudio, drives real
game frames) — it catches crashes and bad state, not visual bugs. See its
"Ad-hoc probes" section in CLAUDE.md for how to slice it for one-off checks.

## Regenerate the Blender assets

```bash
bash tools/blender/build.sh
```

Needs Blender + numpy on PATH (`apt install blender python3-numpy` on
Debian/Ubuntu — GLB export needs numpy). Runs every `tools/blender/make_*.py`
script and bakes the resulting GLBs into `public/short-order/assets.gen.js`
as base64 data-URIs (delivered via a `<script>` tag so it works on GitHub
Pages *and* `file://`, same as the game itself). Re-run after editing any
`make_*.py`. `sky_common.py` holds shared bpy helpers for the five sky
locale scripts (`make_sky_ocean.py` etc.) — read its docstrings before adding
a new locale, especially the two export-format gotchas called out there and
in `public/short-order/CLAUDE.md`'s Skybox section (emissive strength above 1
silently clamps on load through the vendored r128 GLTFLoader; alpha-cutout
materials need `alphaTest`/`transparent`/`map` explicitly carried over in
`buildSky()`'s unlit-material swap or they silently vanish).

## Render-check scripts (`render-tools/`)

Playwright screenshot helpers used to eyeball scenes the headless harness
can't cover — day/night skies, the kitchen rearrange mode, cooking stations,
etc. Each is a standalone `.mjs` script (`node <script>.mjs`), no test runner
needed. One-time setup:

```bash
npm install playwright                 # or @playwright/test, either works
npx playwright install chromium        # only if you don't already have a Chromium binary
npm pack three@0.128.0 && tar xzf three-0.128.0.tgz   # vendor the exact three r128 build the game pins
```

Why vendor three.js instead of just hitting the CDN: headless/sandboxed
environments often block the CDN, and even when they don't, these scripts
intercept the `<script src>` requests (`ctx.route(/three\.min\.js/, ...)`)
to serve `package/build/three.min.js` and
`package/examples/js/loaders/GLTFLoader.js` locally so runs are fast and
don't depend on network access at all. Override the paths with
`THREE_UMD=/path/to/three.min.js GLTF_JS=/path/to/GLTFLoader.js` env vars if
you vendor them elsewhere; most scripts also accept `OUT_DIR=./somewhere/`
for where screenshots land.

Each script hardcodes the path to `public/short-order/index.html` via a
`file://` URL — update that if you rename/move the game directory. Quick
example:

```bash
cd render-tools
OUT_DIR=./shots node _skybox.mjs      # screenshots all 5 locales x day/night
node _plantgame.mjs                    # day-mode kitchen + plant decor sanity check
node _viewasset.mjs                    # generic single-GLB previewer, needs viewer.html (included) + three.min.js/GLTFLoader.js alongside it, set ASSET=name.glb
```

`verify-chef-look.mjs` is the one script that imports `@playwright/test`
instead of plain `playwright` — install whichever you prefer, both expose the
same `chromium` launcher.
