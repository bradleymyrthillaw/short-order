import { chromium } from 'playwright';
import { readFileSync } from 'fs';
const THREE = readFileSync(process.env.THREE_UMD || './package/build/three.min.js','utf8');
const OUT=(process.env.OUT_DIR || './').replace(/\/?$/,'/');
const name=process.argv[2]||'tables.png';
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
await p.evaluate(()=>{
  const act=()=>{ PLAN.cell=nearestCell(player); planVerbs(player,{pickup:true},0.016); };
  const chair=(t,side)=>{ const o=[{x:-0.95,z:0},{x:0.95,z:0},{x:0,z:-0.95},{x:0,z:0.95}][side];
    player.pos.set(t.x+o.x,0,t.z+o.z); toggleChair(player); };
  // pull table 0 forward into the front row
  const t0=TABLES[0], oc=t0.c;
  player.pos.set(t0.x,0,t0.z); act();
  player.pos.set(tblX(oc),0,tblZ(1)); act();
  // crank table 2 up to a 4-top
  chair(TABLES[2],2); chair(TABLES[2],3);
  // make table 3 a 1-top (strip its right chair)
  chair(TABLES[3],1);
  // park chef centre, empty-handed
  player.pos.set(0,0,0.5); player.facing=Math.PI; PLAN.lift=null;
});
await p.waitForTimeout(1200);
await p.screenshot({path:OUT+name});
await b.close(); console.log('wrote '+name);
