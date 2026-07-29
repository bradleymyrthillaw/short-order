# Short Order asset pipeline -- FRYER (fry station body)
# Run headless:  OUT=/path/fryer.glb blender --background --python make_fryer.py
#
# Sits ON the shared worktop, so it's modelled with z=0 at the counter surface and
# grows up; the game places the clone at y=SURF and keeps the dynamic heat glow /
# flame on top (see buildAppliance's s.kind==='cook' branch). Steel oil vat with a
# recessed golden oil surface, a wire basket poking half out of the oil, a lift
# handle and a single thermostat knob. Low-poly + flat-shaded to match the game.
import bpy, bmesh, math, os
OUT = os.environ.get("OUT", "/tmp/fryer.glb")
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

def cyl_between(bm, p0, p1, r, segs=8):     # handle rod: cylinder between two arbitrary points
    import mathutils
    p0=mathutils.Vector(p0); p1=mathutils.Vector(p1)
    axis=(p1-p0); length=axis.length; axis.normalize()
    ref=mathutils.Vector((0,0,1)) if abs(axis.z)<0.9 else mathutils.Vector((1,0,0))
    t=axis.cross(ref).normalized(); b=axis.cross(t).normalized()
    a0=[];a1=[]
    for i in range(segs):
        a=2*math.pi*i/segs
        off=t*(r*math.cos(a))+b*(r*math.sin(a))
        a0.append(bm.verts.new(tuple(p0+off)))
        a1.append(bm.verts.new(tuple(p1+off)))
    for i in range(segs):
        j=(i+1)%segs; bm.faces.new((a0[i],a0[j],a1[j],a1[i]))
    c0=bm.verts.new(tuple(p0)); c1=bm.verts.new(tuple(p1))
    for i in range(segs):
        j=(i+1)%segs
        bm.faces.new((c0,a0[j],a0[i]))
        bm.faces.new((c1,a1[i],a1[j]))

W, D = 1.32, 1.05                # footprint, close kin to the griddle's 1.66x1.06
m_steel = mat("m_steel",(0.22,0.24,0.28), rough=0.5, metal=0.6)
m_trim  = mat("m_trim", (0.62,0.65,0.7),  rough=0.35, metal=0.75)
m_oil   = mat("m_oil",  (0.94,0.69,0.16), rough=0.12, metal=0.0)
m_mesh  = mat("m_mesh", (0.5,0.53,0.57),  rough=0.35, metal=0.7)
m_knob  = mat("m_knob", (0.78,0.24,0.16), rough=0.5, metal=0.1)

# vat body
bm=bmesh.new(); box(bm, 0,0,0.30, W,D,0.60); finish("body", bm, m_steel)
# top rim / flange
bm=bmesh.new(); box(bm, 0,0,0.615, W+0.06,D+0.06,0.03); finish("rim", bm, m_trim)
# recessed golden oil surface
bm=bmesh.new(); box(bm, 0,0.02,0.575, W-0.30,D-0.27,0.05); finish("oil", bm, m_oil)
# wire basket, half-submerged, sitting a touch forward
bm=bmesh.new(); box(bm, 0,0.18,0.66, 0.58,0.44,0.22); finish("basket", bm, m_mesh)
# lift handle: up from the basket's back edge, then a horizontal grip bar
bm=bmesh.new()
cyl_between(bm, (0,0.0,0.72), (0,0.0,1.02), 0.028)
cyl_between(bm, (-0.16,0.0,1.02), (0.16,0.0,1.02), 0.028)
finish("handle", bm, m_trim)
# front control panel + thermostat knob
bm=bmesh.new(); box(bm, 0, -D/2-0.02, 0.42, W-0.1, 0.05, 0.30); finish("panel", bm, m_steel)
bm=bmesh.new(); cyl_y(bm, 0.06, -(D/2)-0.02, -(D/2)-0.09, 0.0, 0.42); finish("knob", bm, m_knob)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_apply=True)
print("WROTE", OUT)
