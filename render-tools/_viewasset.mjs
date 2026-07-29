import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { extname } from 'path';
const DIR = process.env.DIR;               // scratchpad dir with viewer.html, three.min.js, GLTFLoader.js, plant.glb
const SHOT = process.env.SHOT || (DIR+'/asset.png');
const TYPES={'.html':'text/html','.js':'application/javascript','.glb':'model/gltf-binary','.png':'image/png'};
const srv = createServer((req,res)=>{
  try{ const f=DIR+decodeURIComponent(req.url.split('?')[0]); const body=readFileSync(f);
    res.writeHead(200,{'content-type':TYPES[extname(f)]||'application/octet-stream'}); res.end(body); }
  catch(e){ res.writeHead(404); res.end('nf'); }
});
await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium',
  args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--use-angle=swiftshader'] });
const p = await (await b.newContext({viewport:{width:900,height:600},deviceScaleFactor:2})).newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
const ASSET=process.env.ASSET||'plant.glb';
await p.goto(`http://localhost:${port}/viewer.html?f=${ASSET}`,{waitUntil:'load',timeout:30000});
await p.waitForFunction(()=>window.__done!==false,{timeout:15000}).catch(()=>{});
const done=await p.evaluate(()=>window.__done);
await p.waitForTimeout(300);
await p.screenshot({path:SHOT});
await b.close(); srv.close();
console.log('done flag:', done, '| errors:', errs.length?errs.slice(0,3).join(' | '):'none', '| wrote', SHOT);
