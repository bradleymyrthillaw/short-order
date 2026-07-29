import { chromium } from 'playwright';
import { readFileSync } from 'fs';
const THREE = readFileSync(process.env.THREE_UMD || './package/build/three.min.js','utf8');
const OUT=(process.env.OUT_DIR || './').replace(/\/?$/,'/');
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium',
  args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--use-angle=swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'] });
const ctx = await b.newContext({ viewport:{width:844,height:390}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
await ctx.route(/three\.min\.js/, r=>r.fulfill({ status:200, contentType:'application/javascript', body:THREE }));
const p = await ctx.newPage(); await p.bringToFront();
const errs=[]; p.on('console', m=>{ if(m.type()==='error') errs.push(m.text()); });
p.on('pageerror', e=>errs.push('PAGEERR '+e.message));
await p.goto(new URL('../public/short-order/index.html', import.meta.url).href,{waitUntil:'load',timeout:30000});
await p.waitForTimeout(900);
await p.evaluate(()=>{ resetRun(); applyLayout(DEFAULT_LAYOUT); document.getElementById('dayBtn').click(); });
await p.waitForTimeout(400);
await p.evaluate(()=>{ const s=document.getElementById('startDayBtn'); if(s) s.click(); });
await p.waitForTimeout(600);
// stand at the CHOP board with a raw tomato on it, hands empty, and HOLD cook
await p.evaluate(()=>{
  const prep = STATIONS.find(s=>s.def==='prep');
  prep.board={id:'tomato', state:'raw', prog:0.0};
  syncBoardMesh(prep);
  DAY.carry=null; updateCarryMesh();
  player.pos.set(prep.x, 0, prep.z+1.0); player.facing=0;
  TOUCH.cookHeld=true;   // simulate holding the COOK button
});
await p.waitForTimeout(650);   // let it chop for a bit -> knife mid-bob, bar ~40%
await p.screenshot({path:OUT+'chop.png'});
await b.close();
console.log('wrote chop.png; console errors:', errs.length? errs.slice(0,5).join(' | '):'none');
