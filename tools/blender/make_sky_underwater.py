# Short Order sky pipeline -- UNDERWATER locale. No real horizon -- water is
# in every direction, so the dome wraps the FULL sphere (bands run -90..90,
# not 0..90 like the open-air locales). Day: bright turquoise with strong
# light shafts. Night: dark teal/black with faint shafts + bioluminescent specks.
# Run headless:  OUT=/path/out.glb VARIANT=day|night blender --background --python make_sky_underwater.py
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sky_common import init, variant, mat, box, sphere, cone_z, finish, dome_bands, export
import bmesh

OUT=os.environ.get("OUT","/tmp/sky_underwater.glb")
V=variant()
init()
R=90.0

if V=="day":
    bands=[
        (60, 90, mat("b0",(0.55,0.86,0.82))),     # sunlit surface glow above
        (20, 60, mat("b1",(0.20,0.62,0.68))),
        (-30, 20, mat("b2",(0.08,0.38,0.48))),
        (-90,-30, mat("b3",(0.03,0.18,0.28))),    # dark depths below
    ]
    shaft_op=0.30; glow_col=(0.85,0.98,0.9); n_shafts=7
else:
    bands=[
        (60, 90, mat("b0",(0.06,0.14,0.18))),
        (20, 60, mat("b1",(0.03,0.09,0.13))),
        (-30, 20, mat("b2",(0.015,0.05,0.09))),
        (-90,-30, mat("b3",(0.005,0.02,0.05))),
    ]
    shaft_op=0.10; glow_col=(0.3,0.9,0.8); n_shafts=3

dome_bands(R, bands)

# light shafts: tall thin faceted wedges angled down from the "surface"
random.seed(4)
bm=bmesh.new()
m_shaft=mat("m_shaft", glow_col, rough=0.4, emit=glow_col, estrength=shaft_op*3)
for i in range(n_shafts):
    az=random.uniform(0,2*math.pi); r=random.uniform(15,45)
    box(bm, r*math.cos(az), r*math.sin(az), 20, 2.5+random.random()*2, 0.3, 60)
finish("shafts", bm, m_shaft)

# coral / reef silhouettes scattered low
random.seed(9)
m_coral=mat("m_coral",(0.65,0.28,0.32) if V=="day" else (0.18,0.10,0.12), rough=0.8)
bm=bmesh.new()
for _ in range(10):
    az=random.uniform(0,2*math.pi); r=random.uniform(30,55)
    cx,cy=r*math.cos(az), r*math.sin(az)
    for _ in range(3):
        cone_z(bm, 0.5+random.random()*0.8, 0.1, -R*0.55, -R*0.55+2+random.random()*4,
               cx+random.uniform(-1.5,1.5), cy+random.uniform(-1.5,1.5))
finish("coral", bm, m_coral)

# a few fish silhouettes -- flattened diamond bodies
random.seed(21)
m_fish=mat("m_fish",(0.10,0.10,0.14), rough=0.6)
for i in range(5):
    bm=bmesh.new()
    az=random.uniform(0,2*math.pi); r=random.uniform(20,40); z=random.uniform(-10,25)
    box(bm, r*math.cos(az), r*math.sin(az), z, 1.4, 0.15, 0.6)
    finish("fish%d"%i, bm, m_fish)

if V=="night":
    bm=bmesh.new()
    for _ in range(30):
        az=random.uniform(0,2*math.pi); r=random.uniform(20,80); z=random.uniform(-70,60)
        sphere(bm, r*math.cos(az), r*math.sin(az), z, 0.1+random.random()*0.1, segs=5, rings=4)
    finish("bioluminescence", bm, mat("m_biolume",(0.3,0.95,0.75), rough=0.3, emit=(0.3,0.95,0.75), estrength=2.8))

export(OUT)
