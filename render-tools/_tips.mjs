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
await p.evaluate(()=>{ const s=document.getElementById('startDayBtn'); if(s) s.click(); });
await p.waitForTimeout(700);
await p.evaluate(()=>{
  const seats=[0,2,4], hearts=[0.9,0.45,0.12];
  for(let i=0;i<3;i++) spawnDiner();
  DAY.diners.slice(0,3).forEach((d,i)=>{ const si=seats[i], seat=SEATS[si]; d.slot=si; d.x=seat.x; d.z=seat.z; d.tx=seat.x; d.tz=seat.z; d.g.position.set(seat.x,0,seat.z);
    d.bad=false; d.dish='salad'; d.state='ordered'; d.hearts=hearts[i]; setBubble(d, RECIPES.salad.short, 'good'); });
  renderDayHUD();
});
await p.waitForTimeout(1000);
await p.screenshot({path:OUT+'tips.png'});
await b.close(); console.log('wrote tips.png');
