import { chromium } from 'playwright';
import { readFileSync } from 'fs';
// Dev-only Short Order render helper. Needs a vendored three r128 UMD build
// (CDN is proxy-blocked headless): `npm pack three@0.128.0` -> package/build/three.min.js.
// Override the paths via env: THREE_UMD=/abs/three.min.js  OUT_DIR=/abs/out/
const THREE = readFileSync(process.env.THREE_UMD || './package/build/three.min.js','utf8');
const OUT=(process.env.OUT_DIR || './').replace(/\/?$/,'/');
const name=process.argv[2]||'plan-pop.png';
const lift=process.argv[3]==='lift';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium',
  args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--use-angle=swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'] });
const ctx = await b.newContext({ viewport:{width:844,height:390}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
await ctx.route(/three\.min\.js/, r=>r.fulfill({ status:200, contentType:'application/javascript', body:THREE }));
const p = await ctx.newPage(); await p.bringToFront();
await p.goto(new URL('../public/short-order/index.html', import.meta.url).href,{waitUntil:'load',timeout:30000});
await p.waitForTimeout(1000);
await p.evaluate(()=>{ document.getElementById('dayBtn').click(); });
await p.waitForTimeout(700);
await p.evaluate(()=>{ const s=document.getElementById('planBtn'); if(s) s.click(); });
await p.waitForTimeout(700);
await p.evaluate((doLift)=>{
  // stand the chef in front of the fryer and (optionally) lift it
  const f=STATIONS.find(s=>s.id==='fryer');
  player.pos.set(f.x, 0, f.z+2.2); player.facing=Math.PI;
  if(doLift){ liftStation(f); }
}, lift);
await p.waitForTimeout(1200);
await p.screenshot({path:OUT+name});
await b.close(); console.log('wrote '+name);
