# Short Order sky pipeline -- CITY locale. Two attempts at a rooftop skyline
# with real per-building geometry (even textured) still read as too sparse --
# there's a hard ceiling on how many boxes are worth modelling. The actual
# game-art cheat: don't model the city at all. ONE cylinder wall, wrapped in
# ONE big painted skyline texture (numpy raster, unlimited "building" count
# since it's just pixels) with an alpha cutout above the rooflines so the sky
# dome shows through behind it. Two baked depth layers (hazy distant strip +
# darker looming near strip, drawn into the SAME image) fake the near/far
# read a real geometry ring gave without needing one. A handful of real 3D
# elements survive on top for pop: one signature spire+beacon and a
# searchlight beam -- everything else here is paint.
# Run headless:  OUT=/path/out.glb VARIANT=day|night blender --background --python make_sky_city.py
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sky_common import init, variant, mat, cone_z, finish, dome_bands, cylinder_wall, facade_mat_alpha, export
import bpy, bmesh, numpy as np

OUT=os.environ.get("OUT","/tmp/sky_city.glb")
V=variant()
init()
R=90.0
R_WALL=55.0     # the one skyline cylinder

if V=="day":
    bands=[
        (-5, 12, mat("b0",(0.72,0.78,0.84))),
        (12, 40, mat("b1",(0.46,0.60,0.82))),
        (40, 72, mat("b2",(0.26,0.44,0.78))),
        (72, 90, mat("b3",(0.14,0.30,0.64))),
    ]
    haze=(0.72,0.78,0.84)
    far_wall,far_win=(0.55,0.60,0.66),(0.30,0.36,0.44)
    near_walls=[(0.32,0.32,0.36),(0.40,0.30,0.24),(0.26,0.36,0.42),(0.36,0.36,0.40)]
    near_win=(0.14,0.18,0.24)
    far_lit,near_lit=0.75,0.75           # daytime "lit" = distinct glass panes, not glow
    beacon_emit=0.4; searchlight=False
else:
    bands=[
        (-5, 12, mat("b0",(0.10,0.09,0.14))),
        (12, 40, mat("b1",(0.05,0.045,0.10))),
        (40, 72, mat("b2",(0.03,0.03,0.07))),
        (72, 90, mat("b3",(0.012,0.012,0.04))),
    ]
    haze=(0.10,0.09,0.14)
    far_wall,far_win=(0.06,0.055,0.09),(0.55,0.48,0.35)
    near_walls=[(0.045,0.045,0.05),(0.04,0.035,0.04),(0.035,0.04,0.05),(0.045,0.04,0.045)]
    near_win=(1.0,0.82,0.35)
    far_lit,near_lit=0.20,0.42
    beacon_emit=2.6; searchlight=True

dome_bands(R, bands)

def lerp3(a,b,t): return tuple(a[i]+(b[i]-a[i])*t for i in range(3))
far_wall=lerp3(far_wall,haze,0.5)   # atmospheric perspective -- fade the distant layer toward the horizon colour
far_win=lerp3(far_win,haze,0.35)

# ---- the ONE skyline texture: two depth layers painted into one raster ----
W,H,CELL=1536,384,6
rng=np.random.default_rng(11 if V=="day" else 12)
img=np.zeros((H,W,4),dtype=np.float32)   # fully transparent -- alpha cutout lets the dome show through above the roofline

