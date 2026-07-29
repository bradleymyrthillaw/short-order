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
// fresh run, into the back office
await p.evaluate(()=>{ resetRun(); document.getElementById('dayBtn').click(); });
await p.waitForTimeout(500);
await p.evaluate(()=>{ openShop(); });
await p.waitForTimeout(400);
await p.screenshot({path:OUT+'shop.png'});
// buy a couple of Store items, then go to REARRANGE to show the tray
await p.evaluate(()=>{
  const fi=STORE.findIndex(s=>s.def==='fryer'), gi=STORE.findIndex(s=>s.def==='griddle'), ti=STORE.findIndex(s=>s.kind==='table');
  buyStore(fi); buyStore(gi); buyStore(ti);
  goFullscreen(); startPlan();
  player.pos.set(0,0,-3.5);
});
await p.waitForTimeout(1000);
await p.screenshot({path:OUT+'shop-tray.png'});
await b.close(); console.log('wrote shop.png + shop-tray.png');
