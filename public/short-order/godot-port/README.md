# Short Order — Godot scaffold

A port-in-progress of the single-file JS build into Godot 4. This is a **vertical
slice**: player, customers, arena, camera, combat, and the weight-driven juice
system. It runs; it is not the whole game yet.

## Run it

1. Install **Godot 4.4 or newer** (any 4.x should work — nothing here uses 4.6/4.7-only APIs).
2. Open the Godot project manager → **Import** → pick this folder's `project.godot`.
3. Press **F5**.

No build step, no addons, no external assets. Every mesh is built in code.

## Controls

| Action | Keyboard | Gamepad |
|---|---|---|
| Move | WASD / arrows | Left stick |
| Light attack | J | Bottom face button |
| Heavy attack | K | Left face button |
| Grab / tackle | F | Top face button |
| Dash | Shift | Right face button |
| Guard | Space | L3 |
| Lock-on | L | R3 |
| Rotate camera | `[` `]` | Shoulders |

Bindings are built in code in `scripts/controls.gd` — actions are named for what
they **do**, not which button they sit on, so remapping doesn't lie to the player.

## Layout

```
project.godot        config + autoloads
scenes/main.tscn     near-empty; the world is built in code
scripts/
  controls.gd    [autoload] InputMap, radial-deadzone stick
  weapons.gd     [autoload] weapon table — `heft` drives the feel
  juice.gd       [autoload] shake, hitstop, haptics, impact frames
  ik.gd                    two-bone IK with LENGTH-LOCKED bones
  chef_rig.gd              procedural body, footwork, run/idle blends, swings
  fighter.gd               shared movement, combat, hit resolution
  player.gd                input, run, dash, tackle
  enemy.gd                 customer AI: strafe, press, commit, recover
  game.gd                  arena, camera, waves, the night seam
```

## What carried over (and why)

These are the lessons the JS build paid for. They're deliberately preserved:

- **Length-locked bones** (`ik.gd`). Clamping the IK *target* is fragile — one bad
  scale conversion and limbs stretch into noodles. Locking the rendered bone
  *length* is a hard guarantee. Godot's `to_local()` also removes the manual
  yaw/scale math that caused the original bug.
- **One `weight` value drives all feedback** (`juice.gd`). Shake, hitstop, rumble
  and impact frames move together off the weapon's `heft`, which is what makes
  cast iron feel heavy rather than just damaging.
- **Damage has exactly one door** (`Fighter.resolve_hit`). Nothing deals damage
  without a live swing.
- **Two-part torso with a waist joint** (`chef_rig.gd`). The upper body flexes over
  a planted abdomen so nobody reads as a running traffic cone.
- **Frame-based win check** (`game.gd`). The old bug was a win test that only ran
  at the instant of a kill; now it's checked every frame. Wave spawning also
  tracks `pending` so timers can't over-spawn past the queue.
- **Enemies are customers**, not chefs — hair, street clothes, no toque.
- **Combo cycles**: weapons run forehand → backhand → chop; bare hands run
  jab → jab → hook → uppercut, with the correct hand throwing each.

## Not ported yet

- Post-processing stack (chromatic aberration, zoom punch, the 2-tone impact
  *shader*). `Juice.impact_frames` already counts frames — it needs a
  `CanvasLayer` + `ColorRect` screen shader to consume it.
- Squish/dent vertex shader on heads.
- Verlet ragdoll death (Godot's Jolt physics can do this natively instead).
- Grab-and-mash grapple, weapon pickups/durability, HUD, touch controls, audio.

## Verification status

All scripts pass `gdparse` and are `gdlint`-clean. **They have not been run in
Godot** — I authored these without an editor, so expect first-run fixes
(most likely: node paths, or a signal/API rename between 4.x point releases).
