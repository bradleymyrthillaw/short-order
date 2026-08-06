#!/usr/bin/env python3
# Short Order -- WARP SPEED sky locale, emitted WITHOUT Blender.
#
# This is the no-Blender fallback for tools/blender/make_sky_warp.py: it
# builds the exact same scene (same palettes, counts, random seeds, call
# order) and writes two self-contained GLBs --
#   public/short-order/assets/sky_warp_day.glb
#   public/short-order/assets/sky_warp_night.glb
# -- then injects them into assets.gen.js in the same registry format
# build.sh's bake step produces (json.dumps default separators), leaving
# every pre-existing base64 payload byte-identical. On a machine with
# Blender, `bash tools/blender/build.sh` regenerates the same art through
# the canonical pipeline; the output here is the same format the game's
# GLTFLoader (three r128) already consumes for the other five locales.
#
# Usage:  python3 tools/blender/sky_warp_glb.py [assets_dir] [assets.gen.js]
import struct, json, base64, os, math, random, re, sys

ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))   # .../short-order
DEFAULT_ASSETS=os.path.join(ROOT,"public","short-order","assets")
DEFAULT_GEN=os.path.join(ROOT,"public","short-order","assets.gen.js")

# ---------------- geometry (same math as make_sky_warp.py) ----------------

def cross3(a,b): return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])
def norm3(v):
    n=math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2])
    return (v[0]/n, v[1]/n, v[2]/n) if n else (0.0,0.0,0.0)

class Mesh(object):
    def __init__(self, name, material):
        self.name=name; self.material=material; self.faces=[]   # tuples of (x,y,z) coords
    def face(self, coords): self.faces.append(tuple(coords))

def frame(d):
    d=[float(x) for x in d]
    ax=0 if abs(d[0])<=abs(d[1]) and abs(d[0])<=abs(d[2]) else (1 if abs(d[1])<=abs(d[2]) else 2)
    a=[0,0,0]; a[ax]=1.0
    e1=[a[1]*d[2]-a[2]*d[1], a[2]*d[0]-a[0]*d[2], a[0]*d[1]-a[1]*d[0]]
    n=math.sqrt(sum(c*c for c in e1)); e1=[c/n for c in e1]
    e2=[d[1]*e1[2]-d[2]*e1[1], d[2]*e1[0]-d[0]*e1[2], d[0]*e1[1]-d[1]*e1[0]]
    return e1,e2,d

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

def dome_bands(radius, bands, mat0):
    segs=24; meshes=[]
    for idx,(e0,e1,_color) in enumerate(bands):
        mb=Mesh("skyband%d"%idx, mat0+idx)
        a0=math.radians(e0); a1=math.radians(e1)
        r0=radius*math.cos(a0); z0=radius*math.sin(a0)
        r1=radius*math.cos(a1); z1=radius*math.sin(a1)
        ring0=[]; ring1=[]
        for i in range(segs):
            t=2*math.pi*i/segs
            ring0.append((r0*math.cos(t), r0*math.sin(t), z0))
            ring1.append((r1*math.cos(t), r1*math.sin(t), z1))
        for i in range(segs):
            j=(i+1)%segs
            mb.face([ring0[i],ring0[j],ring1[j],ring1[i]])
        if e1>=89.9:
            top=(0,0,z1)
            for i in range(segs):
                j=(i+1)%segs
                mb.face([ring1[i],ring1[j],top])
        if e0<=-89.9:
            bot=(0,0,z0)
            for i in range(segs):
                j=(i+1)%segs
                mb.face([ring0[j],ring0[i],bot])
        meshes.append(mb)
    return meshes

def sphere_mesh(name, mat, cx,cy,cz, r, segs=10, rings=6):
    mb=Mesh(name, mat)
    top=(cx,cy,cz+r); bot=(cx,cy,cz-r)
    rows=[]
    for ri in range(1,rings):
        phi=math.pi*ri/rings
        rr=r*math.sin(phi); zz=r*math.cos(phi)
        row=[]
        for i in range(segs):
            a=2*math.pi*i/segs
            row.append((cx+rr*math.cos(a), cy+rr*math.sin(a), cz+zz))
        rows.append(row)
    for i in range(segs):
        j=(i+1)%segs
        mb.face([top, rows[0][i], rows[0][j]])
        mb.face([bot, rows[-1][j], rows[-1][i]])
    for ri in range(len(rows)-1):
        for i in range(segs):
            j=(i+1)%segs
            mb.face([rows[ri][i],rows[ri][j],rows[ri+1][j],rows[ri+1][i]])
    return mb

# ---------------- scene (same constants as make_sky_warp.py) ----------------

