# SHORT ORDER — project notes

Single-file Three.js (r128) game in `index.html` (~9.7k lines): a chef brawler +
cooking-sim with a synthwave look. Mobile-first, deployed to GitHub Pages off
`main`. Most logic, meshes, and the inline `<script>` all live in `index.html`.

## Visual style — deep jewel-tone hues (house palette)

The look is dark, moody, synthwave neon. **Surfaces read as DEEP, SATURATED jewel
tones — never pale or pastel.** This is a standing style preference: when you add
or recolor anything the player sees (clothing, props, crowds, furniture, UI
accents), reach for rich, deep hues in this family, not washed-out ones.

The hues to draw from (deep jewel tones — the endorsed set):

    magenta 0xb3106f   teal   0x0f8f9c   blue   0x203fc4   purple 0x6d18cf
    green   0x0fa055   crimson0xc21e50   amber  0xc47410   orange 0xc23a0e
    rose    0xa81436   aqua   0x158f84   violet 0x6a25cf   gold   0xc28f10

Live examples in code: `CROWD_SHIRTS` (instanced bar crowd) and the booth-seated
`OUT` palette in `spawnPartyGroup`. Deepen new palettes to match these, not the
old bright-pastel set they replaced.

### Two colour roles — keep them separate

- **Surface colour** (bodies, clothing, props, furniture): deep jewel tones,
  and keep them **below the bloom threshold** so they stay rich. If a surface
  must self-light in a dark room, drive its colour from **emissive on a
  near-black base** (see the bar crowd's `bodyMat`: `color:0x06060a` +
  `totalEmissiveRadiance += vColor` via `onBeforeCompile`). A white/light base
  lit by ambient AND an additive emissive gets pushed through tone-mapping and
  bloom and washes out to pastel — that's the failure mode to avoid.
- **Neon accents** (grid floor, sign/rim glow, booth underglow, light strips):
  these are meant to be bright and to bloom. The bright `NEON` palette in
  `buildBarRoom` and `emat()` are for these, not for surfaces.

Rule of thumb: if it's a *thing*, colour it deep; if it's a *light*, let it glow.
When in doubt, err toward deeper and more saturated.

## Rendering gotchas already learned here

- **Forward-light budget matters on mobile.** Setting `light.visible=false`
  drops a light from the shader's light list; `intensity=0` does not. The bar
  keeps its forward-light count low this way and carries glow with
  emissive + bloom instead.
- **Bloom + tone-mapping desaturate bright additive colour toward white.** Keep
  surface colours under `BLOOM.threshold`; reserve blooming for actual neon.
- Instanced crowds (`InstancedMesh`, per-instance `setColorAt`) keep big crowds
  at ~2 draw calls — no skeletons/mixers, transform-only idle animation.

## Testing

Headless Playwright against `python3 -m http.server 8171` (Chromium at
`/opt/pw-browsers/chromium`, `--no-sandbox`). Headless is software-WebGL (~0.2×
realtime, no GPU) so absolute FPS is a worst case and time-based transitions need
generous waits; relative counts (draw calls, instance counts, on-screen
projection) are reliable. `CAMOVERRIDE={px,py,pz,tx,ty,tz}` parks the camera for
repeatable screenshots. Syntax-check by extracting the inline `<script>` and
running `node --check`.