# wall_cols: either one (r,g,b) tuple or a list -- when a list, each building
# picks a random entry so the skyline shows real colour variety up close.
def draw_layer(img, rng, wall_cols, win_col, lit_frac, hmin, hmax, wmin, wmax, gap_prob, clutter_prob):
    cols_list = wall_cols if isinstance(wall_cols[0], (tuple,list)) else [wall_cols]
    m=max(1,int(CELL*0.16))
    x=0
    while x<W:
        if rng.random()<gap_prob:
            x+=int(rng.integers(wmin,wmax+1)); continue
        w=int(rng.integers(wmin,wmax+1)); h=int(rng.integers(hmin,hmax+1))
        x1=min(W,x+w)
        if x1<=x: break
        wall_col=cols_list[rng.integers(0,len(cols_list))]
        img[0:h, x:x1, 0]=wall_col[0]; img[0:h, x:x1, 1]=wall_col[1]; img[0:h, x:x1, 2]=wall_col[2]; img[0:h, x:x1, 3]=1.0
        cols=max(1,(x1-x)//CELL); rows=max(1,h//CELL)
        for r in range(rows):
            ry0,ry1=r*CELL+m,(r+1)*CELL-m
            if ry1<=ry0 or ry1>h: continue
            for c in range(cols):
                if rng.random()>=lit_frac: continue
                cx0,cx1=x+c*CELL+m, x+(c+1)*CELL-m
                if cx1<=cx0 or cx1>x1: continue
                img[ry0:ry1, cx0:cx1, 0]=win_col[0]; img[ry0:ry1, cx0:cx1, 1]=win_col[1]; img[ry0:ry1, cx0:cx1, 2]=win_col[2]
        if rng.random()<clutter_prob:                       # antenna or water-tower blob on the roof
            ccol=(wall_col[0]*0.6,wall_col[1]*0.6,wall_col[2]*0.6)
            if rng.random()<0.5:
                ah=int(rng.integers(14,30)); ax=(x+x1)//2; aw=max(2,CELL//3)
                img[h:h+ah, ax-aw//2:ax+aw//2, 0]=ccol[0]; img[h:h+ah, ax-aw//2:ax+aw//2, 1]=ccol[1]; img[h:h+ah, ax-aw//2:ax+aw//2, 2]=ccol[2]; img[h:h+ah, ax-aw//2:ax+aw//2, 3]=1.0
            else:
                tw=max(6,(x1-x)//3); tx=(x+x1)//2-tw//2
                img[h:h+10, tx:tx+tw, 0]=ccol[0]; img[h:h+10, tx:tx+tw, 1]=ccol[1]; img[h:h+10, tx:tx+tw, 2]=ccol[2]; img[h:h+10, tx:tx+tw, 3]=1.0
        x=x1

# hazy distant layer first (shorter, denser, near-continuous)
draw_layer(img, rng, far_wall, far_win, far_lit, hmin=30,hmax=130, wmin=18,wmax=42, gap_prob=0.04, clutter_prob=0.0)
# looming near layer on top, occluding the distant one where it overlaps -- real colour variety per building
draw_layer(img, rng, near_walls, near_win, near_lit, hmin=110,hmax=320, wmin=45,wmax=95, gap_prob=0.14, clutter_prob=0.30)

bimg=bpy.data.images.new("city_wall", width=W, height=H, alpha=True)
bimg.pixels=img.flatten().tolist(); bimg.pack()
m_wall=facade_mat_alpha("m_citywall", bimg, rough=0.85)

bm=bmesh.new()
cylinder_wall(bm, R_WALL, 0, 48, segs=64)
finish("citywall", bm, m_wall)

# ---- the few real 3D elements that survive: one signature spire+beacon, one searchlight ----
bm=bmesh.new()
cone_z(bm, 0.6, 0.06, 0, 40, R_WALL*0.55, R_WALL*0.2, segs=8)
finish("spire", bm, mat("m_spire", near_walls[0], rough=0.8))
bm=bmesh.new()
cone_z(bm, 0.25, 0.03, 40, 42, R_WALL*0.55, R_WALL*0.2)
finish("beacontip", bm, mat("m_beacon",(1.0,0.2,0.55), rough=0.2, emit=(1.0,0.2,0.55), estrength=beacon_emit))

if searchlight:
    bm=bmesh.new()
    m_beam=mat("m_beam",(0.75,0.85,1.0), rough=0.3, emit=(0.75,0.85,1.0), estrength=1.6)
    bx,by = R_WALL*0.7, -R_WALL*0.3
    cone_z(bm, 0.06, 2.4, 22, 82, bx, by, segs=10)
    finish("searchbeam", bm, m_beam)

export(OUT)