def build_scene(variant):
    R=90.0
    if variant=="day":
        bands=[(-5,15,(0.22,0.17,0.52)), (15,45,(0.14,0.11,0.40)),
               (45,75,(0.09,0.07,0.28)), (75,90,(0.04,0.035,0.13))]
        STREAK_N=26; STREAK_L=(1.4,2.8); SHARD_N=6
        random.seed(17)
    else:
        bands=[(-5,15,(0.15,0.11,0.36)), (15,45,(0.10,0.08,0.28)),
               (45,75,(0.06,0.05,0.18)), (75,90,(0.025,0.022,0.07))]
        STREAK_N=58; STREAK_L=(1.8,3.6); SHARD_N=8
        random.seed(31)

    materials=[{"name":"b%d"%i,"base":bands[i][2],"rough":0.85} for i in range(4)]
    materials.append({"name":"m_streakwhite","base":(0.90,0.92,1.00),"rough":0.2,"emit":(0.10,0.08,0.00)})
    materials.append({"name":"m_streakblue", "base":(0.62,0.69,1.00),"rough":0.2})
    materials.append({"name":"m_streakamber","base":(1.00,0.85,0.66),"rough":0.2})
    materials.append({"name":"m_shard","base":(0.30,0.22,0.55),"rough":0.6,"emit":(0.42,0.40,0.60)})
    materials.append({"name":"m_comet","base":(0.85,0.95,1.00),"rough":0.2,"emit":(0.15,0.05,0.00)})
    materials.append({"name":"m_tail","base":(0.62,0.68,0.95),"rough":0.4,"emit":(0.10,0.15,0.05)})

    meshes=dome_bands(R, bands, 0)

    # star streaks (materials 4..6), same random call order as the Blender script
    for ci in range(3):
        mb=Mesh(["streakwhite","streakblue","streakamber"][ci], 4+ci)
        meshes.append(mb)
    for _ in range(STREAK_N):
        el=math.radians(random.uniform(8,85)); az=random.uniform(0,2*math.pi)
        d=[math.cos(el)*math.cos(az), math.cos(el)*math.sin(az), math.sin(el)]
        e1,e2,e3=frame(d)
        big=random.random()<0.16
        L=random.uniform(*STREAK_L)*(2.2 if big else 1.0)
        th=random.uniform(0.09,0.16)
        ci=int(random.random()*3)
        p=[d[0]*R*0.95, d[1]*R*0.95, d[2]*R*0.95]
        verts=box_verts(p,e1,e2,e3,th/2,th/2,L/2)
        mb=meshes[4+ci]
        for f in BOX_FACES:
            mb.face([verts[k] for k in f])

    # crystal shards (material 7)
    mb=Mesh("shards", 7); meshes.append(mb)
    for _ in range(SHARD_N):
        el=math.radians(random.uniform(10,78)); az=random.uniform(0,2*math.pi)
        d=[math.cos(el)*math.cos(az), math.cos(el)*math.sin(az), math.sin(el)]
        e1,e2,e3=frame(d)
        tilt=random.uniform(-0.35,0.35)
        ct,st=math.cos(tilt),math.sin(tilt)
        e2t=[e2[0]*ct-e3[0]*st, e2[1]*ct-e3[1]*st, e2[2]*ct-e3[2]*st]
        e3t=[e2[0]*st+e3[0]*ct, e2[1]*st+e3[1]*ct, e2[2]*st+e3[2]*ct]
        r0=random.uniform(0.5,0.9); h=random.uniform(2.2,4.2)
        p=[d[0]*R*0.88, d[1]*R*0.88, d[2]*R*0.88]
        base=[]
        for i in range(4):
            a=2*math.pi*i/4
            base.append((p[0]+e1[0]*r0*math.cos(a)+e2t[0]*r0*math.sin(a),
                         p[1]+e1[1]*r0*math.cos(a)+e2t[1]*r0*math.sin(a),
                         p[2]+e1[2]*r0*math.cos(a)+e2t[2]*r0*math.sin(a)))
        tip=(p[0]+e3t[0]*h, p[1]+e3t[1]*h, p[2]+e3t[2]*h)
        for i in range(4):
            j=(i+1)%4; mb.face([base[i],base[j],tip])

    # comet (materials 8, 9)
    head=(R*0.62, -R*0.48, 36)
    meshes.append(sphere_mesh("comethead", 8, head[0],head[1],head[2], 1.6, segs=8, rings=6))
    mb=Mesh("comettail", 9); meshes.append(mb)
    for i in range(1,6):
        t=i/5.0
        tail=sphere_mesh("tailpuff", 9, head[0]-t*10, head[1]+t*4, head[2]-t*6,
                         1.4*(1-t*0.8), segs=6, rings=4)
        mb.faces.extend(tail.faces)

    return meshes, materials

# ---------------- GLB assembly ----------------

def flatten(mesh):
    positions=[]; normals=[]; indices=[]
    for f in mesh.faces:
        for i in range(1, len(f)-1):                       # fan triangulation
            tri=(f[0], f[i], f[i+1])
            n=norm3(cross3((tri[1][0]-tri[0][0], tri[1][1]-tri[0][1], tri[1][2]-tri[0][2]),
                           (tri[2][0]-tri[0][0], tri[2][1]-tri[0][1], tri[2][2]-tri[0][2])))
            base=len(positions)
            positions.extend(tri); normals.extend((n,n,n)); indices.extend((base,base+1,base+2))
    return positions, normals, indices

