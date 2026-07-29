import { chromium } from 'playwright';
import { readFileSync } from 'fs';
const THREE = readFileSync(process.env.THREE_UMD || './package/build/three.min.js','utf8');
const GLTF  = readFileSync(process.env.GLTF_JS  || './package/examples/js/loaders/GLTFLoader.js','utf8');
const OUT=(process.env.OUT_DIR || './').replace(/\/?$/,'/');
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium',
  args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--use-angle=swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'] });
const ctx = await b.newContext({ viewport:{width:844,height:390}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
await ctx.route(/three\.min\.js/, r=>r.fulfill({ status:200, contentType:'application/javascript', body:THREE }));
await ctx.route(/GLTFLoader\.js/, r=>r.fulfill({ status:200, contentType:'application/javascript', body:GLTF }));
const p = await ctx.newPage(); await p.bringToFront();
const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await p.goto(new URL('../public/short-order/index.html', import.meta.url).href,{waitUntil:'load',timeout:30000});
await p.waitForTimeout(1000);
await p.evaluate(()=>{ resetRun(); applyLayout(DEFAULT_LAYOUT); document.getElementById('dayBtn').click(); });
await p.waitForTimeout(400);
await p.evaluate(()=>{ const s=document.getElementById('startDayBtn'); if(s) s.click(); });
await p.waitForTimeout(1200);   // let the GLB parse + plants place
const info = await p.evaluate(()=>({ assets:Object.keys(window.ASSETS||{}), soAssets:!!window.SO_ASSETS, gltf:!!(window.THREE&&THREE.GLTFLoader), plantsDone: (typeof _plantsDone!=='undefined')?_plantsDone:'n/a' }));
// default view
await p.screenshot({path:OUT+'plantgame.png'});
// pan player to the back-left corner to frame a plant
await p.evaluate(()=>{ if(window.player){ player.pos.set(-6,0,-5.5); player.facing=Math.PI; } });
await p.waitForTimeout(500);
await p.screenshot({path:OUT+'plantgame2.png'});
await b.close();
console.log('info:', JSON.stringify(info), '| errors:', errs.length?errs.slice(0,3).join(' | '):'none');
