/* ============================================================================
 * ENGINE — shared core for SHORT ORDER (engine modularity pass, 2026-08-04)
 * ----------------------------------------------------------------------------
 * The clearly-reusable core of the game, extracted so both index.html (the
 * game) and coop-client.js (the netcode/bot) consume ONE definition of:
 *
 *   1. Math toolkit   — clamp/lerp/damp/angLerp/rand/TAU/V3. Pure, no deps.
 *   2. Input schema   — createPad() is the canonical pad shape (gamepad poll,
 *                       touch merge, remote drain and the CPU bot all emit it);
 *                       createTracker() is the edge-trigger primitive behind
 *                       every tap (keyboard tapK, gamepad button edges).
 *   3. Movement core  — Engine.move: the player movement STATE MACHINE —
 *                       jump feel (coyote time, input buffering, variable
 *                       height), stamina + sprint, and the vertical gravity
 *                       curve (apex-hang). Pure on (P, dt, input flags): no
 *                       game state is read or written.
 *   4. Asset loader   — ASSETS / assetClone / loadAssets (bakes the Blender
 *                       GLBs from assets.gen.js into clones).
 *
 * Load order: after three.js / GLTFLoader, before coop-client.js and the game
 * script. The declarations here are top-level in a classic script, so they are
 * shared global lexical bindings: the game script keeps using clamp/damp/
 * ASSETS/loadAssets bare — do NOT redeclare them there. The `Engine` namespace
 * aggregates the same definitions for explicit consumers (coop-client.js).
 * ========================================================================== */
'use strict';

/* ================================ MATH TOOLKIT ========================= */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp  = (a, b, t) => a + (b - a) * t;
const rand  = (a, b) => a + Math.random() * (b - a);
const damp  = (cur, tgt, l, dt) => cur + (tgt - cur) * (1 - Math.exp(-l * dt));
const angLerp = (a, b, t) => { let d = ((b - a + Math.PI) % TAU) - Math.PI; if (d < -Math.PI) d += TAU; return a + d * t; };
// V3 aliases three.js; a plain fallback keeps engine.js parseable on hosts
// that never loaded THREE (the headless harness) — the game never runs there.
const V3 = (typeof THREE !== 'undefined' && THREE.Vector3) ? THREE.Vector3
         : class V3 { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; } };

/* ================================ INPUT SCHEMA ======================== */
/* The canonical pad. Every producer (gamepad poll, touch merge, remote drain,
   CPU bot) emits this shape; updatePlayer reads it. `sprint` is an optional
   hint (bot long-seeks / remote full-deflection); the network protocol itself
   is unchanged. */
function createPad() {
  return {
    move: { x: 0, y: 0 }, rstick: { x: 0, y: 0 },
    light: false, heavy: false, pickup: false, pickupHeld: false,
    grab: false, jump: false, actionHeld: false, guard: false, rush: false,
    dodge: false, camL: false, camR: false, lock: false, start: false,
    sprint: false,
  };
}
/* Rising-edge tracker. `tap(k, v)` reports a fresh press and records the
   state; `set(k, v)` records a state without consuming an edge (held-only
   channels). Mirrors the old PREV/GP.prev maps exactly. */
function createTracker() {
  return {
    _s: {},
    tap(k, v) { const was = !!this._s[k]; this._s[k] = !!v; return !!v && !was; },
    set(k, v) { this._s[k] = !!v; },
  };
}

/* ================================ MOVEMENT CORE ======================= */
/* Jump-feel + stamina/sprint + vertical gravity curve. All functions are
   pure over (P, dt, plain input flags): they never touch GAME/scene/enemies,
   so the same state machine drives P1, remote P2 and the CPU bot. */
const MOVE = {
  // vertical curve
  GRAV: 16, JUMP_V: 7.8,               // floatier — more hang time (apex-hang below)
  HANG_BAND: 2.6, HANG_MUL: 0.48,      // |vy| under HANG_BAND -> lightened gravity (float at the top)
  SLAM_GRAV_MUL: 1.7,                  // committed overhead-slam drop
  // ground accel / air control / decel (velocity ramps via damp)
  GROUND_ACC: 12, DECEL: 9, AIR_ACC: 4.2,   // was 10/10/3 — crisper starts, slight slide, real air steering
  // jump feel: coyote time, input buffering, variable height
  COYOTE: 0.09, JUMP_BUFFER: 0.14, JUMP_CUT: 0.55,
  // stamina + sprint
  STAM_MAX: 100, STAM_START: 25,       // can't START a sprint below 25 (hysteresis vs the 0 floor)
  SPRINT_COST: 13, STAM_REGEN: 22,     // ~7.7s full sprint, ~3.5s to refill
  SPRINT_MULT: 1.32,                   // 6.7 -> 8.84 u/s (top of the rig's sprint-gait band)
  // sprint input detectors
  SPRINT_AXIS: 0.92, SPRINT_HOLD: 0.24, DBL_TAP: 0.26,
};

