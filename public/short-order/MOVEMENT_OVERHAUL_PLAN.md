# Movement System Overhaul — Research Plan + Coding Plan

Scope: `public/short-order/index.html` (the `/brawl/` build). Focus: hip/leg movement and a real
**center of mass (COM)**, extending to strafing, leg crossover, and a torso that can face one way
while the legs travel another. Per the brief, this may touch rigging and **all** animations
(idle/attack/dodge/jump/carry/grab), not only the gait ones.

This is a plan, not an implementation. Tuning numbers below are **research-grounded starting points
to tailor after prototyping**, not final values — nothing here can be judged as correct until it's
on screen (this environment can't render three.js).

---

## 0. The core thesis

Today there is **no tracked center of mass**. `P.pos` is a flat ground-plane point (feet level), and
every system that should read "where the body's weight is" independently approximates it: lean from a
hand-rolled acceleration estimate, hip twist from gait phase, vertical bob from summed sines, foot
placement from `a.facing`, camera from raw `P.pos`. Nothing forces them to agree — which is why the
hip can rotate for show while the feet plant as if it hadn't, and why running/jumping/attacks each
read as independently "off."

The fix is architectural and matches how shipped engines are built: **introduce one COM and make hips,
legs, lean, foot-placement, and camera all derive from it.** Unity does exactly this — a 3D **Body
Transform** ("the mass center of the character") with the ground-plane **Root Transform** computed as
its projection, and all IK goals stored *relative to* the Body Transform. Biomechanics (the SLIP /
inverted-pendulum model) and Unreal (pelvis-rooted Full-Body IK) converge on the same structure.

---

## 1. Research foundation (grounded, with numbers)

### 1.1 COM as the upstream primitive (Unity Mecanim)
- **Body Transform vs Root Transform**: Unity keeps a full 3D mass-center transform and derives the
  ground-plane locomotion root as its Y-projection each frame; everything else (foot/hand IK goals) is
  stored relative to the Body Transform, not the root. **Port:** add `P.com` (3D, weighted ~60% hips /
  40% chest, computed *after* IK settles); keep `P.pos` as its ground projection for
  collision/foot-planting; re-point camera, hip-Y, and lean to read `P.com`.
- **`pivotPosition`/`pivotWeight`**: Unity exposes a *second* point that blends toward whichever foot
  is more planted, specifically so weight-shift logic doesn't jitter off the raw COM at the moment of
  transfer. **Port:** a `stanceWeight` (0..1, from per-leg `stepT` phase) → `supportPoint =
  lerp(leftFoot, rightFoot, stanceWeight)`; drive hip lateral offset + roll off `(supportPoint - hipRest)`.

### 1.2 The three hip motions (Six Determinants of Gait)
- **Rotation (transverse/yaw):** ±4° per side, ~8° total per step (swing side leads forward); at faster
  running rises to ~15–20° per stride. Cuts vertical COM travel ~9.5 mm.
- **Tilt/drop (frontal/roll, "hip drop"):** ~5° at midstance baseline (normal 6–11° with speed/effort;
  >11° is pathological Trendelenburg). This roll is what *lifts the swing-side hip socket* and feeds
  swing-foot ground clearance — it is not passive wobble.
- **Lateral translation:** ~2.5–5 cm side-to-side toward the stance leg per step, growing with stance
  width; falls as speed rises.

### 1.3 Pelvic rotation increases effective stride (the "hip feeds foot placement" fix)
Transverse pelvis yaw physically advances the swing-side hip socket forward *without* extra hip
flexion — direct contribution to travel distance measured at **2.4% (slow walk) → 5.1% (fast walk)**,
via ~8° rising to ~17° pelvic rotation per stride. **Port:** the yaw must be computed **upstream of the
IK target** (transform the hip-socket origin through the pelvis frame before `solveTwoBone`), not drawn
as a cosmetic overlay after the solve. This is the concrete fix for "hip rotation is decorative."

### 1.4 Walk / jog / sprint are discrete kinematic deltas, not one blend
- Stance/swing split: walk ≈60/40 with double-support; running has **no double support** — replaced by
  a **flight phase** (both feet airborne), swing share rising to ~62–70%.
- Transition trigger: stride freq ≈70.6 strides/min, or the leg-length-portable **Froude number**
  `Fr = v²/(g·legLength)`.
- Hip ROM ~47° (walk) → ~55° (run) → ~20–90° span (sprint). Knee-flex mid-swing ~100° → ~125°+.
  Thigh separation at top speed **145–160°**. Trunk lean near-upright → up to ~45° in sprint
  *acceleration*, back toward upright at sustained top speed.
- **Vertical bob is non-monotonic** ("hump"): walk 2.74 cm (slow) → 4.83 cm (fast); jog ~6–9 cm; elite
  sprint **shrinks back to ~4–6 cm** (stiffer legs, lower duty factor). **Port:** each of these is its
  own **unclamped, speed-keyed curve** (ideally Froude-normalized), replacing the single
  `(spd-2.3)/3.4` blend that saturates at ~85% of top speed. Bob amplitude follows a hump, not a ramp.

### 1.5 Torso decoupling is a *damped counter-rotation*, not a rigid lock
Pelvis and shoulder girdle counter-rotate in the transverse plane, phase difference up to ~120° at
speed; arms act as passive mass-dampers cancelling the yaw the legs impart. A literally rigid torso is
*not* biomechanical. **Port:** `torsoFacing = damp(torsoFacing, aimYaw, rate, dt)` (tracks aim/lock-on),
`hipFacing = movementYaw`; the existing **waist/spine joint carries the twist difference**, clamped to
~30–45° comfortable (Unity aim-offset practice: ±70–90° max, spread across 2–3 spine links), past which
`hipFacing` blends toward `torsoFacing` so extreme angles force a body turn instead of a corkscrew.
The rig **already computes `P.attackAim` separately from `P.facing`** — that's the seed for this.

### 1.6 Strafe = a movement-relative gait basis
Build the swing-leg cycle as a blend between a **sagittal** pattern (hip flexion/extension — current
forward gait) and a **frontal** pattern (hip abduction/adduction, feet translating sideways, pelvis
kept level and square, per defensive-slide coaching), blended by the **angle between world velocity and
torso facing**: 0° = forward gait, 90° = pure lateral shuffle, beyond = backpedal. Sample it as Unity's
**2D blend space** does — rotate world velocity into torso-local `(strafeX, forwardZ)`, inverse-distance
weight the nearest gait functions (Gradient Band Interpolation), evaluated against procedural gait
*functions* (not clips, since our rig is procedural).

### 1.7 Leg crossover is unavoidable and needs three specific rig allowances
With two legs strafing 360°, there are **always exactly two angles where the legs must cross**, no
matter how many animations — but crossing can only happen during the half of the cycle when legs pass.
The crossing hip follows a *combined frontal+transverse* path: femur starts **adducted + internally
rotated** (drawn across midline) → sweeps to **abducted + externally rotated** at plant/push-off
(measured up to ~103% MVIC glute-max). **Port — three changes, none touching bone length:**
1. Let the crossing foot's IK target **cross the pelvis local sagittal midline** (rigs implicitly keep
   each foot on its own side; relax that for the crossover state).
