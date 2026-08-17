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

### Glow and bloom are welcome — the enemy is WHITE, not glow

Emissive glow, bloom, and **coloured lights are all encouraged** — they're core to
the look. The one thing to avoid is **straight-up white / washed-out light**.
Everything should read **deeper and more saturated than white**, glowing things
included. A neon rim, a light strip, a coloured spot, a self-lit crowd — great,
as long as the hue stays rich instead of blowing out to a pale/white core.

- **Coloured lights: use them.** A magenta wash, a cyan spill, a warm amber
  pool — far better than a neutral white light. Tint your lights.
- **Keep the colour in the bright bits.** The failure mode is a surface/glow
  clipping to white: all three channels racing to 1.0 under ambient + additive
  emissive + bloom + tone-mapping, so the hue disappears. Guard against it —
  bias toward a saturated hue and don't let every channel max out.
- **One reliable technique** for a surface that must self-light in the dark and
  stay saturated: drive its colour from **emissive on a near-black base** (see
  the bar crowd's `bodyMat`: `color:0x06060a` + `totalEmissiveRadiance += vColor`
  via `onBeforeCompile`). That keeps a light base from washing the hue out. It's a
  tool, not a rule — glowing/blooming a deep colour on purpose is fine.
- The `NEON` palette in `buildBarRoom` and `emat()` are the go-to bright accents
  (grid, rims, underglow, strips); the deep jewel set above is for surfaces. Both
  may glow — just keep both coloured.

When in doubt: deeper and more saturated, never whiter.

## Rendering gotchas already learned here

- **Forward-light budget matters on mobile.** Setting `light.visible=false`
  drops a light from the shader's light list; `intensity=0` does not. The bar
  keeps its forward-light count low this way and carries glow with
  emissive + bloom instead.
- **Bloom + tone-mapping desaturate bright additive colour toward white** once
  every channel maxes out. Not a reason to avoid glow — a reason to keep the hue
  saturated as it brightens (bias the colour, don't let all channels hit 1) so
  the glow stays coloured instead of going white.
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
