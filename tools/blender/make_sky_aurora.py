# Short Order sky pipeline -- AURORA PEAKS locale. Snowy mountain silhouettes
# ring the horizon in both variants. Day: blue sky, white sunlit peaks, sun,
# no aurora (it's daylight, it wouldn't be visible). Night: dark sky, glowing
# aurora ribbons, stars, moonlit peaks -- a genuinely different scene, not a tint.
# Run headless:  OUT=/path/out.glb VARIANT=day|night blender --background --python make_sky_aurora.py
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sky_common import init, variant, mat, cone_z, sphere, finish, dome_bands, export
import bmesh

OUT=os.environ.get("OUT","/tmp/sky_aurora.glb")
V=variant()
init()
R=90.0

if V=="day":
    bands=[
        (-5, 15, mat("b0",(0.72,0.82,0.90))),
        (15, 45, mat("b1",(0.48,0.66,0.88))),
        (45, 75, mat("b2",(0.26,0.48,0.82))),
        (75, 90, mat("b3",(0.14,0.32,0.68))),
    ]
    peak_col=(0.90,0.92,0.96); sun=True
else:
    bands=[
        (-5, 15, mat("b0",(0.06,0.08,0.16))),
        (15, 45, mat("b1",(0.03,0.04,0.11))),
        (45, 75, mat("b2",(0.015,0.02,0.07))),
        (75, 90, mat("b3",(0.005,0.008,0.03))),
    ]
    peak_col=(0.30,0.34,0.46); sun=False

dome_bands(R, bands)

# snowy peaks around the horizon
random.seed(13)
bm=bmesh.new()
m_peak=mat("m_peak", peak_col, rough=0.9)
n=16
for i in range(n):
    az=2*math.pi*i/n + random.uniform(-0.06,0.06)
    r0=R*0.97
    h=8+random.random()*14
    cone_z(bm, 2.0+random.random()*2.5, 0.1, 0, h, r0*math.cos(az), r0*math.sin(az), segs=6)
finish("peaks", bm, m_peak)

if sun:
    bm=bmesh.new()
    sphere(bm, 0, R*0.9, 30, 3.2, segs=12, rings=8)
    finish("sun", bm, mat("m_sun",(1.0,0.95,0.8), rough=0.2, emit=(1.0,0.95,0.8), estrength=3.0))
else:
    # aurora: two ribbons, each a strip of connected quads riding a sine curve
    for ri,(amp,freq,zbase,col) in enumerate([(10,0.14,55,(0.2,0.95,0.55)), (7,0.10,42,(0.55,0.35,0.95))]):
        bm=bmesh.new()
        segs=40; pts=[]
        for i in range(segs+1):
            t=i/segs; az=t*2*math.pi*0.7 + ri*1.3
            r=R*0.92
            z=zbase + amp*math.sin(t*10+ri)
            pts.append((r*math.cos(az), r*math.sin(az), z))
        vtop=[]; vbot=[]
        for (x,y,z) in pts:
            vtop.append(bm.verts.new((x,y,z+4)))
            vbot.append(bm.verts.new((x,y,z-4)))
        for i in range(segs):
            bm.faces.new((vbot[i],vbot[i+1],vtop[i+1],vtop[i]))
        finish("aurora%d"%ri, bm, mat("m_aurora%d"%ri, col, rough=0.5, emit=col, estrength=2.0))
    # stars
    random.seed(17)
    bm=bmesh.new()
    for _ in range(45):
        el=math.radians(random.uniform(20,88)); az=random.uniform(0,2*math.pi)
        r=R*0.97*math.cos(el); z=R*0.97*math.sin(el)
        sphere(bm, r*math.cos(az), r*math.sin(az), z, 0.14+random.random()*0.1, segs=5, rings=4)
    finish("stars", bm, mat("m_star",(1,1,1), rough=0.2, emit=(1,1,1), estrength=2.0))
    bm=bmesh.new()
    sphere(bm, 0, R*0.85, 40, 3.0, segs=10, rings=7)
    finish("moon", bm, mat("m_moon",(0.8,0.82,0.9), rough=0.7, emit=(0.8,0.82,0.9), estrength=0.7))

export(OUT)
