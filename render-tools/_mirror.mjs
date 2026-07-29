import { chromium } from 'playwright';
import { readFileSync } from 'fs';
const THREE = readFileSync(process.env.THREE_UMD || './package/build/three.min.js','utf8');
const OUT=(process.env.OUT_DIR || './').replace(/\/?$/,'/');
const name=process.argv[2]||'mirror.png';
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
// mirror the whole back line through the real input-dispatch (planVerbs), front row as scratch
await p.evaluate(()=>{
  const act=()=>{ PLAN.cell=nearestCell(player); planVerbs(player,{pickup:true},0.016); };
  const relocate=(id,tc,tr)=>{ const s=STATIONS.find(x=>x.id===id);
    player.pos.set(s.x,0,s.z); if(!PLAN.lift) act();
    player.pos.set(gridX(tc),0,gridZ(tr)); act(); };
  for(let c=0;c<8;c++){ const id=STATIONS.find(s=>s.c===c&&s.r===0).id; relocate(id,7-c,1); }
  for(let c=0;c<8;c++){ const id=STATIONS.find(s=>s.c===c&&s.r===1).id; relocate(id,c,0); }
  // park the chef in the middle, empty-handed, so the mirrored line reads clean
  player.pos.set(0,0,-4.5); player.facing=Math.PI; PLAN.lift=null;
});
await p.waitForTimeout(1200);
await p.screenshot({path:OUT+name});
await b.close(); console.log('wrote '+name);