2. Sweep the crossing hip through adducted→abducted rather than a straight lateral slide.
3. **Rotate the two-bone IK pole vector** (`bendDir`/knee-forward hint in `solveTwoBone`) in step with
   that sweep, or the knee pops/inverts as the target crosses midline. Stagger the crossing leg's
   fore/aft depth slightly when adjacent to avoid interpenetration (real carioca threads at different
   depths). Treat this as a **discrete step**, not a continuous target sliding across midline.

### 1.8 Unreal's production answer (orientation + stride warping) — corroboration
- **Orientation warping**: warps the leg IK bones to align with travel direction *while twisting the
  spine to keep the facing angle* — engine-level confirmation of the §1.5 + §1.6 split.
- **Stride warping**: scales foot spacing to match capsule speed; **industry cap ~15–20%** warp before
  visible quality loss — a useful ceiling for how far we procedurally stretch stride before switching
  gait tier instead.

---

## 2. Research plan — what still needs doing

The literature is now well-covered (25+ sources across biomechanics, Unity, Unreal, Godot, SLIP/COM,
strafe/crossover). What remains is **prototype-and-eye validation**, which is where the real tailoring
happens — none of it can be settled from sources:

1. **Prototype the COM point in isolation** and visualize it (debug sphere) to confirm the hips/chest
   weighting reads as "body weight" before anything consumes it.
2. **Prototype the crossover pole-vector rotation** — the single highest-risk piece (knee inversion is
   the classic failure). Validate the knee never pops across the full midline sweep at several strafe
   angles before wiring it into the gait blend.
3. **Tune the speed-keyed curves by eye** — the hump-shaped bob, hip-roll amplitude, thigh separation,
   trunk lean. Sources give ranges; the game's speed scale (base run `spd=6.7`) needs its own mapping.
