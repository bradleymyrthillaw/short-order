# Movement feel research — why running/jumping/attacks read as janky

Working notes from a research pass on `index.html`'s player movement, camera, combat timing, and
gait animation, prompted by: "the running felt janky, the jump felt janky, the attacks are getting
there but still janky." No code changes yet — this is diagnosis only.

## Which build this is about

Jump only exists in Short Order (`public/short-order/index.html`, served at `/brawl/`) — no other
build in this repo (`/3d/`, `/vince/`, `/kitchen/`) has a vertical jump, only a dash. An earlier
patch to `culinary-dash-3d/src/sim/movement.js` (adding accel/decel easing) does **not** reach this
file — it's a separate, unrelated movement system. This research is scoped entirely to
`public/short-order/index.html`.

## Confirmed findings, roughly in order of how directly they explain the symptom

### 1. No render interpolation over a variable timestep
`tick()` (`index.html:3527-3530`):
```js
let dt = Math.min(0.05, now-last);
```
Whatever `dt` a frame actually took (however uneven) is fed straight into physics/pose and drawn
immediately — no fixed-step-plus-interpolation layer, unlike `culinary-dash-3d/src/engine/loop.js`
in this same repo, which already does this correctly. Most visible on the jump arc (`P.vy -= g*dt;
P.pos.y += P.vy*dt`, plain per-frame Euler with nothing smoothing over an uneven frame) and during
attacks, which stack the heaviest per-frame VFX cost (chromatic aberration, hitstop, impact frames,
shake) — exactly the moments most likely to spike real frame time.

### 2. Zero input buffering on attacks
```js
const canStart = !P.attack;
if(canStart){ ... startAttack(...) ... }
```
(`index.html:2143`) A light/heavy press while `P.attack` is active is dropped, not queued — by
explicit design ("UNCANCELLABLE: a swing is a full commitment"). Combined with `if(P.attack)
spd*=0.14` (near-total rooting mid-swing), mashing near the end of recovery does nothing until the
exact frame it clears. This is the textbook input-buffering gap: a press slightly early should
still register on the correct frame; here it just vanishes.

### 3. Camera position can hard-snap on a frame-time spike
```js
CAM.pos.lerp(want, Math.min(1, dt*(7+3*k)));
```
(`index.html:3634`) — the common but imprecise shorthand for exponential smoothing. At a large
enough `dt` (a real hitch), `dt*(7+3k) >= 1` and the camera **snaps instantly** to target instead of
easing, rather than using the correct `1-exp(-l*dt)` (`damp()`) already used everywhere else in this
file. Hit frames are the likeliest moment for both a frame-time spike and this snap to coincide.

### 4. The run/sprint pose blend saturates well under top speed
```js
const rk = clamp((spd-2.3)/3.4, 0, 1);   // hits 1.0 at spd=5.7
a._runK = rk*rk*(3-2*rk);
```
Base run speed is `spd=6.7`, so `_runK` — and everything downstream of it (`stepLen` caps at
`spd≈5.9`, arm-swing radius caps at `spd=5`, swing *angle* is a flat constant) — maxes out at ~85%
of top speed and never increases further, including through faster movement like grab-rush (7.2),
tackle (13), or dodge (15). One "run" gait shape gets reused for jogging-pace and sprinting alike;
nothing lengthens stride, deepens lean, or speeds the arm pump beyond that early cap.

### 5. Missing hip *roll* (frontal-plane weight-transfer drop)
Classic animation/biomechanics gait has three hip motions: rotation (yaw), tilt/roll (drop on the
swing side, rise on the stance side as weight transfers), and rise-and-fall (vertical). Grepped
every `u.hips` read/write in the file:
- Rotation: **present** (`u.hips.rotation.y = damp(..., -AN.twist*0.35, 12, dt)`)
- Roll/drop: **absent** — zero writes to `u.hips.rotation.x/z` anywhere
- Rise/fall: **partial** — exists only as a whole-body `bob`/`_stepDip`, not isolated to the hip joint

The motion that most directly reads as "weight transferring between legs" is simply not modeled at
the hip.

