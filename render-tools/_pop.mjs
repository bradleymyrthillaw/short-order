import { chromium } from 'playwright';
import { readFileSync } from 'fs';
// Dev-only Short Order render helper. Needs a vendored three r128 UMD build
// (CDN is proxy-blocked headless): `npm pack three@0.128.0` -> package/build/three.min.js.
// Override the paths via env: THREE_UMD=/abs/three.min.js  OUT_DIR=/abs/out/
const THREE = readFileSync(process.env.THREE_UMD || './package/build/three.min.js','utf8');
const OUT=(process.env.OUT_DIR || './').replace(/\/?$/,'/');
const name=process.argv[2]||'day-pop.png';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium',
  args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--use-angle=swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'] });
const ctx = await b.newContext({ viewport:{width:844,height:390}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
await ctx.route(/three\.min\.js/, r=>r.fulfill({ status:200, contentType:'application/javascript', body:THREE }));
const p = await ctx.newPage(); await p.bringToFront();
await p.goto(new URL('../public/short-order/index.html', import.meta.url).href,{waitUntil:'load',timeout:30000});
await p.waitForTimeout(1000);
await p.evaluate(()=>{ document.getElementById('dayBtn').click(); });
await p.waitForTimeout(700);
await p.evaluate(()=>{ const s=document.getElementById('startDayBtn'); if(s) s.click(); });
await p.waitForTimeout(700);
await p.evaluate(()=>{ const seats=[0,2,4,6];
  for(let i=0;i<4;i++) spawnDiner();
  DAY.diners.slice(0,4).forEach((d,i)=>{ const si=seats[i], seat=SEATS[si]; d.slot=si; d.x=seat.x; d.z=seat.z; d.tx=seat.x; d.tz=seat.z; d.g.position.set(seat.x,0,seat.z);
    if(i===0){ d.state='reading'; setBubble(d,'…','read'); }
    else if(i===1){ d.state='ready'; setBubble(d,'READY','ready'); }
    else if(i===2){ d.bad=false; d.dish='fries'; d.state='ordered'; setBubble(d, DISHES.fries.name, 'good'); }
    else { d.bad=true; d.state='ordered'; setBubble(d, d.cast.bad, 'bad'); } }); });
await p.waitForTimeout(1400);
await p.screenshot({path:OUT+name});
await b.close(); console.log('wrote '+name);
