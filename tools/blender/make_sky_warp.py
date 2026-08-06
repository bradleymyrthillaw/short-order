# Short Order sky pipeline -- WARP SPEED locale (deep space at warp: a violet
# void with star streaks rushing past, floating crystal shards, a comet).
#
# The 2D sibling (culinary-dash ENVS[5] / envWarp) paints this locale as a
# deep violet gradient (#07051a -> #141040 -> #241a5e) with horizontal star
# streaks, a vacuum sky (its glass stays clean), crystal-shard plants
# (#3d2f7a/#7a5fd6/#c6aeff) and floating hard-light tables. This bake keeps
# that identity: banded violet dome, radial warp streaks (static motion
# lines -- the dome can't animate, but lines pointing away from the sky's
# centre read as rushing), glowing crystal shards, and the same
# comet-with-tail the 2D window view gives NEBULA/WARP. Day is a brighter
# "sunlit" pass through the void; night is deep dark with more streaks.
#
# Same design as tools/blender/sky_warp_glb.py (the no-Blender fallback that
# emits these GLBs directly) -- keep the palettes/counts in the two files in
# sync; only the bpy/bmesh plumbing differs.
# Run headless:  OUT=/path/out.glb VARIANT=day|night blender --background --python make_sky_warp.py
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sky_common import init, variant, mat, sphere, finish, dome_bands, export
import bmesh

OUT=os.environ.get("OUT","/tmp/sky_warp.glb")
V=variant()
init()
R=90.0

if V=="day":
    bands=[
        (-5, 15, mat("b0",(0.22,0.17,0.52))),
        (15, 45, mat("b1",(0.14,0.11,0.40))),
        (45, 75, mat("b2",(0.09,0.07,0.28))),
        (75, 90, mat("b3",(0.04,0.035,0.13))),
    ]
    STREAK_N=26; STREAK_L=(1.4,2.8); SHARD_N=6
    random.seed(17)
else:
    bands=[
        (-5, 15, mat("b0",(0.15,0.11,0.36))),
        (15, 45, mat("b1",(0.10,0.08,0.28))),
        (45, 75, mat("b2",(0.06,0.05,0.18))),
        (75, 90, mat("b3",(0.025,0.022,0.07))),
    ]
    STREAK_N=58; STREAK_L=(1.8,3.6); SHARD_N=8
    random.seed(31)

dome_bands(R, bands)

# orthonormal right-handed frame with local +Z along unit direction d
def frame(d):
    d=[float(x) for x in d]
    ax=0 if abs(d[0])<=abs(d[1]) and abs(d[0])<=abs(d[2]) else (1 if abs(d[1])<=abs(d[2]) else 2)
    a=[0,0,0]; a[ax]=1.0
    e1=[a[1]*d[2]-a[2]*d[1], a[2]*d[0]-a[0]*d[2], a[0]*d[1]-a[1]*d[0]]
    n=math.sqrt(sum(c*c for c in e1)); e1=[c/n for c in e1]
    e2=[d[1]*e1[2]-d[2]*e1[1], d[2]*e1[0]-d[0]*e1[2], d[0]*e1[1]-d[1]*e1[0]]
    return e1,e2,d

# world-space corners of a box centred on p, local axes e1/e2/e3,
# half-extents hx/hy/hz -- same corner order as sky_common.box
def box_verts(p, e1, e2, e3, hx, hy, hz):
    out=[]
    for dx in (-1,1):
        for dy in (-1,1):
            for dz in (-1,1):
                out.append((p[0]+e1[0]*dx*hx+e2[0]*dy*hy+e3[0]*dz*hz,
                            p[1]+e1[1]*dx*hx+e2[1]*dy*hy+e3[1]*dz*hz,
                            p[2]+e1[2]*dx*hx+e2[2]*dy*hy+e3[2]*dz*hz))
    return out
BOX_FACES=[(0,1,2,3),(4,7,6,5),(0,3,7,4),(1,5,6,2),(0,4,5,1),(3,2,6,7)]