/* Launch the jump. Shared by the live press (coyote) and the buffered press
   (fires on landing). Pure: writes only P. */
function _launch(P, s) {
  P.vy = MOVE.JUMP_V;
  const lx = s.moving ? s.mvx : Math.sin(s.facing);
  const lz = s.moving ? s.mvz : Math.cos(s.facing);
  P.vel.x += lx * 2.6; P.vel.z += lz * 2.6;       // a bit of launch in the input/facing dir
  P.jumpCD = 0.28; P.iframe = Math.max(P.iframe, 0.26); P.attack = null; P.jumpBufT = 0;
}

/* Per-frame jump state machine. s = { grounded, wantJump, jumpHeld, canJump,
   moving, mvx, mvz, facing }. Returns true when a jump launched this frame. */
function jump(P, dt, s) {
  if (s.grounded) P.coyoteT = MOVE.COYOTE;        // fresh ground contact refills coyote time
  else if (P.coyoteT > 0) P.coyoteT -= dt;
  if (P.jumpBufT > 0) P.jumpBufT -= dt;
  let jumped = false;
  if (s.wantJump && s.canJump && (s.grounded || P.coyoteT > 0)) { _launch(P, s); jumped = true; }
  else if (s.wantJump && !s.grounded && s.canJump) P.jumpBufT = MOVE.JUMP_BUFFER;  // buffer a slightly-early press
  // VARIABLE HEIGHT: releasing jump while still rising cuts the ascent once
  // (a tap = short hop, a hold = full float). Never cuts the slam drop.
  if (!s.jumpHeld && P._jumpHeldPrev && P.vy > 1.5 && !P.slam) P.vy *= MOVE.JUMP_CUT;
  P._jumpHeldPrev = !!s.jumpHeld;
  return jumped;
}

/* Called from the landing branch: fire a buffered jump the instant we touch
   down (canJump must reflect the landing frame's state). */
function tryBufferedJump(P, s) {
  if (P.jumpBufT > 0 && s.canJump) { P.jumpBufT = 0; _launch(P, s); return true; }
  P.jumpBufT = 0; return false;
}

/* The vertical gravity curve: slam drops fast, apex hangs floaty. */
function gravityMul(P) {
  return P.slam ? MOVE.SLAM_GRAV_MUL : (Math.abs(P.vy) < MOVE.HANG_BAND ? MOVE.HANG_MUL : 1);
}

/* Stamina + sprint state machine. s = { wish, moving, blocked } where
   blocked = guard/attack/tackle/dodge/stagger. Drains while sprinting
   (floor 0), regens otherwise (cap STAM_MAX); returns whether sprinting. */
function sprint(P, dt, s) {
  const ok = s.wish && s.moving && !s.blocked && P.stamina > MOVE.STAM_START;
  if (ok) P.stamina = Math.max(0, P.stamina - MOVE.SPRINT_COST * dt);
  else P.stamina = Math.min(MOVE.STAM_MAX, P.stamina + MOVE.STAM_REGEN * dt);
  return ok;
}
/* The move namespace carries the constants AND the state machine. */
const move = Object.assign({}, MOVE, { jump, tryBufferedJump, gravityMul, sprint });

/* ================================ ASSET LOADER ======================== */
/* ASSETS[key] holds a prototype Group baked from assets.gen.js; assetClone()
   hands out a copy to place. Everything degrades to nothing if the loader or
   data is absent (the headless harness), so the game never depends on an
   asset existing. Callbacks (placeDecorPlants / buildSky / SKY_STATE) are
   guarded and live in the game script — they only run after the GLBs load. */
const ASSETS = {};
function assetClone(key) { const g = ASSETS[key]; return (g && g.clone) ? g.clone(true) : null; }
function loadAssets() {
  if (typeof THREE === 'undefined' || !THREE.GLTFLoader || typeof window === 'undefined' || !window.SO_ASSETS) return;
  const L = new THREE.GLTFLoader();
  for (const key in window.SO_ASSETS) {
    try {
      L.load(window.SO_ASSETS[key], g => {
        ASSETS[key] = g.scene;
        if (typeof placeDecorPlants === 'function') placeDecorPlants();
        if (key.indexOf('sky_') === 0 && typeof buildSky === 'function') buildSky(SKY_STATE.locale, SKY_STATE.isDay);
      }, undefined, () => {});
    } catch (e) { /* one bad asset must not kill the night */ }
  }
}

/* ================================ EXPORT ============================== */
const Engine = { TAU, clamp, lerp, rand, damp, angLerp, V3,
  createPad, createTracker, move,
  ASSETS, assetClone, loadAssets };
(typeof window !== 'undefined' ? window : globalThis).Engine = Engine;
