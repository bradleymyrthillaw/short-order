/* Headless harness. Stubs THREE / DOM / WebAudio with REAL vector math,
   then drives the actual game code through simulated frames of combat to
   surface runtime exceptions and NaN propagation. */
const fs=require('fs');

/* ---------- real-ish math ---------- */
class Vec3{
  constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
  set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}
  copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this;}
  clone(){return new Vec3(this.x,this.y,this.z);}
  add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;}
  addScaledVector(v,s){this.x+=v.x*s;this.y+=v.y*s;this.z+=v.z*s;return this;}
  sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this;}
  multiplyScalar(s){this.x*=s;this.y*=s;this.z*=s;return this;}
  setScalar(s){this.x=s;this.y=s;this.z=s;return this;}
  lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z;}
  length(){return Math.sqrt(this.lengthSq());}
  normalize(){const l=this.length()||1;return this.multiplyScalar(1/l);}
  lerp(v,t){this.x+=(v.x-this.x)*t;this.y+=(v.y-this.y)*t;this.z+=(v.z-this.z)*t;return this;}
  subVectors(a,b){this.x=a.x-b.x;this.y=a.y-b.y;this.z=a.z-b.z;return this;}
  lerpVectors(a,b,t){this.x=a.x+(b.x-a.x)*t;this.y=a.y+(b.y-a.y)*t;this.z=a.z+(b.z-a.z)*t;return this;}
  divideScalar(s){return this.multiplyScalar(1/(s||1e-9));}
  dot(v){return this.x*v.x+this.y*v.y+this.z*v.z;}
  distanceTo(v){return Math.hypot(this.x-v.x,this.y-v.y,this.z-v.z);}
  project(){this.x=0;this.y=0;this.z=0.5;return this;}
}
class Vec2{constructor(x=0,y=0){this.x=x;this.y=y;}set(x,y){this.x=x;this.y=y;return this;}}
class Col{constructor(h){this.h=h;}setHex(h){this.h=h;return this;}}
class Scale{constructor(){this.x=1;this.y=1;this.z=1;}set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}setScalar(s){this.x=this.y=this.z=s;return this;}copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this;}clone(){const s=new Scale();s.x=this.x;s.y=this.y;s.z=this.z;return s;}}
class Rot{constructor(){this.x=0;this.y=0;this.z=0;}set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}}

function node(){
  return {
    position:new Vec3(), rotation:new Rot(), scale:new Scale(),
    quaternion:new Quat(),
    visible:true, castShadow:false, receiveShadow:false, userData:{}, children:[],
    add(c){this.children.push(c);return this;}, remove(){return this;},
    getWorldPosition(t){return t.copy(this.position);},
    getWorldQuaternion(q){return q;},
    localToWorld(v){return v;}, worldToLocal(v){return v;},
    matrix:new Mat4(), matrixWorld:new Mat4(), updateMatrix(){}, updateMatrixWorld(){},
    lookAt(){}, updateProjectionMatrix(){},
  };
}
function geo(type){return {type, translate(){return this;}};}
function mat(){return {color:new Col(0),emissive:new Col(0),emissiveIntensity:0,opacity:1,map:null,side:0,roughness:.7,metalness:0,flatShading:false,userData:{},onBeforeCompile:null,customProgramCacheKey:null,clone(){return mat();}};}

class Quat{ setFromUnitVectors(){return this;} copy(){return this;} invert(){return this;} multiply(){return this;} slerp(){return this;} set(){return this;} clone(){return new Quat();} }
class Mat4{ copy(){return this;} invert(){return this;} identity(){return this;} clone(){return new Mat4();} }

