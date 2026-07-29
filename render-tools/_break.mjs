import { chromium } from 'playwright';
import { readFileSync } from 'fs';
const THREE = readFileSync(process.env.THREE_UMD || './package/build/three.min.js','utf8');
const OUT=(process.env.OUT_DIR || './').replace(/\/?$/,'/');
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium',
  args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--use-angle=swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'] });
const ctx = await b.newContext({ viewport:{width:844,height:390}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
await ctx.route(/three\.min\.js/, r=>r.fulfill({ status:200, contentType:'application/javascript', body:THREE }));
const p = await ctx.newPage(); await p.bringToFront();
await p.goto(new URL('../public/short-order/index.html', import.meta.url).href,{waitUntil:'load',timeout:30000});
await p.waitForTimeout(900);
await p.evaluate(()=>{ resetRun(); document.getElementById('dayBtn').click(); });
await p.waitForTimeout(500);
await p.evaluate(()=>{ const s=document.getElementById('planBtn'); if(s) s.click(); });
await p.waitForTimeout(600);
// break the two chop boards to show the red X markers
await p.evaluate(()=>{ const preps=STATIONS.filter(s=>s.def==='prep'); preps.forEach(breakStation); player.pos.set(0,0,-3.5); });
await p.waitForTimeout(900);
await p.screenshot({path:OUT+'break-kitchen.png'});
// back to the shop to show REPAIRS
await p.evaluate(()=>{ endPlan(); });
await p.waitForTimeout(500);
await p.screenshot({path:OUT+'break-shop.png'});
await b.close(); console.log('wrote break-kitchen.png + break-shop.png');
