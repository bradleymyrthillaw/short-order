# Short Order asset pipeline -- GRIDDLE (grill station body)
# Run headless:  OUT=/path/griddle.glb blender --background --python make_griddle.py
#
# Sits ON the shared worktop, so it's modelled with z=0 at the counter surface and
# grows up; the game places the clone at y=SURF and keeps the dynamic heat glow /
# flame on top. Steel flat-top with a charcoal cook plate, back splash, grease
# trough and front control knobs. Low-poly + flat-shaded to match the game.
import bpy, bmesh, math, os
OUT = os.environ.get("OUT", "/tmp/griddle.glb")
bpy.ops.wm.read_factory_settings(use_empty=True)

def mat(name, rgb, rough=0.55, metal=0.5):
    m=bpy.data.materials.new(name); m.use_nodes=True
    b=m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value=(rgb[0],rgb[1],rgb[2],1.0)
    b.inputs["Roughness"].default_value=rough; b.inputs["Metallic"].default_value=metal
    m.use_backface_culling=False; return m

def finish(name, bm, material):
    me=bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob=bpy.data.objects.new(name,me); ob.data.materials.append(material)
    bpy.context.collection.objects.link(ob)
    for p in ob.data.polygons: p.use_smooth=False
    return ob

def box(bm, cx,cy,cz, sx,sy,sz):
    hx,hy,hz=sx/2,sy/2,sz/2
    v={}
    for dx in(-1,1):
        for dy in(-1,1):
            for dz in(-1,1):
                v[(dx,dy,dz)]=bm.verts.new((cx+dx*hx, cy+dy*hy, cz+dz*hz))
    F=[[(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1)],
       [(-1,-1,1),(-1,1,1),(1,1,1),(1,-1,1)],
       [(-1,-1,-1),(-1,1,-1),(-1,1,1),(-1,-1,1)],
       [(1,-1,-1),(1,-1,1),(1,1,1),(1,1,-1)],
       [(-1,-1,-1),(-1,-1,1),(1,-1,1),(1,-1,-1)],
       [(-1,1,-1),(1,1,-1),(1,1,1),(-1,1,1)]]
    for f in F: bm.faces.new([v[k] for k in f])

def cyl_y(bm, r, y0,y1, cx,cz, segs=12):    # knob: cylinder along -Y (points out the front)
    a0=[];a1=[]
    for i in range(segs):
        a=2*math.pi*i/segs
        a0.append(bm.verts.new((cx+r*math.cos(a), y0, cz+r*math.sin(a))))
        a1.append(bm.verts.new((cx+r*math.cos(a), y1, cz+r*math.sin(a))))
    for i in range(segs):
        j=(i+1)%segs; bm.faces.new((a0[i],a0[j],a1[j],a1[i]))
    c1=bm.verts.new((cx,y1,cz))
    for i in range(segs):
        j=(i+1)%segs; bm.faces.new((c1,a1[i],a1[j]))

W, D = 1.66, 1.06                # footprint (fits the 2.5-wide worktop, ~ old griddle 1.7x1.15)
m_steel = mat("m_steel",(0.24,0.27,0.31), rough=0.5, metal=0.6)
m_plate = mat("m_plate",(0.085,0.095,0.11), rough=0.42, metal=0.5)
m_knob  = mat("m_knob",(0.78,0.24,0.16), rough=0.5, metal=0.1)

# body
bm=bmesh.new(); box(bm, 0,0,0.14, W,D,0.28); finish("body", bm, m_steel)
# back splash (low wall along the back edge)
bm=bmesh.new(); box(bm, 0, D/2-0.05, 0.42, W, 0.08, 0.30); finish("splash", bm, m_steel)
# charcoal cook plate, slightly inset, sitting proud of the body
bm=bmesh.new(); box(bm, 0, -0.02, 0.31, W-0.16, D-0.28, 0.07); finish("plate", bm, m_plate)
# grease trough across the front of the plate
bm=bmesh.new(); box(bm, 0, -(D/2)+0.12, 0.30, W-0.34, 0.05, 0.05); finish("trough", bm, m_plate)
# front control knobs
bm=bmesh.new()
for cx in (-0.45, 0.0, 0.45):
    cyl_y(bm, 0.055, -(D/2), -(D/2)-0.07, cx, 0.11)
finish("knobs", bm, m_knob)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_apply=True)
print("WROTE", OUT)