const THREE={
  Vector3:Vec3, Vector2:Vec2, Color:Col,
  Fog:function(){}, Scene:function(){const n=node();n.background=null;n.fog=null;return n;},
  PerspectiveCamera:function(fov){const n=node();n.fov=fov;n.aspect=1;n.near=.1;n.far=100;return n;},
  WebGLRenderer:function(){return {setPixelRatio(){},shadowMap:{enabled:false,type:0},outputEncoding:0,toneMapping:0,toneMappingExposure:1,domElement:{addEventListener(){}},setSize(){},render(){},setRenderTarget(){},clear(){},capabilities:{getMaxAnisotropy:()=>4}};},
  HemisphereLight:function(){const n=node();n.intensity=1;return n;},
  DirectionalLight:function(){const n=node();n.intensity=1;n.castShadow=false;n.shadow={mapSize:{set(){}},camera:{},bias:0,radius:0};return n;},
  PointLight:function(){const n=node();n.intensity=1;return n;},
  Mesh:function(g,m){const n=node();n.geometry=g||geo('Geometry');n.material=m||mat();return n;},
  Points:function(g,m){const n=node();n.geometry=g||geo('BufferGeometry');n.material=m||mat();return n;},
  PointsMaterial:function(){return mat();},
  BufferGeometry:function(){const attrs={};return {type:'BufferGeometry',attributes:attrs,
    setAttribute(name,attr){attrs[name]=attr;return this;},getAttribute(name){return attrs[name];},dispose(){}};},
  BufferAttribute:function(array,itemSize){return {array,itemSize,needsUpdate:false};},
  Group:function(){return node();},
  PlaneGeometry:function(){return geo('PlaneGeometry');},
  BoxGeometry:function(){return geo('BoxGeometry');},
  CylinderGeometry:function(){return geo('CylinderGeometry');},
  SphereGeometry:function(){return geo('SphereGeometry');},
  ConeGeometry:function(){return geo('ConeGeometry');},
  TorusGeometry:function(){return geo('TorusGeometry');},
  RingGeometry:function(){return geo('RingGeometry');},
  CircleGeometry:function(){return geo('CircleGeometry');},
  TetrahedronGeometry:function(){return geo('TetrahedronGeometry');},
  MeshStandardMaterial:function(){return mat();},
  MeshBasicMaterial:function(){return mat();},
  ShaderMaterial:function(o){o=o||{};return {uniforms:o.uniforms||{},userData:{},vertexShader:'',fragmentShader:''};},
  SpriteMaterial:function(){return mat();},
  Sprite:function(){return node();},
  ShapeGeometry:function(){return geo('ShapeGeometry');},
  Shape:function(){return {};},
  OrthographicCamera:function(){const n=node();n.updateProjectionMatrix=function(){};return n;},
  WebGLRenderTarget:function(){return {texture:{},setSize(){}};},
  Quaternion:Quat, Matrix4:Mat4,
  CanvasTexture:function(){return {wrapS:0,wrapT:0,repeat:{x:1,y:1,set(){}},offset:{x:0,y:0,set(){}},anisotropy:1};},
  RepeatWrapping:1,sRGBEncoding:2,ACESFilmicToneMapping:3,PCFSoftShadowMap:4,DoubleSide:5,AdditiveBlending:6,LinearFilter:7,RGBAFormat:8,
};

/* ---------- DOM ---------- */
const fakeGradient={addColorStop(){}};
const ctx={fillStyle:'',strokeStyle:'',lineWidth:1,lineCap:'',globalAlpha:1,fillRect(){},clearRect(){},beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},stroke(){},
  createLinearGradient(){return fakeGradient;},createRadialGradient(){return fakeGradient;},
  arc(){},ellipse(){},save(){},restore(){},clip(){},closePath(){},fill(){}};
function el(){return {style:{setProperty(){}},className:'',dataset:{},classList:{add(){},remove(){},toggle(){},contains(){return false;}},
  addEventListener(){},removeEventListener(){},getBoundingClientRect(){return {left:0,top:0,width:100,height:100};},
  _txt:'',set textContent(v){this._txt=v;},get textContent(){return this._txt;},
  _html:'',set innerHTML(v){this._html=v;},get innerHTML(){return this._html;},
  appendChild(){},remove(){},animate(){return{};},set onclick(v){this._c=v;},get onclick(){return this._c;},children:[]};}
