# Short Order sky pipeline -- OCEAN locale (the original bay-at-dusk backdrop).
# Run headless:  OUT=/path/out.glb VARIANT=day|night blender --background --python make_sky_ocean.py
#
# Bakes just the DOME as a banded gradient (the sea/sun/island/boat/palms stay
# procedural JS -- buildOcean() already does those well and they're cheap).
# Radius 90 to match the dome buildOcean() replaces.
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sky_common import init, variant, mat, sphere, finish, dome_bands, export
import bmesh

OUT=os.environ.get("OUT","/tmp/sky_ocean.glb")
V=variant()
init()
R=90.0

if V=="day":
    bands=[
        (-5, 10, mat("b0",(0.86,0.66,0.45))),     # warm horizon haze
        (10, 30, mat("b1",(0.55,0.68,0.86))),     # bright midday blue rising
        (30, 60, mat("b2",(0.32,0.52,0.82))),
        (60, 90, mat("b3",(0.16,0.34,0.68))),     # deep zenith blue
    ]
    sun_col=(1.0,0.93,0.72); sun_emit=3.2
else:
    bands=[
        (-5, 10, mat("b0",(0.22,0.12,0.16))),     # dying warm horizon glow
        (10, 30, mat("b1",(0.08,0.08,0.20))),
        (30, 60, mat("b2",(0.045,0.045,0.13))),
        (60, 90, mat("b3",(0.02,0.02,0.06))),     # near-black zenith
    ]
    sun_col=(0.85,0.88,0.96); sun_emit=1.6

dome_bands(R, bands)

# sun (day) / moon (night), low on the horizon opposite the entry (matches
# buildOcean's AZ_SUN = back wall, +Z=0 bearing -> world -Z-ish; a Blender-local
# placement just needs to read plausibly on the horizon, JS keeps exact bearing
# alignment for the procedural sun/glow discs it still draws on top)
bm=bmesh.new()
sphere(bm, 0, R*0.94, 6.5, 3.6, segs=12, rings=8)
finish("orb", bm, mat("m_orb", sun_col, rough=0.3, metal=0.0, emit=sun_col, estrength=sun_emit))

if V=="night":
    # scattered stars, upper bands only
    random.seed(2)
    bm=bmesh.new()
    for _ in range(50):
        el=math.radians(random.uniform(20,88))
        az=random.uniform(0,2*math.pi)
        r=R*0.97*math.cos(el); z=R*0.97*math.sin(el)
        sphere(bm, r*math.cos(az), r*math.sin(az), z, 0.16+random.random()*0.14, segs=5, rings=4)
    finish("stars", bm, mat("m_star",(1,1,1), rough=0.2, emit=(1,1,0.95), estrength=2.2))

export(OUT)
