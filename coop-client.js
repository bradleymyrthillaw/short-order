/* ============================================================================
 * COOP CLIENT — the mesh as game netcode (plans/coop-sessions.md)
 * ----------------------------------------------------------------------------
 * Host-authoritative co-op. This client:
 *   1. Creates or joins a session on the hub (/coop/create | /coop/join)
 *   2. POSTs THIS device's pad to /coop/input every frame (~20Hz)
 *   3. Drains the OTHER player's inputs via /coop/drain and drives a second
 *      actor (player2) with the remote pad, merged into the same sim.
 *
 * Zero-impact when unused: no session -> no player2, no network, game plays
 * exactly as before. Enable via URL:
 *     ?coop=create            host a session (player 1)
 *     ?coop=join:<sessionId>  join one (player 2)
 *     ?coop=bot | ?coop=cpu   CPU player-2 test mode: a local autonomous chef
 *                             drives player2 through the SAME pad schema with
 *                             ZERO network (no session, no POSTs).
 * ========================================================================== */
(function () {
  var HUB = (window.__COOP_HUB__) || 'http://127.0.0.1:8931';
  var TOKEN = null;

  function authHeaders() {
    var h = { 'Content-Type': 'application/json' };
    if (TOKEN) h['X-Hub-Token'] = TOKEN;
    return h;
  }

  async function hubPost(path, body) {
    try {
      var r = await fetch(HUB + path, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body || {}) });
      return await r.json();
    } catch (e) { return { ok: false, error: String(e) }; }
  }
  async function hubGet(path) {
    try {
      var r = await fetch(HUB + path, { headers: authHeaders() });
      return await r.json();
    } catch (e) { return { ok: false, error: String(e) }; }
  }

  var coop = {
    enabled: false,
    bot: false,           // CPU P2 test mode (?coop=bot|cpu) — no network
    sessionId: null,
    player: 0,
    started: false,
    otherPlayer: 0,
    sendSeq: 0,
    lastSent: 0,
    pad: null,            // remote pad for the OTHER actor (read by tick)
    dirty: false,
    _lastDrain: 0,
  };
  window.__COOP__ = coop;

  // ---- fetch the hub token like the internal automation does ----
  async function loadToken() {
    var r = await hubGet('/hub-token');
    if (r && r.token) TOKEN = r.token;
  }

  // ---- enter a session from the URL ----
  coop.init = async function () {
    var q = (typeof location !== 'undefined' && location.search) || '';
    var m = /[?&]coop=(create|join(?::([\w-]+))?|bot|cpu)/.exec(q);
    if (!m) return;
    var mode = m[1];
    if (mode === 'bot' || mode === 'cpu') {
      // CPU P2: purely local — never touch the network
      coop.bot = true; coop.enabled = true;
      console.log('[coop] CPU P2 bot enabled');
      return;
    }
    await loadToken();
    if (mode === 'create') {
      var c = await hubPost('/coop/create', { game: 'short-order', name: 'kitchen' });
      if (!c.ok) { console.warn('[coop] create failed:', c.error); return; }
      coop.sessionId = c.sessionId; coop.player = 1; coop.otherPlayer = 2;
    } else {
      var sid = m[2];
      if (!sid) { console.warn('[coop] join requires ?coop=join:<sessionId>'); return; }
      var j = await hubPost('/coop/join', { sessionId: sid });
      if (!j.ok) { console.warn('[coop] join failed:', j.error); return; }
      coop.sessionId = sid; coop.player = 2; coop.otherPlayer = 1;
    }
    coop.enabled = true;
    console.log('[coop] ' + (coop.player === 1 ? 'P1 (host)' : 'P2 (guest)') + ' session=' + coop.sessionId);
  };

  // ---- send our pad (~20Hz) ----
  coop.send = function (pad) {
    if (!coop.enabled || !coop.sessionId) return;
    var now = performance.now();
    if (now - coop.lastSent < 50) return;
    coop.lastSent = now;
    coop.sendSeq++;
    hubPost('/coop/input', {
      sessionId: coop.sessionId, player: coop.player,
      seq: coop.sendSeq,
      input: {
        ix: pad.move ? pad.move.x : 0,
        iz: pad.move ? pad.move.y : 0,
        act: !!(pad.actionHeld || pad.light || pad.heavy),
        jump: !!pad.jump, grab: !!pad.grab, guard: !!pad.guard, rush: !!pad.rush,
        dodge: !!pad.dodge, lock: !!pad.lock,
        pk: !!(pad.pickup || pad.pickupHeld || pad.rush),
      },
    });
  };

  // ---- drain the OTHER player's inputs (~20Hz) into coop.pad ----
  coop.drain = function () {
    if (!coop.enabled || !coop.sessionId) return;
    var now = performance.now();
    if (now - coop._lastDrain < 50) return;
    coop._lastDrain = now;
    hubPost('/coop/drain', { sessionId: coop.sessionId, player: coop.otherPlayer })
      .then(function (r) {
        if (r.ok && r.inputs && r.inputs.length) {
          var last = r.inputs[r.inputs.length - 1].input;
          if (!coop.pad) coop.pad = Engine.createPad();   // canonical pad schema (engine.js)
          coop.pad.move.x = last.ix || 0;
          coop.pad.move.y = last.iz || 0;
          coop.pad.actionHeld = !!last.act;
          coop.pad.light = !!last.act;          // face buttons fight by night
          coop.pad.jump = !!last.jump; coop.pad.grab = !!last.grab;
          coop.pad.guard = !!last.guard; coop.pad.rush = !!last.rush;
          coop.pad.dodge = !!last.dodge; coop.pad.lock = !!last.lock;
          coop.pad.pickup = !!last.pk; coop.pad.pickupHeld = !!last.pk;
          coop.pad.sprint = Math.hypot(last.ix || 0, last.iz || 0) > 0.9;  // remote full-deflection -> sprint (no protocol change)
          coop.dirty = true;
        }
      });
  };

  // ---- spawn player2 (the remote chef) if not present ----
  coop.ensurePlayer2 = function () {
    if (!coop.enabled) return;
    if (window.player2 || typeof makePlayer !== 'function') return;
    var p2 = makePlayer();
    p2.chef.userData.isPlayer = true;
    // spawn beside P1, distinct colour
    p2.pos.set((player ? player.pos.x + 1.2 : 1.2), 0, (player ? player.pos.z : 4));
    p2.chef.position.copy(p2.pos);
    // updatePlayer calls P.actorSync() on a landed hit; only P1 got it from
    // attachPlayerHelpers at boot — without this, P2's first connect crashes.
    if (typeof attachPlayerHelpers === 'function') attachPlayerHelpers(p2);
    if (p2.chef.userData) {
      var mats = [];
      p2.chef.traverse(function (o) { if (o.isMesh && o.material) mats.push(o.material); });
      mats.forEach(function (m) { if (m.color && m.color.getHex() !== 0x7a4328) m.color.setHex(0x4a8aff); });
    }
    window.player2 = p2;
    scene.add(p2.chef);
    console.log('[coop] player2 spawned');
  };

  // ---- drive player2 from the remote pad (or the CPU bot); call every frame ----
  coop.tick = function (dt) {
    if (!coop.enabled) return;
    coop.ensurePlayer2();
    if (!window.player2) return;
    if (coop.bot) {
      var bp = makeBotPad(window.player2, dt);
      if (bp) updatePlayer2(dt, bp);
      else poseChef(window.player2, true, dt);
      return;
    }
    if (coop.dirty && coop.pad) {
      updatePlayer2(dt, coop.pad);
      coop.dirty = false;
    } else {
      // idle bob when no remote input
      poseChef(window.player2, true, dt);
    }
  };

  /* ============ CPU P2 TEST MODE (?coop=bot | ?coop=cpu) =====================
     A local autonomous chef driving player2 through the SAME pad schema a
     remote Pocket would send (plans/coop-sessions.md): {move:{x,y}, jump,
     light, heavy, grab, guard, rush, dodge, lock, actionHeld, pickup}. Zero
     network — no session, no POSTs; single-player is untouched (no ?coop= →
     this module stays inert).
       - title screen : wanders the floor + hops (visible proof of life)
       - brawl night  : closes on the nearest enemy, attacks on proximity,
                        hops into overhead slams, guards when staggered
       - day shift    : the Overcooked/PlateUp kitchen loop — greet diners,
                        fetch what the open tickets need, chop at the boards
                        (holds the COOK verb), plate up, run dishes out,
                        stage overflow on the pass
       - plan mode    : stands by (layout calls are the host's)
  ============================================================================ */
  var _bot = { tapT: 0, wander: null, wanderT: 0, tgx: NaN, tgz: NaN, lastD: 1e9, stuck: 0, slide: 1, slideT: 0 };
  // Move pad.move toward a world point. updatePlayer builds the move vector as
  // mv = camRight*ix - camFwd*iz with camFwd/camRight derived from CAM.yaw, so
  // invert with the SAME yaw — the pad then drives the intended world heading
  // exactly, whatever mode the shared camera is in.
  function _botMove(pad, P, tx, tz) {
    var dx = tx - P.pos.x, dz = tz - P.pos.z;
    var d = Math.hypot(dx, dz);
    if (d < 0.05) return 0;
    var fy = Math.sin(CAM.yaw), fz = Math.cos(CAM.yaw);   // = camFwd
    var rx = -fz, rz = fy;                                 // = camRight
    pad.move.x = (dx * rx + dz * rz) / d;
    pad.move.y = -(dx * fy + dz * fz) / d;
    return d;
  }
  // Keep clear of the human chef: if the straight seek line would march the bot
  // within 1.35 of the player, push the AIM point perpendicular so the bot arcs
  // around them instead of crowding or blocking their path. The stuck-detector
  // still tracks the ORIGINAL target, so obstacle hops keep firing.
  function _botClear(P, tx, tz) {
    var pl = player;
    if (!pl || pl.dead || pl === P) return [tx, tz];
    var ax = P.pos.x, az = P.pos.z, vx = tx - ax, vz = tz - az;
    var len2 = vx * vx + vz * vz;
    var px = pl.pos.x - ax, pz = pl.pos.z - az;
    var t = len2 > 1e-6 ? (px * vx + pz * vz) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    var cx = ax + vx * t, cz = az + vz * t;                // closest point on the seek line
    var qx = pl.pos.x - cx, qz = pl.pos.z - cz, q = Math.hypot(qx, qz);
    if (q < 1.35) {
      var push = 1.35 - q + 0.25;                          // nudge clear of the line
      var s = Math.hypot(vx, vz) || 1;
      var nx = -vz / s, nz = vx / s;                       // perpendicular
      if (nx * qx + nz * qz < 0) { nx = -nx; nz = -nz; }   // away from the player
      return [tx + nx * push, tz + nz * push];
    }
    return [tx, tz];
  }
  // Seek with basic obstacle handling: no pathfinding, but if the bot makes no
  // progress toward a target it assumes it's pinned on a prop (the pass counter
  // spans the arena) — it hops the prop and slides perpendicular until it
  // rounds the obstacle and the direct line opens up again. Long runs set the
  // pad.sprint hint so the bot uses the sprint meter (engine.js).
  function _botSeek(pad, P, tx, tz, dt) {
    var dx = tx - P.pos.x, dz = tz - P.pos.z, d = Math.hypot(dx, dz);
    pad.sprint = d > 5;
    if (tx !== _bot.tgx || tz !== _bot.tgz) {               // new target: reset progress
      _bot.tgx = tx; _bot.tgz = tz; _bot.lastD = d; _bot.stuck = 0; _bot.slideT = 0;
    }
    if (d < _bot.lastD - 0.06) _bot.stuck = 0;              // gaining ground
    else _bot.stuck += dt;
    _bot.lastD = d;
    if (_bot.stuck > 0.55) {
      pad.jump = true;                                      // hop the prop (vault the pass)
      _bot.slideT -= dt;
      if (_bot.slideT <= 0) { _bot.slide = -_bot.slide; _bot.slideT = 1.2; }
      var fx = -dz, fz2 = dx;                              // perpendicular (left-hand normal)
      var fl = Math.hypot(fx, fz2) || 1;
      if (_bot.slide < 0) { fx = -fx; fz2 = -fz2; }
      var fy = Math.sin(CAM.yaw), cw = Math.cos(CAM.yaw);
      pad.move.x = (fx * (-cw) + fz2 * fy) / fl;
      pad.move.y = -((fx * fy) + (fz2 * cw)) / fl;
      return d;
    }
    var cl = _botClear(P, tx, tz);                          // arc around the human, not through them
    var mdx = cl[0] - P.pos.x, mdz = cl[1] - P.pos.z;
    var md = Math.hypot(mdx, mdz);
    if (md < 0.05) return d;
    var sfy = Math.sin(CAM.yaw), sfz = Math.cos(CAM.yaw);
    pad.move.x = (mdx * (-sfz) + mdz * sfy) / md;
    pad.move.y = -((mdx * sfy) + (mdz * sfz)) / md;
    return d;
  }
  function _botTap(pad, dt, every) {
    _bot.tapT -= dt;
    if (_bot.tapT <= 0) { pad.pickup = true; _bot.tapT = every; }
  }
  function _botWander(pad, P, dt) {
    if (!_bot.wander) _bot.wander = { x: 0, z: 0 };
    _bot.wanderT -= dt;
    if (_bot.wanderT <= 0) {
      _bot.wanderT = 2 + Math.random() * 2.5;
      _bot.wander.x = (Math.random() * 2 - 1) * 6.5;
      _bot.wander.z = (Math.random() * 2 - 1) * 5.5;
    }
    if (Math.hypot(_bot.wander.x - P.pos.x, _bot.wander.z - P.pos.z) < 1.2) { _bot.wanderT = 0; return; }
    _botMove(pad, P, _bot.wander.x, _bot.wander.z);
  }
  // Hold position near the pass when there's nothing productive left: seek it,
  // then stop — never idle-wander during a shift (open tickets = you fetch).
  function _botHold(pad, P, dt) {
    var cl = _botClear(P, PASSD.x, PASSD.z);
    var d = _botMove(pad, P, cl[0], cl[1]);
    if (d < 1.6) { pad.move.x = 0; pad.move.y = 0; }
    return d;
  }
  function _nearestStation(P, pred) {
    var best = null, bd = 1e9;
    for (var i = 0; i < STATIONS.length; i++) {
      var s = STATIONS[i];
      if (!pred(s)) continue;
      var d = Math.hypot(s.x - P.pos.x, s.z - P.pos.z);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }
  function _nearestDiner(P, states) {
    var best = null, bd = 1e9;
    for (var i = 0; i < DAY.diners.length; i++) {
      var d = DAY.diners[i];
      if (states.indexOf(d.state) < 0) continue;
      var dist = Math.hypot(d.x - P.pos.x, d.z - P.pos.z);
      if (dist < bd) { bd = dist; best = d; }
    }
    return best;
  }
  function _botFight(pad, P, dt) {
    var t = nearestEnemy(P.pos, P.facing, null);
    if (!t || t.dead) { _botWander(pad, P, dt); return pad; }
    var dx = t.pos.x - P.pos.x, dz = t.pos.z - P.pos.z, d = Math.hypot(dx, dz);
    _botSeek(pad, P, t.pos.x, t.pos.z, dt);
    if (P.stagger > 0) { pad.guard = true; pad.move.x *= 0.3; pad.move.y *= 0.3; return pad; }
    if (d < 2.6) {
      if ((P._air || 0) > 0.06) pad.heavy = true;          // aerial overhead slam
      else if (!P.attack) {
        pad.heavy = Math.random() < 0.65; pad.light = !pad.heavy;   // attack on proximity
        if (Math.random() < 0.35) pad.jump = true;          // hop into a slam setup
      } else if (P.attack.t > P.attack.wind * 0.5) {
        pad.light = Math.random() < 0.3;                    // buffer the follow-up
      }
    } else if (d < 1.5) {
      pad.guard = true;                                     // too close to swing: block
    }
    return pad;
  }
  function _botKitchen(pad, P, dt) {
    var carry = DAY.carry;
    // 1) a finished plate: run it to a diner, else stage it on the pass
    if (carry && carry.kind === 'plate') {
      var diner = _nearestDiner(P, ['ordered']) || _nearestDiner(P, ['ready']);
      if (diner) { var ds = _botSeek(pad, P, diner.x, diner.z, dt); if (ds < 1.9) _botTap(pad, dt, 0.45); }
      else { var pp = _botSeek(pad, P, PASSD.x, PASSD.z, dt); if (pp < 2.5) _botTap(pad, dt, 0.5); }
      return pad;
    }
    // 2) empty hands: greet a ready diner so their ticket opens
    if (!carry) {
      var rd = _nearestDiner(P, ['ready']);
      if (rd) { var dr = _botSeek(pad, P, rd.x, rd.z, dt); if (dr < 1.9) _botTap(pad, dt, 0.4); return pad; }
    }
    if (!carry) {
      // 3) keep the boards moving: finish chopping a raw item…
      var rawBoard = _nearestStation(P, function (s) { return (s.kind === 'prep' || s.kind === 'mash') && !s.broken && s.board && s.board.state === 'raw'; });
      if (rawBoard) { var db = _botSeek(pad, P, rawBoard.x, rawBoard.z, dt); if (db < 2.0) pad.actionHeld = true; return pad; }
      // 4) …then collect what's done (chopped boards, ready/burnt cookers)
      var done = _nearestStation(P, function (s) {
        if (s.kind === 'prep' || s.kind === 'mash') return !!s.board && s.board.state !== 'raw';
        if (s.kind === 'cook') return !!s.item && (s.item.state === 'ready' || s.item.state === 'burnt');
        return false;
      });
      if (done) { var dk = _botSeek(pad, P, done.x, done.z, dt); if (dk < 2.0) _botTap(pad, dt, 0.5); return pad; }
      // 5) a parked plate with components is a meal in progress — take it out
      var parked = _nearestStation(P, function (s) { return s.kind === 'plate' && s.plate && s.plate.items && s.plate.items.length; });
      if (parked) { var dp = _botSeek(pad, P, parked.x, parked.z, dt); if (dp < 2.0) _botTap(pad, dt, 0.5); return pad; }
      // 6) staged dishes on the pass
      if (DAY.passDishes.some(Boolean)) { var dg = _botSeek(pad, P, PASSD.x, PASSD.z, dt); if (dg < 2.5) _botTap(pad, dt, 0.5); return pad; }
    }
    if (carry && carry.kind === 'ing') {
      if (carry.state === 'raw') {
        // raw component: onto a free board (chopping is the bottleneck, same as
        // Overcooked/PlateUp), else onto an empty cooker
        var board = _nearestStation(P, function (s) { return (s.kind === 'prep' || s.kind === 'mash') && !s.broken && !s.board; })
                 || _nearestStation(P, function (s) { return s.kind === 'cook' && !s.item; });
        if (board) { var dbo = _botSeek(pad, P, board.x, board.z, dt); if (dbo < 2.0) _botTap(pad, dt, 0.6); }
        else _botHold(pad, P, dt);              // all boards busy: hold the pass, don't wander
      } else {
        // prepared component: onto a parked plate, else park it on a counter
        var slot = _nearestStation(P, function (s) { return s.kind === 'plate' && s.plate; })
                || _nearestStation(P, function (s) { return s.kind === 'counter' && !s.held; });
        if (slot) { var dsl = _botSeek(pad, P, slot.x, slot.z, dt); if (dsl < 2.0) _botTap(pad, dt, 0.6); }
        else _botHold(pad, P, dt);              // nowhere to park: hold the pass
      }
      return pad;
    }
    // 7) fetch: OPEN TICKETS come first — the nearest crate holding an
    // ingredient an ordered ticket still needs always beats a nearby filler
    // crate or a wander. With no needed crate, restock the line at the nearest
    // spare crate while tickets are open; only hold the pass when there's
    // literally nothing left to fetch.
    var need = {};
    for (var i = 0; i < DAY.diners.length; i++) {
      var din = DAY.diners[i];
      if (din.state !== 'ordered' || din.bad || !RECIPES[din.dish]) continue;
      var rk = RECIPES[din.dish];
      for (var j = 0; j < rk.need.length; j++) need[rk.need[j].id] = true;
    }
    var ticketsOpen = false;
    for (var ti = 0; ti < DAY.diners.length; ti++) {
      if (DAY.diners[ti].state === 'ordered' && !DAY.diners[ti].bad) { ticketsOpen = true; break; }
    }
    var needed = null, nd = 1e9, spare = null, sd = 1e9;
    for (var k = 0; k < STATIONS.length; k++) {
      var s2 = STATIONS[k];
      if (s2.kind !== 'crate') continue;
      var dd = Math.hypot(s2.x - P.pos.x, s2.z - P.pos.z);
      if (need[s2.ingredient] && dd < nd) { nd = dd; needed = s2; }
      else if (!need[s2.ingredient] && dd < sd) { sd = dd; spare = s2; }
    }
    var crate = needed || (ticketsOpen ? spare : null);
    if (crate) { var dc = _botSeek(pad, P, crate.x, crate.z, dt); if (dc < 1.9) _botTap(pad, dt, 0.45); return pad; }
    _botHold(pad, P, dt);                       // nothing to fetch: hold the pass, don't wander
    return pad;
  }
  function makeBotPad(P, dt) {
    var pad = Engine.createPad();               // canonical pad schema (engine.js)
    if (!P || !P.pos || typeof GAME === 'undefined') return pad;
    if (GAME.mode === 'plan') { _botWander(pad, P, dt); return pad; }   // layout = the host's call
    if (GAME.mode === 'play') return _botFight(pad, P, dt);
    if (GAME.mode === 'day') return _botKitchen(pad, P, dt);
    // title / over / shop: wander the floor, hop around — visible proof of life
    _botWander(pad, P, dt);
    if (Math.random() < dt * 0.6) pad.jump = true;
    return pad;
  }

  window.coopClient = coop;
  // init once the game's world is up (makePlayer + scene + player exist).
  // The game script is a sibling inline block that runs after this file, so
  // poll — a one-shot 'load' listener can fire before the sim finishes boot.
  (function tryInit() {
    try {
      // TDZ-safe: `scene` is a later top-level const in the game script; a bare
      // `typeof scene` on a TDZ let/const THROWS instead of returning undefined.
      if (typeof makePlayer === 'function' && typeof scene !== 'undefined' && typeof THREE !== 'undefined') {
        coop.init();
      } else {
        setTimeout(tryInit, 300);
      }
    } catch (e) {
      setTimeout(tryInit, 300);
    }
  })();
})();