4. **Decide the gait-function set** — how many named procedural gaits (fwd walk/run/sprint, back,
   strafe-shuffle, crossover) the 2D blend samples, and their crossover-threshold.
5. **Confirm the timestep/interpolation fix** (see §3 Stage 0) actually removes the frame-hitch jank,
   independent of the COM work — this is a prerequisite, not part of the COM overhaul.
6. **Screenshot-diff harness**: stand the chef at fixed speeds/strafe-angles and capture frames
   (Playwright) each stage, so regressions in the rig are visible between commits.
7. **Open question to resolve during prototyping:** whether to add a real 2-link spine (chest joint)
   now (Unity FABRIK-spine analog, better lean/twist distribution) or defer it — affects rigging scope.

---

## 3. Coding plan (staged, COM-first, each stage independently testable)

Ordered so each stage de-risks the next and can ship/verify alone. Every stage lists **where**, a
**test**, and **tailoring knobs** left open for post-prototype tuning.

### Stage 0 — Prerequisites & safety (do first, independent of COM)
- **Timestep/interpolation**: the loop (`tick`, ~3527–3530) feeds a raw variable `dt` straight into
  physics+pose with no render interpolation; the jump arc (`P.vy -= g*dt`) and camera lerp
  (`CAM.pos.lerp(want, min(1, dt*(7+3k)))`, ~3634) both hitch/snap on a frame spike. Port the
  fixed-step + interpolation pattern this repo already has in `culinary-dash-3d/src/engine/loop.js`,
  and change the camera lerp to the exponential `damp()` already defined at line 257.
