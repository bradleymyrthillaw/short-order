#!/usr/bin/env node
/* Bake the Mixamo FBX clip library into anims/clips.bin — zlib-deflated
   THREE.AnimationClip JSON, the delivery format the game actually needs.

   FBX is a DCC interchange format: every clip re-ships the whole 65-bone rig
   plus full-rate keys — ~38 MB across ~65 files, each parsed synchronously by
   FBXLoader at startup (the old startup freeze). This bakes them ONCE, offline,
   into what the runtime feeds the mixer anyway. Startup then does one small
   fetch + JSON.parse + AnimationClip.parse — no FBXLoader in the hot path.

   Rebuild whenever MIXAMO_SRC changes:   node tools/bake-clips.js
   (X_Bot.fbx stays a real FBX — it provides the skeleton template, not clips.) */
const fs = require('fs'), vm = require('vm'), path = require('path'), zlib = require('zlib');
const R = path.dirname(__dirname);

global.self = globalThis; global.window = globalThis;
vm.runInThisContext(fs.readFileSync(path.join(R, 'vendor/three.min.js'), 'utf8'), { filename: 'three.min.js' });
global.fflate = require(path.join(R, 'vendor/fflate.umd.js'));
vm.runInThisContext(fs.readFileSync(path.join(R, 'vendor/FBXLoader.js'), 'utf8'), { filename: 'FBXLoader.js' });

// clip key -> fbx path, straight out of index.html
const src = fs.readFileSync(path.join(R, 'index.html'), 'utf8');
const m = src.match(/const MIXAMO_SRC = \{([\s\S]*?)\n\};/);
if (!m) { console.error('MIXAMO_SRC not found'); process.exit(1); }
const SRC = {};
for (const [, key, file] of m[1].matchAll(/([A-Za-z0-9_]+)\s*:\s*'(anims\/[A-Za-z0-9_.-]+\.fbx)'/g)) SRC[key] = file;

const loader = new THREE.FBXLoader();
const round = (arr, dp) => { const k = 10 ** dp; for (let i = 0; i < arr.length; i++) arr[i] = Math.round(arr[i] * k) / k; };

const clips = {}; let rawFbx = 0;
for (const key of Object.keys(SRC)) {
  const buf = fs.readFileSync(path.join(R, SRC[key])); rawFbx += buf.length;
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const c = loader.parse(ab, 'anims/').animations[0];
  if (!c) { console.warn('no animation in', SRC[key]); continue; }
  c.name = key;
  for (const tr of c.tracks) {
    // same processing the game applied at load: strip horizontal root drift (keep the bob)
    if (/Hips\.position$/.test(tr.name)) { const v = tr.values; for (let i = 0; i + 2 < v.length; i += 3) { v[i] = 0; v[i + 2] = 0; } }
    // quantize so the JSON text stays short (quat 1e-4 ≈ 0.01°; positions are in cm)
    round(tr.times, 4);
    round(tr.values, /quaternion$/.test(tr.name) ? 4 : 2);
  }
  clips[key] = THREE.AnimationClip.toJSON(c);
}

const json = JSON.stringify({ version: 1, clips });
const bin = zlib.deflateSync(Buffer.from(json), { level: 9 });
fs.writeFileSync(path.join(R, 'anims/clips.bin'), bin);
const MB = n => (n / 1048576).toFixed(1) + ' MB';
console.log(`baked ${Object.keys(clips).length} clips: FBX ${MB(rawFbx)} -> JSON ${MB(json.length)} -> clips.bin ${MB(bin.length)}`);
