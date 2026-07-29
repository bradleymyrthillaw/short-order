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
// DEFAULT kitchen -> rice & guac locked
await p.evaluate(()=>{ resetRun(); applyLayout(DEFAULT_LAYOUT); openRecipes(); });
await p.waitForTimeout(500);
await p.screenshot({path:OUT+'cards-locked.png'});
// FULL gear -> all unlocked
await p.evaluate(()=>{
  applyLayout([
    {def:'ricecrate',c:0,r:0},{def:'cilantrocrate',c:1,r:0},{def:'limecrate',c:2,r:0},
    {def:'avocadocrate',c:3,r:0},{def:'crabcrate',c:4,r:0},{def:'pot',c:5,r:0},
    {def:'mash',c:6,r:0},{def:'plate',c:7,r:0},
    {def:'lettucecrate',c:0,r:1},{def:'tomatocrate',c:1,r:1},{def:'prep',c:2,r:1},{def:'sink',c:3,r:1},
  ]);
  openRecipes();
});
await p.waitForTimeout(500);
await p.screenshot({path:OUT+'cards-unlocked.png'});
await b.close(); console.log('wrote cards-locked.png + cards-unlocked.png');