const idcache={};
const document={
  createElement(t){ if(t==='canvas')return {width:0,height:0,getContext:()=>ctx}; return el(); },
  getElementById(id){ return idcache[id]||(idcache[id]=el()); },
  querySelectorAll(){ return []; },
  documentElement:{style:{setProperty(){}}}, body:el(),
};

/* ---------- audio ---------- */
function ACnode(){return {connect(d){return d;},start(){},stop(){},frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){},value:0},gain:{value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},type:'',Q:{value:0},buffer:null,loop:false};}
function AudioCtx(){return {currentTime:0,sampleRate:44100,state:'running',destination:{},
  createGain(){return {gain:{value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(d){return d;}};},
  createOscillator(){return ACnode();},
  createBufferSource(){return ACnode();},
  createBuffer(c,len){return {getChannelData(){return new Float32Array(len);}};},
  createBiquadFilter(){return {type:'',frequency:{value:0},Q:{value:0},connect(d){return d;}};},
  resume(){}};}

/* ---------- globals ---------- */
const LISTENERS={};
let NOWMS=0;
global.window=global;
global.THREE=THREE;
global.document=document;
global.navigator={getGamepads:()=>[],userAgent:'test',standalone:false,vibrate:()=>true,maxTouchPoints:0};
global.performance={now:()=>NOWMS};
global.innerWidth=1280; global.innerHeight=720; global.devicePixelRatio=1;
global.addEventListener=(t,fn)=>{(LISTENERS[t]||(LISTENERS[t]=[])).push(fn);};
global.removeEventListener=()=>{};
global.requestAnimationFrame=()=>0;
global.AudioContext=AudioCtx; global.webkitAudioContext=AudioCtx;
global.matchMedia=()=>({matches:false,addListener(){},addEventListener(){}});

function fire(type,ev){ (LISTENERS[type]||[]).forEach(fn=>fn(ev)); }
function key(k,down){ fire(down?'keydown':'keyup',{key:k,preventDefault(){}}); }

/* ---------- load game ---------- */
/* Pull the game's inline <script> straight out of index.html so testing is a
   single command. (Set GAME=path/to/other.html to point it elsewhere.) */
const SRC = process.env.GAME || 'index.html';
let code;
if (SRC.endsWith('.html')) {
  const html = fs.readFileSync(SRC, 'utf8');
  const blocks = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)];
  if (!blocks.length) { console.log('FAIL: no inline <script> found in ' + SRC); process.exit(1); }
  code = blocks[blocks.length - 1][1];
  fs.writeFileSync('game.js', code);   // keep a copy for `node --check game.js`
} else {
  code = fs.readFileSync(SRC, 'utf8');
}
code+='\n;globalThis.__t={get player(){return player;},get enemies(){return enemies;},get GAME(){return GAME;},get FX(){return FX;},get tokensUsed(){return tokensUsed;},get PICKUPS(){return PICKUPS;},get nearPickup(){return nearPickup;},get ROT(){return ROT;},get STAGE(){return STAGE;},get CAM(){return CAM;},get HALFW(){return HALFW;},get HALFD(){return HALFD;},layout,clientToStage,collide,tryPickup,spawnEnemy,startNight,tick,killChef,updateEnemy,buildRagdoll,equipEnemy,applyImpact,resolveHit,attackDrive,grabTarget,grabEnemy,throwHeld,throwContext,restY,canGrab,dropWeapon,startGrabRush,rushContact,startWeaponSteal,rushTarget,spawnVince,makeChef,makePlayer,startDay,updateDay,finishDay,spawnDiner,cookVerbs,waveOff,onNightEnd,nightCfgFor,resetRun,endNight,buyUpgrade,upLvl,openShop,toDay,showRentDecision,spawnVince,get DAY(){return DAY;},get RUN(){return RUN;},get SHOP(){return SHOP;},get STATIONS(){return STATIONS;},get OCC(){return OCC;},get GRID(){return GRID;},applyLayout,get DEFAULT_LAYOUT(){return DEFAULT_LAYOUT;},get STATION_DEFS(){return STATION_DEFS;},gridX,gridZ,startPlan,endPlan,planVerbs,nearestCell,nearestCellFor,nearestPlaceable,liftPlaceable,placeAt,toggleChair,rebuildSeats,applyTables,get PLAN(){return PLAN;},get TABLES(){return TABLES;},get DOCC(){return DOCC;},get DGRID(){return DGRID;},get SEATS(){return SEATS;},get DEFAULT_TABLES(){return DEFAULT_TABLES;},tblX,tblZ,tableCap,get INGREDIENTS(){return INGREDIENTS;},get RECIPES(){return RECIPES;},matchRecipe,plateAddOk,stationAct,serveDiner,takeOrder,availableRecipes,canMake,recipeNeedStr,tickCooks,renderRecipeCards,recipeCard,missingFor,openRecipes,closeRecipes,rotateNearest,cellBlockedByFurniture,cellOccupied,get STORE(){return STORE;},buyStore,buyUpgrade,takeFromTray,renderShop,makeStation,beli,kitScore,rentFor,get SEED_CASH(){return SEED_CASH;},breakStation,repairStation,repairCost,breakSomeStations,brokenCount,onNightEnd,get CAST(){return CAST;},get NIGHT_ROSTER(){return NIGHT_ROSTER;},get OBST(){return OBST;},WEAPONS,SLICE};';
(0,eval)(code);
const T=globalThis.__t;

