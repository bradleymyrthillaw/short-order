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
await p.evaluate(()=>{ resetRun(); applyLayout(DEFAULT_LAYOUT); document.getElementById('dayBtn').click(); });
await p.waitForTimeout(400);
await p.evaluate(()=>{ const s=document.getElementById('startDayBtn'); if(s) s.click(); });
await p.waitForTimeout(600);
// put a raw tomato on the CHOP board, mid-chop, and stand the player at it
await p.evaluate(()=>{
  const prep = STATIONS.find(s=>s.def==='prep');
  prep.board={id:'tomato', state:'raw', prog:0.75};   // half-way through the 1.5s cut
  syncBoardMesh(prep);
  // stand right at the board (inside 1.15u -> bubble fades) so board + progress bar show
  player.pos.set(prep.x, 0, prep.z+1.0); player.facing=0;
});
await p.waitForTimeout(700);
await p.screenshot({path:OUT+'twobtn.png'});
await b.close(); console.log('wrote twobtn.png');
