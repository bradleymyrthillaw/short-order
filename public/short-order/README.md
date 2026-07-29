# Short Order

A single-file 3D kitchen beat-em-up. You're a chef; after hours, the patrons come
back and want a word.

## Play

Open `index.html` in a browser. No build step, no install.

**Controls** — gamepad, keyboard, or touch:

| Action | Keyboard | Gamepad |
|---|---|---|
| Move | WASD | Left stick |
| Light attack | J | Bottom face button |
| Heavy attack | K | Left face button |
| Grab / tackle | F | Top face button |
| Dash | Shift | Right face button |
| Guard | Space | L2 |
| Lock-on | L | R3 |
| Rotate camera | `[` `]` | L1 / R1 |

Grab a utensil off the floor and everything changes — a spatula taps, a cast iron
pan hits like a truck. Weapons break. So do you.

## Develop

`index.html` is the whole game. See **`CLAUDE.md`** for architecture, the
headless test workflow, and the list of invariants worth not breaking.

```bash
node harness.js                    # 3000-frame soak
SCENARIO=weapon node harness.js    # weapon lifecycle
```

## Contents

```
index.html      the game
harness.js      headless test harness
CLAUDE.md       developer handoff — read this first
godot-port/     parked Godot 4 scaffold (validated, never run)
```
