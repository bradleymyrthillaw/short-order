import { chromium } from 'playwright';
import { readFileSync } from 'fs';
const THREE = readFileSync(process.env.THREE_UMD || './package/build/three.min.js','utf8');
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium',
  args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--use-angle=swiftshader'] });
const ctx = await b.newContext({ viewport:{width:844,height:390}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
await ctx.route(/three\.min\.js/, r=>r.fulfill({ status:200, contentType:'application/javascript', body:THREE }));
const p = await ctx.newPage();
await p.goto(new URL('../public/short-order/index.html', import.meta.url).href,{waitUntil:'load',timeout:30000});
await p.waitForTimeout(900);
await p.evaluate(()=>{ resetRun(); applyLayout(DEFAULT_LAYOUT); document.getElementById('dayBtn').click(); });
await p.waitForTimeout(400);
await p.evaluate(()=>{ const s=document.getElementById('startDayBtn'); if(s) s.click(); });
await p.waitForTimeout(500);
await p.evaluate(()=>{
  const prep = STATIONS.find(s=>s.def==='prep');
  prep.board={id:'tomato', state:'raw', prog:0.0}; syncBoardMesh(prep);
  DAY.carry=null; player.pos.set(prep.x,0,prep.z+1.0); player.facing=0;
  TOUCH.cookHeld=true;
});
// sample knife.y + bar.scale.x + particle count over ~0.6s of chopping
const samples = await p.evaluate(async ()=>{
  const prep = STATIONS.find(s=>s.def==='prep');
  const out=[];
  for(let i=0;i<8;i++){ await new Promise(r=>setTimeout(r,80));
    out.push({ ky:+prep._knife.position.y.toFixed(3), bar:+(prep._progBar.scale.x).toFixed(2),
      trackVis:prep._track.visible, knifeVis:prep._knife.visible, prog:+(prep.board?prep.board.prog:-1).toFixed(2) }); }
  return out;
});
console.log(JSON.stringify(samples,null,0));
const kys = samples.map(s=>s.ky);
console.log('knife-y range:', Math.min(...kys).toFixed(3), '..', Math.max(...kys).toFixed(3), '(bobs if range>0.1)');
console.log('bar grew:', samples[0].bar, '->', samples[samples.length-1].bar);
await b.close();