# ---- star streaks: thin elongated boxes rushing radially outward ----
# material split mirrors the 2D star colours (#ffffff / #cfe0ff / #ffd9a8);
# the ~16% "big" stars get a 2.2x longer trail, like the 2D big-star streak.
streak_mats=[
    ("streakwhite",(0.90,0.92,1.00),(0.10,0.08,0.00)),
    ("streakblue", (0.62,0.69,1.00),None),
    ("streakamber",(1.00,0.85,0.66),None),
]
bms=[bmesh.new() for _ in streak_mats]
for _ in range(STREAK_N):
    el=math.radians(random.uniform(8,85)); az=random.uniform(0,2*math.pi)
    d=[math.cos(el)*math.cos(az), math.cos(el)*math.sin(az), math.sin(el)]
    e1,e2,e3=frame(d)
    big=random.random()<0.16
    L=random.uniform(*STREAK_L)*(2.2 if big else 1.0)
    th=random.uniform(0.09,0.16)
    ci=int(random.random()*3)
    p=[d[0]*R*0.95, d[1]*R*0.95, d[2]*R*0.95]
    verts=[bms[ci].verts.new(v) for v in box_verts(p,e1,e2,e3,th/2,th/2,L/2)]
    for f in BOX_FACES:
        bms[ci].faces.new(tuple(verts[k] for k in f))
for ci,(name,base,emit) in enumerate(streak_mats):
    finish(name, bms[ci], mat("m_"+name, base, rough=0.2, emit=emit, estrength=1.0 if emit else 0.0))

# ---- crystal shards: glowing violet pyramids (the warp locale's "plant") ----
bm=bmesh.new()
for _ in range(SHARD_N):
    el=math.radians(random.uniform(10,78)); az=random.uniform(0,2*math.pi)
    d=[math.cos(el)*math.cos(az), math.cos(el)*math.sin(az), math.sin(el)]
    e1,e2,e3=frame(d)
    tilt=random.uniform(-0.35,0.35)                      # not every shard dead-radial
    ct,st=math.cos(tilt),math.sin(tilt)
    e2t=[e2[0]*ct-e3[0]*st, e2[1]*ct-e3[1]*st, e2[2]*ct-e3[2]*st]
    e3t=[e2[0]*st+e3[0]*ct, e2[1]*st+e3[1]*ct, e2[2]*st+e3[2]*ct]
    r0=random.uniform(0.5,0.9); h=random.uniform(2.2,4.2)
    p=[d[0]*R*0.88, d[1]*R*0.88, d[2]*R*0.88]
    base=[]
    for i in range(4):
        a=2*math.pi*i/4
        base.append(bm.verts.new((p[0]+e1[0]*r0*math.cos(a)+e2t[0]*r0*math.sin(a),
                                  p[1]+e1[1]*r0*math.cos(a)+e2t[1]*r0*math.sin(a),
                                  p[2]+e1[2]*r0*math.cos(a)+e2t[2]*r0*math.sin(a))))
    tip=bm.verts.new((p[0]+e3t[0]*h, p[1]+e3t[1]*h, p[2]+e3t[2]*h))
    for i in range(4):
        j=(i+1)%4; bm.faces.new((base[i],base[j],tip))
finish("shards", bm, mat("m_shard",(0.30,0.22,0.55), rough=0.6, emit=(0.42,0.40,0.60), estrength=1.0))

# ---- comet with a tail (the 2D window view gives NEBULA/WARP one) ----
bm=bmesh.new()
head=(R*0.62, -R*0.48, 36)
sphere(bm, head[0], head[1], head[2], 1.6, segs=8, rings=6)
finish("comethead", bm, mat("m_comet",(0.85,0.95,1.0), rough=0.2, emit=(0.15,0.05,0.0), estrength=1.0))
bm=bmesh.new()
mtail=mat("m_tail",(0.62,0.68,0.95), rough=0.4, emit=(0.10,0.15,0.05), estrength=1.0)
for i in range(1,6):
    t=i/5.0
    sphere(bm, head[0]-t*10, head[1]+t*4, head[2]-t*6, 1.4*(1-t*0.8), segs=6, rings=4)
finish("comettail", bm, mtail)

export(OUT)
