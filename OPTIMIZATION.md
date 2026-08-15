# Optimization notes — parked

Not acting on any of this yet. Captured so it's here when there's an audience to
optimize *for*. Full write-up (styled): the "Short Order Perf Playbook" artifact.

**TL;DR — the game's actual bottleneck (startup freeze) is fixed. Everything below
is byte/frame polish that only starts to matter once real players on real networks
show up. Don't spend game-dev time on it prematurely.**

## Measured state (as of the clips.bin bake)

- **Real cold load ≈ 8.8 MB** (not 15 — a 6.4 MB `game_scene.glb` is never fetched).
  Dominated by `clips.bin` 3.2 MB, `X_Bot.fbx` 1.7 MB, `assets.gen.js` 1.5 MB,
  `vendor/` 848 KB, `index.html` 571 KB, three rigged GLBs 1.1 MB.
- **Runtime is already well-managed:** adaptive-quality governor drops
  bloom → post → shadows → resolution under 26 FPS; DPR capped; bloom half-res;
  clips baked to a single 3.1 MB pack (was 38 MB of FBX).
- **No service worker** → GH Pages `max-age=600` means the whole payload
  re-downloads every visit.

## If/when we do optimize — honest order (post red-team)

1. **Measurement harness first** (cheap, all upside): a `time-to-playable` mark,
   long-task observer, `renderer.info` logging, Lighthouse-mobile/TBT,
   WebPageTest repeat-view. Tells us whether anything else is worth doing.
2. **Small renderer tweaks** (with corrected expectations, see caveats):
   `antialias:false` (composer bypasses it), DPR ceiling 1.5 (battery/thermal
   trade, governor already covers FPS).
3. **Trim dead animation clips** — 10 of 65 in `clips.bin` are never played
   (see below). Drop from `MIXAMO_SRC` + rebake, or wire some back on purpose.
4. **Later, only with players on slow networks:** service worker (Workbox,
   cache-first on *immutable* assets), meshopt the GLBs (all geometry, ~no
   textures — texture compression is moot), bake/strip `X_Bot.fbx`.

## Red-team caveats — things that sounded good but AREN'T (yet)

- **Service worker is NOT a free win right now.** Cache-first fights the
  push-to-main → reload → playtest loop: you'd rebake/push and reload to a
  *stale* cached asset and think the change failed. Right for shipped players,
  harmful during active iteration. Defer it, and never cache the HTML cache-first.
- **Do NOT bulk-delete the "unreferenced" GLBs** (`game_scene.glb`,
  `chef.glb`, `chef_only.glb`). They're the newest files, named like staged
  WIP. Unreferenced ≠ safe to delete — confirm intent first. (They cost nothing
  at runtime; the browser never fetches them.)
- **Externalizing `assets.gen.js` for "bytes" is a byte *regression*.** It ships
  ~0.28 MB gzipped today (JS is gzipped on the wire; base64-of-GLB gzips well).
  A raw/external `.bin` ships ~1.13 MB (Pages won't gzip binary), and even
  self-zipped lands above 0.28 MB. The only real win is removing a small sync
  parse — not worth it.
- **`renderer.compile()` warm-up won't kill first-spawn hitches.** Character/
  weapon materials are created per-spawn (cloned + tinted), so a load-time
  compile can't warm them. Real fix = pre-spawn hidden instances of each variant
  (more work, more risk).
- **Baking `X_Bot.fbx` is high-risk for 1.7 MB.** It's the runtime retarget
  source (`_rigBake` reads its exact world bind pose lazily, per clip) AND the
  bone-cosmetic fallback template. Get the bind pose wrong → all character
  animation breaks. Safer path: re-export the FBX with the unused skinned mesh
  stripped (same format, same bind pose) rather than bake to JSON.

## GitHub Pages constraints (don't fight these)

- `max-age=600`, no custom headers → a service worker is the only durable cache.
- gzip only on text content-types → binary (`.glb`/`.bin`) ships raw; compress
  *inside* the file (that's why `clips.bin` is self-zlib'd).
- No brotli; shipping `.gz`/`.br` files does nothing.
- HTTP/2 (Fastly) → splitting into many parallel requests is basically free.
- Three.js r128 (2021): no `BatchedMesh`, no async shader compile, no multisample
  targets — batching/WebGPU would be an engine-upgrade project.

## Unwired animation clips (10/65 — loaded but never played)

State machine (`actionName`) never selects these; they still bake into `clips.bin`:

| Clip | Source FBX | Why dead |
|------|-----------|----------|
| `atk_light`  | `atk_light` | orphaned when armed melee → `atk_sword` |
| `atk_heavy`  | `atk_heavy` | never wired |
| `atk_bat`    | `mo_baseball_strike` | orphaned when armed melee → `atk_sword` (was blunt weapons) |
| `atk_shield` / `atk_shield_L` | `mo_sword_and_shield_attack` (+`-2`) | never wired (pot lid uses generic swing) |
| `gun_reload` | `mo_reloading` | no reload mechanic |
| `throw_obj`  | `mo_throw_object` | throw system only plays `throw` |
| `toss`       | `toss` | throw system only plays `throw` |
| `toss_gren`  | `mo_toss_grenade` | throw system only plays `throw` |
| `death_walk` | `mo_walking_to_dying` | death only plays `death` |

Also note: `CLIP_FILES` (top of the rig block) is dead code — defined, never read.

---
_Reference: Short Order Perf Playbook artifact (delivery · runtime · caching,
grounded in measured build numbers)._
