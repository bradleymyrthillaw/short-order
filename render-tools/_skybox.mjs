// Screenshot every {locale x day/night} skybox combination for a visual QA
// pass -- the harness proves the wiring doesn't crash but can't show what
// anything actually looks like. Pattern copied from the existing
// _plantgame.mjs/_griddlegame.mjs render helpers: vendor three.js (the CDN
// is proxy-blocked headless) and route it in over Playwright.
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
const THREE = readFileSync(process.env.THREE_UMD || './package/build/three.min.js','utf8');
const GLTF  = readFileSync(process.env.GLTF_JS  || './package/examples/js/loaders/GLTFLoader.js','utf8');
const OUT=(process.env.OUT_DIR || './skyshots/').replace(/\/?$/,'/');
import { mkdirSync } from 'fs';
mkdirSync(OUT, { recursive: true });

const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium',
  args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--use-angle=swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'] });
const ctx = await b.newContext({ viewport:{width:1024,height:576}, deviceScaleFactor:1 });
await ctx.route(/three\.min\.js/, r=>r.fulfill({ status:200, contentType:'application/javascript', body:THREE }));
await ctx.route(/GLTFLoader\.js/, r=>r.fulfill({ status:200, contentType:'application/javascript', body:GLTF }));
const p = await ctx.newPage(); await p.bringToFront();
const errs=[]; p.on('pageerror',e=>errs.push(String(e.message||e))); p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await p.goto(new URL('../public/short-order/index.html', import.meta.url).href,{waitUntil:'load',timeout:30000});
await p.waitForTimeout(6000);   // let all 16 GLBs parse -- the 12 sky domes are much bigger than the prop assets

// NB: ASSETS is a top-level `const` in a classic (non-module) script, so it
// never attaches to `window` -- must read the bare identifier here, not
// window.ASSETS (which is always undefined and had me chasing a phantom bug).
const info = await p.evaluate(()=>({
  soAssets: window.SO_ASSETS ? Object.keys(window.SO_ASSETS).filter(k=>k.startsWith('sky_')) : [],
  loaded: Object.keys(ASSETS||{}).filter(k=>k.startsWith('sky_')),
}));
console.log('sky assets declared:', info.soAssets.length, '| loaded so far:', info.loaded.length);

const LOCALES=['ocean','nebula','city','underwater','aurora'];

await p.evaluate(()=>{ window.__origUpdateCamera=updateCamera; });   // save before nooping it below

// ---- NIGHT shots: don't use togglePause() -- its #pause overlay is a CSS
// class that outlives the mode switch and bleeds into later day shots in
// the same page session. Instead monkey-patch updateCamera() to a no-op
// (it's a plain top-level function, reassignable) so nothing stomps our
// manual camera transform every frame, then aim it as a wide, sky-forward
// establishing shot well above the WALL_H=4.5 parapet.
for (let i=0;i<LOCALES.length;i++){
  const day = i+1;   // RUN.day=1 -> ocean, 2 -> nebula, ... matches currentLocale()'s cycle
  await p.evaluate((day)=>{
    resetRun(); RUN.day=day;
    startNight(SLICE, ()=>{});
    updateCamera=function(){};
    camera.position.set(0, 15, 28);
    camera.lookAt(0, 6, -60);
    document.getElementById('hud').classList.remove('on');
  }, day);
  await p.waitForTimeout(500);
  const locale = await p.evaluate(()=>SKY_STATE.locale+'/'+(SKY_STATE.isDay?'day':'night'));
  await p.screenshot({path: OUT+'night_'+LOCALES[i]+'.png'});
  console.log('night shot', LOCALES[i], '-> SKY_STATE says:', locale);
}

// ---- DAY shots: dayCamera() re-asserts DAYCAM every frame (no pause exists
// in day mode), so fight it by mutating DAYCAM's own target fields instead
// of the camera object directly -- a sky-ward tilt from the default
// kitchen-framed low lookY.
await p.evaluate(()=>{ updateCamera=window.__origUpdateCamera; });   // restore -- dayCamera() only runs through updateCamera()
for (let i=0;i<LOCALES.length;i++){
  const day = i+1;
  await p.evaluate((day)=>{
    resetRun(); RUN.day=day;
    DAYCAM.y=20; DAYCAM.lookY=9; DAYCAM.lookZ=-40; DAYCAM.z=16;
    startDay();
    document.getElementById('dayhud').classList.remove('on');
  }, day);
  await p.waitForTimeout(900);   // let the camera lerp (1-exp(-5*dt)) settle
  const locale = await p.evaluate(()=>SKY_STATE.locale+'/'+(SKY_STATE.isDay?'day':'night'));
  await p.screenshot({path: OUT+'day_'+LOCALES[i]+'.png'});
  console.log('day shot', LOCALES[i], '-> SKY_STATE says:', locale);
}

const finalInfo = await p.evaluate(()=>Object.keys(ASSETS||{}).filter(k=>k.startsWith('sky_')));
console.log('sky assets loaded by end of run:', finalInfo.length, '/', LOCALES.length*2, '->', finalInfo.join(','));
await b.close();
console.log('errors:', errs.length ? errs.slice(0,8).join(' | ') : 'none');