### 6. Hip rotation and foot placement are fully decoupled
`updateFeet`'s foot target:
```js
function toGround(a,lx,lz,out){ const c=Math.cos(a.facing), s=Math.sin(a.facing); ... }
toGround(a, st.x, st.z, _ideal);              // st = fixed STANCE[i] constant
if(spd>0.3){ _ideal.x += vx/vm*lead; _ideal.z += vz/vm*lead; }
```
Only reads `a.facing` (root yaw) — never `u.hips.rotation.y`. Biomechanically, pelvic rotation is
part of what extends stride (the hip socket swings forward with the pelvis, giving the leg reach it
didn't have to generate on its own — Whitcome et al. 2017 and others). Here, the hip visibly
rotates but that rotation has zero effect on where the foot IK actually reaches for. The velocity-led
`lead` term is the right idea (matches the inverted-pendulum/COM-predicted foot-placement model used
in animation and robotics locomotion controllers) — but it's missing the rotational contribution
entirely, so the hip's rotation is pure decoration.

### 7. Root cause underneath all of the above: no center of mass
Grepped for `centerOfMass`/`COM`/`comX` etc. — "COM" appears three times, only in comments about the
attack lunge, never as an actual tracked value. `P.pos` is a flat ground-plane point (feet-level).
Every system that should derive from a real center of mass instead independently approximates it:

| System | What it actually reads |
|---|---|
| Body lean (`b.rotation.x/z`) | a hand-rolled `af`/`al` acceleration estimate |
| Hip twist (`u.hips.rotation.y`) | gait phase (`AN.twist`), not anything physical |
| Vertical bob | a sum of sine terms + step-timed dip |
| Foot placement (`_ideal`) | `a.facing` + velocity lead — never the hip rotation above |
| Camera (`CAM.pos`) | `P.pos` directly — no body-weight concept |

No single mass point ties these together, so nothing forces them to agree with each other — which is
why the hip can rotate one way while the feet plant as if it hadn't, and why running/jumping/attacks
each have their own independent-but-related "off" quality rather than one obviously broken system.

## Sources (gait biomechanics / animation research)
- [Physio-pedia — Running Biomechanics](https://www.physio-pedia.com/Running_Biomechanics)
- [MoCap Online — Locomotion Animations: Walk, Run, Blend Trees](https://mocaponline.com/blogs/mocap-news/locomotion-animations-game-dev)
- [Frontiers — Kinematics of Maximal Speed Sprinting](https://www.frontiersin.org/articles/10.3389/fspor.2019.00037)
- [PMC — Kinematics of Maximal Speed Sprinting](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7739839/)
- [PMC — Biomechanical Parameters at Different Running Speeds](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9687194/)
- [Whitcome et al. 2017 — Pelvic Rotation Effect on Human Stride Length](https://anatomypubs.onlinelibrary.wiley.com/doi/10.1002/ar.23551)
- Classic animation "three hip movements" (rotation / tilt / rise-and-fall) — convergent across
  animator-education sources
- Inverted-pendulum / COM-driven foot placement — standard model across biped-controller and game
  locomotion research (SIGGRAPH "Generalized Biped Walking Control," "One Step at a Time: Animating
  Virtual Characters Based on Foot Placement")

## Further research: what a real fix looks like

### The formal precedent: SLIP (Spring-Loaded Inverted Pendulum)
The standard low-order model for running gait in both biomechanics and robotics/game-locomotion
research is SLIP: a **point-mass center of mass** plus a **massless spring leg** modeling ground
compliance during stance. It's the model literally built to capture "where the body's weight is and
how it bounces off the stance leg" — the exact concept missing from `index.html`. The bipedal
extension (double-SLIP/DSLIP) handles alternating legs. This isn't a suggestion to implement a full
physical SLIP simulation (overkill for a beat-'em-up) — it's confirmation that "track one mass point
and derive everything else from it" isn't a stylistic choice, it's how every serious model of running
gait is structured, game or biological.

### How a lightweight version would actually wire in here
The file already has the right *primitive* for this — `damp()`, frame-rate-correct exponential
smoothing — just not a mass point for it to smooth toward. A minimal version, not a rewrite:
- Track one `com` (or reuse a lagging copy of `P.pos`) that trails the actual root position with
  its own `damp()`, representing "where the body's weight actually is" vs. where the feet/input have
  already moved to.
- Derive lean (`b.rotation.x/z`) from `P.pos - com` instead of the current hand-rolled `af`/`al`
  acceleration estimate — same idea, one real source instead of a parallel approximation.
- Derive hip roll from *which foot is in stance* relative to `com`: when the stance leg is under/near
  `com`, that hip rises; the swing-side hip drops. This is the missing motion from finding #5, and a
  COM makes it a two-line addition instead of a new, independently-tuned wobble.
- Feed `com`'s lateral offset from `a.facing` forward into `_ideal` in `updateFeet` (alongside the
  existing velocity `lead`), so the hip's actual rotational displacement contributes to foot reach —
  closing the exact gap in finding #6.
- Camera (`CAM.pos`) could trail `com` instead of `P.pos` directly, so a hit's weight (which already
  displaces `com` more than a light tap would) reads in the camera too, not just in FX values layered
  on separately.

### Practical foot-IK precedent (hip-from-feet, the inverse direction)
Standard practice in IK-driven controllers (Unity/Opsive/ootii-style rigs) computes the hip's
*vertical* offset by averaging both feet's height deviation from their animated/expected position,
then applying a fraction (commonly 0.5–0.8, not the full amount — so feet can still individually
adapt) to the hip/root transform. That's the same "hip derives from a shared source, not each system
independently guessing" principle, applied to uneven-ground standing rather than running speed — a
useful cross-check that the fix direction here (systems reading from one shared point) is standard,
not novel.

Sources for this section:
[SLIP model overview (Springer)](https://link.springer.com/rwe/10.1007/978-94-007-7194-9_43-1),
[SLIP + wobbling mass stability (ScienceDirect)](https://www.sciencedirect.com/science/article/abs/pii/S0021929021003080),
[DSLIP bipedal extension / musculoskeletal robot (Frontiers)](https://www.frontiersin.org/journals/robotics-and-ai/articles/10.3389/frobt.2024.1296706/full),
[SLIP two-cycle stance-phase dynamics (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6602329/).

### Independent confirmation: this is literally how Unity's humanoid pipeline is built
Checked how a shipped, industry-standard engine handles this, as a second, unrelated data point next
to the biomechanics/SLIP research above. Unity's Mecanim isn't just similar in spirit — it makes the
mass center a **named, first-class transform**, not an emergent side effect:

- Every Humanoid rig has a **Body Transform** — Unity's own docs define it as "the mass center of the
  character" — computed via **Muscle Space**: a human-average body-part mass distribution (the same
  weighted-segment-mass approximation biomechanics uses), assumed consistent across any humanoid
  character after scale adjustment.
- **Body Orientation** is derived FROM the hips and shoulders (an average of upper/lower body
  orientation relative to T-pose; "up" = the hips/shoulders midpoint axis, "front" = the cross product
  of that up vector and the left/right hip-shoulder vectors) — orientation is computed from the body,
  not assigned to one arbitrary root bone.
- **Root Transform** — the thing that actually moves the character through the world (root motion) —
  is a runtime projection of the Body Transform onto the ground plane. In Unity, root motion isn't a
  separate translation system that happens to look similar to body movement; it's *literally derived
  from the mass center's position*.
- Muscle curves and IK goals (hands, feet) are stored **relative to the Body Transform**, not to raw
  bone hierarchy — which is specifically what makes Mecanim's retargeting engine work across different
  skeletons: a mass-center-relative reference frame is character-agnostic in a way bone-relative data
  isn't.

So two completely independent domains — biomechanics/robotics research (SLIP) and a shipped AAA/indie
production engine's animation architecture (Mecanim) — converge on the identical idea: one real mass
center, everything else (orientation, root motion, IK targets) computed relative to it. That's about
as strong a confirmation as this diagnosis is going to get.

**One important caveat from Unity's own ecosystem**, via its modern Animation Rigging package (the
runtime IK layer built on top of Mecanim): pelvis adjustment driven off foot IK error is standard for
**idle/stationary** poses, but practitioners explicitly warn against leaving it fully on during
**locomotion and combat** — running and fighting animations already contain intentionally
stretched/extended legs, and blind pelvis compensation fights the authored motion instead of
supporting it. Applied here: a `com`-driven hip/lean system should be weighted down (or handed off
entirely) during committed states the same way Short Order's own `ck` combat-stance blend already
fades out during `run`/`atk`/`slam`/`tackle` — not a new problem, the file already has the pattern for
gating a system by state, it would just need to apply to the new `com`-derived signals too.

Sources: [Unity Manual — How Root Motion Works](https://docs.unity3d.com/Manual/RootMotion.html),
[Unity Manual — Muscle setup / Avatar Muscle & Settings](https://docs.unity3d.com/Manual/MuscleDefinitions.html),
[Unity Manual — Retarget Humanoid animations](https://docs.unity3d.com/Manual/Retargeting.html),
[Unity Animation Rigging — Two Bone IK Constraint](https://docs.unity3d.com/Packages/com.unity.animation.rigging@1.1/manual/constraints/TwoBoneIKConstraint.html),
[Unity Discussions — pelvis IK setup thread](https://discussions.unity.com/t/rigging-package-how-to-setup-the-pelvis-as-ik/864784).

## How other engines do it — Unreal and Godot cross-check

Same question, two more independent engines. The pattern holds a third and fourth time.

### Unreal Engine
- **Root motion**: displacement comes from the pre-animated mesh itself (e.g., a lunging attack),
  specifically so the visible mesh and the collision capsule never disagree — the alternative
  (code-driven velocity divorced from the animation) is exactly what Unreal's own docs warn causes a
  character to "step outside their collision capsule... then slide back unrealistically" once the clip
  ends. That's the same class of bug as Short Order's decoupled hip-rotation/foot-target problem: two
  systems disagreeing about where the body actually is.
- **Control Rig Full-Body IK (FBIK)**: an effector-based whole-body solve where "the Root bone
  property on the Full Body IK node should be set, typically to the hips or pelvis bone" — Unreal's
  modern full-body IK is, by convention, anchored at the pelvis. Same anchor point as Unity's Body
  Transform, arrived at independently.

### Godot
- **Root motion**: `AnimationTree`'s Root Motion Track is pointed at "your root bone (usually `Root`
  or `Hips`)" — the engine extracts that bone's translation/rotation per frame and applies it to the
  `CharacterBody3D`/`RigidBody3D`. Same hips-as-anchor convention a third time.
- **IK history is directly relevant to this repo.** Godot removed IK entirely in the Godot 4.0
  rewrite and shipped **no replacement for over five years** — `SkeletonIK3D` was gone with nothing
  standing in for it. A proper modular framework only returned in **Godot 4.6** (this year): a stack of
  `SkeletonModifier3D`-based nodes — `TwoBoneIK3D`, `FABRIK3D`, `CCDIK3D`, `SplineIK3D`,
  `IterateIK3D`, `JacobianIK3D`, `LookAtModifier3D`, `RetargetModifier3D`, `SpringBoneSimulator3D` —
  evaluated in order on top of the `AnimationTree`'s FK base pose.
- **This repo's parked `godot-port/` predates that.** Its own README explains it hand-rolled
  `scripts/ik.gd` (a from-scratch length-locked two-bone IK) specifically *because* "nothing here uses
  4.6/4.7-only APIs" was a constraint at the time — Godot's own IK wasn't available yet. As of Godot
  4.6, `TwoBoneIK3D` is now a native, engine-supported modifier that does the same job. If the Godot
  port is ever picked back up, that's a concrete, low-risk simplification available now that wasn't
  when the scaffold was authored — swap the bespoke `ik.gd` solve for the native modifier rather than
  maintaining a parallel hand-rolled one.

### The convergence, stated plainly
Four independent sources — biomechanics/robotics research (SLIP), Unity, Unreal, and Godot — all
converge on the same structure: **the pelvis/hips is the anchor everything else (root motion,
orientation, full-body IK) is computed relative to.** None of the shipped engines treat this as
optional polish; it's load-bearing in how their retargeting and IK systems are architected at all.
Short Order's hip joint rotates for show but has no causal effect on anything else in the rig — that
puts it structurally out of step with how every other system surveyed here (biological, academic, and
three separate production engines) actually builds a locomotion rig.

Sources: [Epic Dev Community — Root Motion (UE 4.27)](https://docs.unrealengine.com/4.27/en-US/AnimatingObjects/SkeletalMeshAnimation/RootMotion),
[Epic Dev Community — Control Rig Full-Body IK (UE 5.8)](https://dev.epicgames.com/documentation/en-us/unreal-engine/control-rig-full-body-ik-in-unreal-engine),
[Godot Engine — Inverse Kinematics Returns to Godot 4.6](https://godotengine.org/article/inverse-kinematics-returns-to-godot-4-6/),
[GameFromScratch — IK Returns to Godot](https://gamefromscratch.com/inverse-kinematics-ik-return-to-godot/),
[StraySpark — Godot 4.6 IK Guide](https://www.strayspark.studio/blog/godot-46-inverse-kinematics-procedural-animation),
[BitSoul — Godot 4 AnimationTree Guide](https://bitsoulhosting.com/marketplace/blog/godot-4-animationtree-character-animation-guide).

## Not yet fixed
Nothing in this file has been changed. This is a diagnosis document; implementation is a separate
step.
