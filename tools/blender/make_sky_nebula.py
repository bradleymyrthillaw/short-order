# Short Order sky pipeline -- NEBULA locale (deep space: clouds, a ringed
# planet, a moon, a comet). Day = closer/warmer & brighter; night = deeper,
# darker space with more visible stars. "Day" is a loose concept out here --
# it's still space, just a sunlit pass vs. the deep dark between worlds.
# Run headless:  OUT=/path/out.glb VARIANT=day|night blender --background --python make_sky_nebula.py
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sky_common import init, variant, mat, sphere, ring_torus, finish, dome_bands, export
import bmesh

OUT=os.environ.get("OUT","/tmp/sky_nebula.glb")
V=variant()
init()
R=90.0

if V=="day":
    bands=[
        (-5, 15, mat("b0",(0.42,0.18,0.42))),
        (15, 45, mat("b1",(0.30,0.14,0.46))),
        (45, 75, mat("b2",(0.16,0.10,0.38))),
        (75, 90, mat("b3",(0.08,0.06,0.24))),
    ]
    planet_col=(0.86,0.52,0.30); star_n=25; star_e=1.4
else:
    bands=[
        (-5, 15, mat("b0",(0.16,0.06,0.20))),
        (15, 45, mat("b1",(0.09,0.05,0.20))),
        (45, 75, mat("b2",(0.05,0.04,0.14))),
        (75, 90, mat("b3",(0.02,0.02,0.06))),
    ]
    planet_col=(0.55,0.34,0.62); star_n=70; star_e=2.4

dome_bands(R, bands)

# nebula cloud blobs -- soft-edged is out (flat-shaded low-poly), so we fake
# volume with a scatter of translucent-looking (but opaque, unlit) emissive
# puffs at varied size/height
random.seed(7)
cloud_cols=[(0.62,0.22,0.55),(0.30,0.32,0.72),(0.70,0.30,0.40)] if V=="day" else [(0.30,0.10,0.34),(0.14,0.14,0.42),(0.34,0.14,0.24)]
for ci,col in enumerate(cloud_cols):
    bm=bmesh.new()
    m=mat("m_cloud%d"%ci, col, rough=0.9, emit=col, estrength=0.5)
    for _ in range(9):
        el=math.radians(random.uniform(15,80)); az=random.uniform(0,2*math.pi)
        r=R*0.9*math.cos(el); z=R*0.9*math.sin(el)
        sphere(bm, r*math.cos(az)+random.uniform(-6,6), r*math.sin(az)+random.uniform(-6,6), z+random.uniform(-4,4),
               3.0+random.random()*4.5, segs=8, rings=5)
    finish("cloud%d"%ci, bm, m)

# ringed planet, off to one side
bm=bmesh.new()
sphere(bm, R*0.55, R*0.55, 22, 7.5, segs=14, rings=9)
finish("planet", bm, mat("m_planet", planet_col, rough=0.6, emit=planet_col, estrength=0.35))
bm=bmesh.new()
ring_torus(bm, R*0.55, R*0.55, 22, 13.5, 1.1, tilt=0.4)
finish("planetring", bm, mat("m_ring",(0.82,0.74,0.62), rough=0.7, emit=(0.82,0.74,0.62), estrength=0.25))

# a small moon
bm=bmesh.new()
sphere(bm, -R*0.5, R*0.45, 34, 4.2, segs=10, rings=6)
finish("moon", bm, mat("m_moon",(0.78,0.78,0.82), rough=0.8, emit=(0.78,0.78,0.82), estrength=0.4))

# comet: a bright head + a short tail of shrinking puffs
bm=bmesh.new()
head=(R*0.3, R*0.75, 40)
sphere(bm, head[0], head[1], head[2], 1.6, segs=8, rings=6)
finish("comethead", bm, mat("m_comet",(0.85,0.95,1.0), rough=0.2, emit=(0.85,0.95,1.0), estrength=3.0))
bm=bmesh.new()
mtail=mat("m_tail",(0.6,0.75,0.9), rough=0.4, emit=(0.6,0.75,0.9), estrength=1.2)
for i in range(1,6):
    t=i/5.0
    sphere(bm, head[0]-t*10, head[1]-t*4, head[2]-t*6, 1.4*(1-t*0.8), segs=6, rings=4)
finish("comettail", bm, mtail)

# background stars
bm=bmesh.new()
for _ in range(star_n):
    el=math.radians(random.uniform(10,88)); az=random.uniform(0,2*math.pi)
    r=R*0.97*math.cos(el); z=R*0.97*math.sin(el)
    sphere(bm, r*math.cos(az), r*math.sin(az), z, 0.14+random.random()*0.12, segs=5, rings=4)
finish("stars", bm, mat("m_star",(1,1,1), rough=0.2, emit=(1,1,1), estrength=star_e))

export(OUT)
