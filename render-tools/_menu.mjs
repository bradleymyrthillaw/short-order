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
await p.evaluate(()=>{ resetRun();
  // give the kitchen the full Tier-1 gear so the new stations + dishes show
  applyLayout([
    {def:'ricecrate',c:0,r:0},{def:'cilantrocrate',c:1,r:0},{def:'limecrate',c:2,r:0},
    {def:'avocadocrate',c:3,r:0},{def:'crabcrate',c:4,r:0},{def:'pot',c:5,r:0},
    {def:'mash',c:6,r:0},{def:'plate',c:7,r:0},
    {def:'lettucecrate',c:0,r:1},{def:'tomatocrate',c:1,r:1},{def:'prep',c:2,r:1},{def:'sink',c:3,r:1},
  ]);
  document.getElementById('dayBtn').click();
});
await p.waitForTimeout(500);
await p.evaluate(()=>{ const s=document.getElementById('startDayBtn'); if(s) s.click(); });
await p.waitForTimeout(700);
await p.evaluate(()=>{
  const seats=[0,2,4,6], dishes=['rice','guac','salad'];
  for(let i=0;i<4;i++) spawnDiner();
  DAY.diners.slice(0,4).forEach((d,i)=>{ const si=seats[i], seat=SEATS[si]; d.slot=si; d.x=seat.x; d.z=seat.z; d.tx=seat.x; d.tz=seat.z; d.g.position.set(seat.x,0,seat.z);
    if(i===0){ d.state='reading'; setBubble(d,'…','read'); }
    else { d.bad=false; d.dish=dishes[(i-1)%dishes.length]; d.state='ordered'; setBubble(d, RECIPES[d.dish].name, 'good'); } });
  // chef mid-task: carrying boiled rice toward the plate
  DAY.carry={kind:'ing',id:'rice',state:'boiled'}; DAY._carrySig=''; updateCarryMesh();
  const plate=STATIONS.find(s=>s.def==='plate'); player.pos.set(plate.x,0,plate.z+2.0); player.facing=Math.PI;
});
await p.waitForTimeout(1400);
await p.screenshot({path:OUT+'menu.png'});
await b.close(); console.log('wrote menu.png');