def build_glb(meshes, materials):
    mat_json=[]
    for m in materials:
        mj={"doubleSided": True, "name": m["name"],
            "pbrMetallicRoughness": {"baseColorFactor": [m["base"][0],m["base"][1],m["base"][2],1.0],
                                     "metallicFactor": 0.0,
                                     "roughnessFactor": m.get("rough",0.85)}}
        if m.get("emit"): mj["emissiveFactor"]=[m["emit"][0],m["emit"][1],m["emit"][2]]
        mat_json.append(mj)

    buffer_views=[]; accessors=[]; meshes_json=[]; nodes_json=[]; bin_parts=[]
    offset=0

    def add_view(data, target):
        nonlocal offset
        pad=(-len(data))%4
        if pad: data=data+b"\x00"*pad
        view={"buffer":0,"byteLength":len(data),"byteOffset":offset}
        if target: view["target"]=target
        buffer_views.append(view); bin_parts.append(data)
        offset+=len(data)
        return len(buffer_views)-1

    for mi,mesh in enumerate(meshes):
        pos,nor,idx=flatten(mesh)
        if not idx: continue
        pos_min=[min(p[k] for p in pos) for k in range(3)]
        pos_max=[max(p[k] for p in pos) for k in range(3)]
        pos_b=struct.pack("<%df"%(len(pos)*3), *[c for p in pos for c in p])
        nor_b=struct.pack("<%df"%(len(nor)*3), *[c for n in nor for c in n])
        idx_b=struct.pack("<%dH"%len(idx), *idx)
        vp=add_view(pos_b, 34962)
        accessors.append({"bufferView":vp,"componentType":5126,"count":len(pos),"type":"VEC3",
                          "min":pos_min,"max":pos_max})
        apos=len(accessors)-1
        vn=add_view(nor_b, 34962)
        accessors.append({"bufferView":vn,"componentType":5126,"count":len(nor),"type":"VEC3"})
        anor=len(accessors)-1
        vi=add_view(idx_b, 34963)
        accessors.append({"bufferView":vi,"componentType":5123,"count":len(idx),"type":"SCALAR"})
        aidx=len(accessors)-1
        meshes_json.append({"name":mesh.name,"primitives":[{"attributes":{"POSITION":apos,"NORMAL":anor},
                                                            "indices":aidx,"material":mesh.material}]})
        nodes_json.append({"mesh":len(meshes_json)-1,"name":mesh.name})

    j={"asset":{"generator":"short-order tools/blender/sky_warp_glb.py (no-Blender fallback; same design as make_sky_warp.py)",
                "version":"2.0"},
       "scene":0,"scenes":[{"name":"Scene","nodes":list(range(len(nodes_json)))}],
       "nodes":nodes_json,"meshes":meshes_json,"materials":mat_json,
       "buffers":[{"byteLength":offset}],"bufferViews":buffer_views,"accessors":accessors}
    js=json.dumps(j,separators=(",",":"))
    js+=" "*(-len(js)%4)
    bin_b=b"".join(bin_parts)
    header=struct.pack("<III", 0x46546c67, 2, 12+8+len(js)+8+len(bin_b))
    return header+struct.pack("<II",len(js),0x4E4F534A)+js.encode()+struct.pack("<II",len(bin_b),0x004E4942)+bin_b

# ---------------- assets.gen.js injection (same format as build.sh) ----------------

def bake(gen, assets_dir):
    with open(gen,"r") as f: src=f.read()
    m=re.match(r"(//[^\n]*\n)window\.SO_ASSETS=(\{.*\});\s*$", src, re.S)
    if not m:
        raise SystemExit("unexpected assets.gen.js layout -- refusing to rewrite")
    data=json.loads(m.group(2))
    for key in ("sky_warp_day","sky_warp_night"):
        with open(os.path.join(assets_dir, key+".glb"),"rb") as f:
            data[key]="data:model/gltf-binary;base64,"+base64.b64encode(f.read()).decode()
    with open(gen,"w") as f:
        f.write(m.group(1)+"window.SO_ASSETS="+json.dumps(data)+";\n")
    print("wrote", gen, "(added sky_warp_day, sky_warp_night; %d keys total)"%len(data))

def main():
    assets_dir=sys.argv[1] if len(sys.argv)>1 else DEFAULT_ASSETS
    gen=sys.argv[2] if len(sys.argv)>2 else DEFAULT_GEN
    os.makedirs(assets_dir, exist_ok=True)
    for v in ("day","night"):
        meshes,mats=build_scene(v)
        glb=build_glb(meshes,mats)
        path=os.path.join(assets_dir,"sky_warp_%s.glb"%v)
        with open(path,"wb") as f: f.write(glb)
        print("wrote", path, "(%d bytes, %d meshes)"%(len(glb), len(meshes)))
    bake(gen, assets_dir)

if __name__=="__main__":
    main()