/* ---------- run ---------- */
function finite(v){return v&&Number.isFinite(v.x)&&Number.isFinite(v.y)&&Number.isFinite(v.z);}
let fail=null;

if(process.env.SCENARIO==='weapon'){
  try{
    T.startNight(T.SLICE, ()=>{});
    // stand next to the cast-iron pickup (dead center of the pass, per
    // PASS_LOADOUT) and grab it
    T.player.pos.set(0,0,0.5);
    NOWMS+=16; T.tick();                 // updatePrompt registers nearPickup
    console.log('DEBUG pickups:',T.PICKUPS.length,'nearPickup:',T.nearPickup?T.nearPickup.key:null,'mode:',T.GAME.mode);
    key('f',true); NOWMS+=16; T.tick(); key('f',false);
    console.log('after grab -> wpn:',T.player.wpn,'dur:',T.player.dur);
    if(T.player.wpn==='fists'){ console.log('WARN: pickup did not register'); }
    // drop an enemy right next to the player and heavy-attack until the weapon breaks
    const e=T.spawnEnemy('tough'); e.hp=99999; // punching bag, kept adjacent & upright
    let broke=false, startWpn=T.player.wpn;
    for(let f=0; f<400 && !broke; f++){
      NOWMS+=16;
      if(f%14===0) key('k',true); if(f%14===3) key('k',false);   // spam heavy
      e.pos.set(0,0,1.8); e.stagger=0; e.hp=99999;                // keep bag in reach & upright
      T.tick();
      if(!finite(T.player.pos)){fail='NaN in weapon scenario';break;}
      if(T.player.wpn==='fists' && startWpn!=='fists'){ broke=true; console.log('weapon broke at frame',f,'-> reverted to fists'); }
    }
    if(!broke && startWpn!=='fists') console.log('NOTE: weapon did not break in 400 frames (dur left '+T.player.dur+')');
    console.log('SCENARIO weapon: no exceptions');
  }catch(e){ fail='EXCEPTION(weapon): '+e.stack; }
  if(fail){console.log('FAIL:',fail);process.exit(1);} else {console.log('PASS(weapon)');process.exit(0);}
}