- **Invariant harness**: extend `harness.js` with assertions for the new work — IK finiteness across
  strafe/crossover targets, bones never exceeding locked length, `torsoFacing−hipFacing` within clamp,
  COM finite. Mutation-test each (reintroduce the bug, confirm it's caught) per house style.
- *Test:* soak + weapon scenarios still `PASS`; jump/camera visibly smooth under an induced frame stall.

### Stage 1 — The COM primitive
- Add `P.com` (3D), computed each frame **after** IK settles as `lerp(hipsWorld, chestWorld, ~0.4)`.
  Keep `P.pos` as its ground-plane projection; `toGround`/`collide`/feet-planting keep using `P.pos`.
- *Where:* new update near end of `updatePlayer`/`poseChef`; add debug-sphere render.
- *Test:* determinism unaffected (COM is a pure function of settled bone positions); debug sphere sits
  believably inside the pelvis/torso at rest, walk, and mid-attack.
- *Knobs:* hips/chest weight ratio.

### Stage 2 — Pelvis frame feeds the IK (fixes "hip is decorative")
- Build a pelvis frame with three phase-locked oscillators — `yaw(phase,speed)`, `roll(stance,speed)`,
  `lateral(phase,speed)` — plus bob. Compute each leg's **hip-socket world origin by transforming a
  fixed local offset through this frame BEFORE `solveTwoBone`** (`solveLegsIK`, ~2658–2677).
- Route hip roll's vertical delta as an **additive offset on the swing foot's world IK target**
  (`updateFeet`, ~2599–2657), so roll actually feeds foot clearance.
- Replace `u.hips.rotation.y = damp(…, -AN.twist*0.35, …)` (~2577, decorative) with a value derived
  from `supportPoint`/COM lateral offset.
- *Test:* pelvic yaw measurably lengthens stride reach; hip-drop lifts the swing foot; determinism holds.
- *Knobs:* yaw ±4°→±17° speed curve; roll 5°→11°; lateral 2.5–5 cm.

### Stage 3 — Speed-keyed gait curves + flight pose (fixes jog vs sprint)
- Replace the single `_runK = clamp((spd-2.3)/3.4)` (~2468) and its downstream caps with **independent,
  unclamped, Froude-normalized curves**: swing-phase fraction, hip ROM, knee-flex max, thigh
  separation, trunk lean, and **hump-shaped bob amplitude**.
- Add a genuine **flight sub-pose** (both feet airborne) gated on crossing the walk→run duty-factor
  threshold.
- *Where:* `poseChef` blend section, `updateFeet` stride/cadence, `solveArmsIK` swing amplitude.
- *Test:* visible difference between jog and sprint (stride, lean, arm pump, reduced bounce); no
  saturation approaching top speed; grab-rush/tackle speeds get distinct gait.
- *Knobs:* every curve's shape — this is the biggest eye-tuning surface.

### Stage 4 — Torso/hip decouple (torso faces straight while legs travel)
- Introduce `torsoFacing` independent of `P.facing`; drive it via `damp`/`angLerp` from lock-on/attack
  aim/strafe input (reuse `P.attackAim`). Feet/`toGround`/`hips.rotation.y` keep using `P.facing`
  (=hip/movement); `spine`/`upper` `.rotation.y` driven by `angDiff(torsoFacing, P.facing)`, **split
  across spine (+ optional new chest joint)**, clamped ~30–45°, past which `P.facing` catches up.
  Never let this twist touch hip position/rotation (Unity's "aim offset must not move the pelvis" rule).
- *Test:* legs run north while torso holds aim east, within clamp; beyond clamp the body turns naturally.
- *Knobs:* clamp angle, catch-up rate, per-link twist split.

### Stage 5 — 2D movement-relative gait basis (strafe)
- Rotate world velocity into torso-local `(strafeX, forwardZ)`. Define procedural gait functions
  (fwd walk/run/sprint, back, strafe-shuffle) and blend the 2–3 nearest by inverse distance
  (Gradient Band Interpolation). Sagittal↔frontal leg-pattern blend by velocity-vs-facing angle;
  frontal keeps pelvis level/square.
- *Where:* replaces the 1D blend input in `poseChef`; `updateFeet` stance targets in torso-local space.
- *Test:* clean strafe left/right/diagonal/backpedal, each with its own gait, no foot-slide.
- *Knobs:* gait-function set, blend weights, shuffle vs stride thresholds.

### Stage 6 — Crossover (highest risk — prototype first per §2.2)
- On a crossover state (high `|strafeX/forwardZ|` or sharp direction change), allow the swing foot IK
  target to **cross the pelvis local midline**; sweep the crossing hip adducted→abducted; **rotate the
  `bendDir` pole vector** in `solveTwoBone` off that same angle; raise `lift` for stance-leg clearance;
  stagger fore/aft depth when adjacent. Discrete step, not a sliding target. Bones stay length-locked.
- *Test:* knee never inverts across the full midline sweep at multiple angles; no mesh interpenetration.
- *Knobs:* crossover threshold, pole-vector rotation curve, depth stagger.

### Stage 7 — Camera + propagate COM to all animations
- Camera trails `P.com` XZ (damped) with `P.com.y` as a separate damped channel (so a hop/duck's bob
  doesn't couple into lateral smoothing); replaces raw `P.pos` trailing (~3634 region).
- Reframe `leanX`/`leanZ` (`poseChef`) as **COM drift from the support polygon** (`P.com.xz -
  supportPoint`), formalizing the existing `leanAf`/`leanAl` acceleration guess.
- Route idle/attack/dodge/jump/carry/grab lean/bob (`leanX/leanZ/bob/waist`) through `P.com` +
  `torsoFacing` so weight-shift reads correctly in every state, not just gait.
- *Test:* camera no longer disagrees with the rig at high speed; carry/grab show hip weight-shift.

### Rigging changes summarized
- Add `P.com` (3D) + `supportPoint` (stance-weighted). Add the pelvis frame (yaw/roll/lateral/bob) as a
  real transform the hip sockets pass through. Add `torsoFacing`. **Optional but recommended:** a second
  spine link (chest joint) between `spine` and `upper` so lean/twist distributes across two hinges
  (Unity FABRIK-spine analog) instead of one. Relax the per-leg "own side of midline" assumption in the
  IK target logic. **The chef's protected visual identity (hair/body/proportions) is untouched — only
  movement/rig-motion changes.**

---

## 4. Invariant & determinism guardrails (must hold throughout)
- **Length-locked bones** (`orientFixed`): only hip-socket origins and foot targets ever move; never
  clamp the IK target or scale a bone to "fix" reach. Crossover/strafe obey this.
- **One `weight`/`heft`** drives all hit feedback: a hard cut/juke's weight-transfer should route
  through the *same* coupled value (shake/hitstop/rumble), not a parallel one.
- **One damage door** (`resolveHit`) unchanged by movement work.
- **Two time bases**: gait/COM use sim time; camera/FX use real `dt`.
- **Determinism / lockstep-ready**: every gait/COM/torso curve is a **pure function of (speed, phase,
  legLength, velocity-vs-facing angle)** — no `Math.random`, no wall-clock, no per-frame hidden state
  that isn't reproducible from `(state, dt)`. Keep using `damp()`/`angLerp` (already `1-exp(-l·dt)`,
  fixed-step-safe). This satisfies the future culinary-dash-3d port for free.

---

## 5. Sources (25+; salvaged research agents + targeted searches + prior `MOVEMENT_FEEL_RESEARCH.md`)

**Biomechanics:** Six Determinants of Gait (whatispodiatry.com); COM displacement vs walking speed
(PubMed 15685471); biomechanical parameters across speeds (PMC9687194); maximal-speed sprint kinematics
(PMC7739839); sprint coaching eye (Sportsmith); lateral shuffle vs side-step cut (ScienceDirect
S096663621500987X); foot progression angle in cutting (PMC8766617); walk→run transition / Froude
(Nature s41598-017-01972-1); pelvic rotation → stride length, Whitcome (Wiley ar.23551); pelvic
kinematics with speed/incline/fatigue (Frontiers fspor.2025.1721641); arm swing & pelvis-shoulder
counter-rotation (J. Exp. Biol.); rotational hip / crossover step (TeamBuildr); vertical oscillation
targets (RunnersConnect); pelvis structure & function in gait (PMC5545133).

**Engines:** Unity Root Motion / Body Transform (docs.unity3d.com); Animator.bodyPosition &
pivotPosition (Unity Discussions); Animation Rigging TwoBoneIK / MultiAim / MultiPosition / ChainIK
(needle-mirror docs); pelvis vertical adjustment off during locomotion (Unity Discussions); 2D Blend
Trees (Unity docs); Avatar Mask (Unity docs); UE5 Pose Warping — orientation & stride warping (Epic
Dev Community + tutorials); Lyra animation (Unreal tech blog); Godot 4.6 IK stack (godotengine.org);
strafe leg-crossing inevitability (Soxware/Kubold, Unity Discussions); TPS strafing decouple (Overdare).

**Prior:** `MOVEMENT_FEEL_RESEARCH.md` (SLIP/inverted-pendulum, Unreal/Godot/Unity hips-as-anchor
convergence, the seven original jank findings).

---

## 6. Implementation status (what actually landed)

Built stage-by-stage on `claude/movement-feel-research-vttyjo`, one commit each, every commit
harness-green (`node harness.js` soak + `SCENARIO=weapon` + `node --check`). **Mechanically verified
only** — the harness catches exceptions / NaN / non-finite IK; it stubs world transforms, so it does
NOT validate geometry, and nothing here validates *feel*. All feel/tuning needs eyes on `/brawl/`.

| Stage | Status | Notes |
|---|---|---|
| 0 — loop/camera | **Partial** | Camera smoothing → exponential form; harness gained a player-IK assertion. The full fixed-step + render-interpolation loop refactor is **deferred** (input double-processing hazard across sub-steps; changes combat timing; unverifiable here). |
| 1 — COM primitive | **Done** | `updateCOM()` → `P.com` (≈60% hips / 40% chest), sampled after the pose settles. |
| 2 — pelvis feeds IK | **Done** | Pelvis frame (yaw + roll) drives the leg hip-sockets in `solveLegsIK`; hip rotation is no longer decorative. |
| 3 — sprint tier | **Done** | `_sprintK` adds longer stride / higher knee / more lean / wider arm pump / less bounce in the top band; additive, walk/jog unchanged. |
| 4 — torso decouple | **Re-scoped → folded** | First tried "legs follow travel, torso twists" (model B) — reverted, because it can't produce crossover. Under the chosen **model A** (lock-on strafe) facing holds the aim and the feet strafe, so no torso-vs-hip twist is needed. |
| 5 — strafe gait | **Done (model A)** | Locked-on lateral travel blends the stance sagittal→frontal (squared side-shuffle). Free-roam unchanged. |
| 6 — crossover | **Done** | Knee pole tilts toward the foot's lateral offset so a midline-crossing foot doesn't invert the knee. Continuous, ~0 for normal stance. |
| 7 — camera trails COM | **Done (minimal)** | Camera trails `P.com`'s ground position. Propagating COM/lean through the non-gait animations, and reframing lean as COM-drift-from-support, are **deferred** (feel-sensitive, unverifiable here). |

**Tuning dials** (constants near the top of the CHEFS/POSE code, tune by running `/brawl/`):
`PELVIS_YAW_WALK`, `PELVIS_YAW_RUN` (negate to flip which hip leads), `PELVIS_ROLL`, `SPRINT_LO`,
`SPRINT_HI`, `STANCE_FRONTAL`, plus the inline sprint-emphasis factors and the crossover pole tilt
(`*1.8`) in `solveLegsIK`.

**Known unverified-by-eye risks:** pelvis-yaw phase/sign (Stage 2), whether the sprint emphasis reads
right (Stage 3), the frontal-stance shape and how hard it blends in (Stage 5), and knee behaviour at
extreme crossover angles (Stage 6). All are single-constant adjustments.
