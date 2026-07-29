import { chromium } from 'playwright';
import { readFileSync } from 'fs';
const THREE = readFileSync(process.env.THREE_UMD || './package/build/three.min.js','utf8');
const GLTF  = readFileSync(process.env.GLTF_JS  || './package/examples/js/loaders/GLTFLoader.js','utf8');
const OUT=(process.env.OUT_DIR || './').replace(/\/?$/,'/');
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium',
  args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--use-angle=swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'] });
const ctx = await b.newContext({ viewport:{width:844,height:390}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
await ctx.route(/three\.min\.js/, r=>r.fulfill({ status:200, contentType:'application/javascript', body:THREE }));
await ctx.route(/GLTFLoader\.js/, r=>r.fulfill({ status:200, contentType:'application/javascript', body:GLTF }));
const p = await ctx.newPage(); await p.bringToFront();
const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await p.goto(new URL('../public/short-order/index.html', import.meta.url).href,{waitUntil:'load',timeout:30000});
await p.waitForTimeout(1200);   // let GLBs parse
// a kitchen with a GRIDDLE in the line
await p.evaluate(()=>{
  resetRun();
  applyLayout([
    {def:'lettucecrate',c:0,r:0},{def:'tomatocrate',c:1,r:0},{def:'griddle',c:2,r:0},
    {def:'prep',c:3,r:0},{def:'plate',c:4,r:0},{def:'sink',c:5,r:0},
  ]);
  document.getElementById('dayBtn').click();
});
await p.waitForTimeout(400);
await p.evaluate(()=>{ const s=document.getElementById('startDayBtn'); if(s) s.click(); });
await p.waitForTimeout(1000);
// stand in front of the griddle
await p.evaluate(()=>{ const gr=STATIONS.find(s=>s.def==='griddle'); if(gr&&window.player){ player.pos.set(gr.x,0,gr.z+1.4); player.facing=0; } });
await p.waitForTimeout(600);
const has = await p.evaluate(()=>{ const gr=STATIONS.find(s=>s.def==='griddle'); return { model: !!(gr&&gr._model) }; });
await p.screenshot({path:OUT+'griddlegame.png'});
await b.close();
console.log('griddle uses model:', JSON.stringify(has), '| errors:', errs.length?errs.slice(0,3).join(' | '):'none');