try{
  T.startNight(T.SLICE, r=>{ console.log('  onEnd fired:',JSON.stringify(r)); });
  // force-spawn immediately (setTimeout spawns won't run in a sync loop)
  for(let i=0;i<6;i++) T.spawnEnemy(i<4?'weak':'tough');
  const frames=3000;
  for(let f=0; f<frames; f++){
    NOWMS+=16;
    // scripted input
    if(f%20===0) key('j',true); if(f%20===3) key('j',false);
    if(f%37===0) key('k',true); if(f%37===4) key('k',false);
    if(f%50<25){ key('w',true);} else {key('w',false);}
    if(f%80<15){ key('d',true);} else {key('d',false);}
    if(f===120){ key('f',true);} if(f===123){key('f',false);}
    if(f%200<40){ key(' ',true);} else {key(' ',false);}
    if(f%140===0){ key('shift',true);} if(f%140===2){key('shift',false);}
    if(f%300===0){ key('l',true);} if(f%300===2){key('l',false);}
    T.tick();
    // integrity checks
    if(!finite(T.player.pos)){ fail='player.pos NaN at frame '+f; break; }
    { const PA=T.player.chef.userData.armR;   // player IK finiteness (every rig change below touches the player)
      if(!finite(PA.tgt)||!Number.isFinite(PA.up.scale.y)||!Number.isFinite(T.player.chef.userData.legs[0].thigh.scale.y)){ fail='player IK NaN at frame '+f; break; } }
    if(T.player.com && !finite(T.player.com)){ fail='player.com NaN at frame '+f; break; }
    for(const e of T.enemies){ if(!finite(e.pos)){ fail='enemy.pos NaN at frame '+f; break; }
      const A=e.chef.userData.armR;
      if(!finite(A.tgt)||!Number.isFinite(A.up.scale.y)||!Number.isFinite(e.chef.userData.legs[0].thigh.scale.y)){ fail='enemy IK NaN at frame '+f; break; } }
    if(fail) break;
    if(T.tokensUsed<0||T.tokensUsed>3){ fail='token count out of range ('+T.tokensUsed+') at frame '+f; break; }
    // margin matches the original tuning (arena half-extent minus ~0.55); scales
    // with ARENA.w/d instead of a hardcoded number so a bigger/smaller room
    // (e.g. the chez-samoa-3D restaurant swap, ARENA now 34x24) doesn't need
    // this re-tuned by hand every time.
    if(Math.abs(T.CAM.pos.x)>T.HALFW-0.55||Math.abs(T.CAM.pos.z)>T.HALFD-0.55){ fail='camera left arena at frame '+f+' pos '+T.CAM.pos.x.toFixed(2)+','+T.CAM.pos.z.toFixed(2); break; }
    // keep the fight alive: respawn if wiped so we exercise more paths
    if(T.enemies.filter(e=>!e.dead).length===0 && f<frames-400){ T.spawnEnemy(Math.random()<0.5?'weak':'tough'); }
    // deterministically exercise the ragdoll under the finiteness checks
    if(f%350===0){ const live=T.enemies.find(e=>!e.dead); if(live) T.killChef(live, Math.random()*6.28); }
  }
}catch(e){ fail='EXCEPTION: '+e.stack; }

const alive=T.enemies.filter(e=>!e.dead).length;
console.log('--- result ---');
console.log('player.hp:',T.player.hp.toFixed?T.player.hp.toFixed(1):T.player.hp,'| pos finite:',finite(T.player.pos));
console.log('enemies total/alive:',T.enemies.length,'/',alive,'| kills:',T.GAME.kills,'| maxCombo:',T.GAME.maxCombo);
console.log('tokensUsed:',T.tokensUsed,'| player.wpn:',T.player.wpn,'| dur:',T.player.dur);
if(fail){ console.log('FAIL:',fail); process.exit(1);} else { console.log('PASS: no exceptions, no NaN across 3000 frames'); }
