# Short Order asset pipeline -- POTTED PLANT
# Run headless:  blender --background --python make_plant.py
# Output env:    OUT=/path/plant.glb  (default: scratch)
#
# Deliberately low-poly + flat-shaded, in the game's warm palette, so a Blender
# asset sits next to the procedural meshes without a style clash. No rendering
# happens here (pure geometry + materials -> GLB), which is the headless-safe path.
import bpy, bmesh, math, os

OUT = os.environ.get("OUT", "/tmp/plant.glb")

# ---------- clean slate ----------
bpy.ops.wm.read_factory_settings(use_empty=True)

def mat(name, rgb, rough=0.8, metal=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (rgb[0], rgb[1], rgb[2], 1.0)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    m.use_backface_culling = False          # -> glTF doubleSided (thin leaves visible both sides)
    return m

def finish(name, bm, material):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); ob.data.materials.append(material)
    bpy.context.collection.objects.link(ob)
    for p in ob.data.polygons: p.use_smooth = False   # flat shading = faceted low-poly look
    return ob

def frustum(bm, r0, r1, z0, z1, segs=18, cap0=True, cap1=False):
    bot=[]; top=[]
    for i in range(segs):
        a=2*math.pi*i/segs
        bot.append(bm.verts.new((r0*math.cos(a), r0*math.sin(a), z0)))
        top.append(bm.verts.new((r1*math.cos(a), r1*math.sin(a), z1)))
    for i in range(segs):
        j=(i+1)%segs; bm.faces.new((bot[i], bot[j], top[j], top[i]))
    if cap0:
        c=bm.verts.new((0,0,z0))
        for i in range(segs): j=(i+1)%segs; bm.faces.new((c, bot[j], bot[i]))
    if cap1:
        c=bm.verts.new((0,0,z1))
        for i in range(segs): j=(i+1)%segs; bm.faces.new((c, top[i], top[j]))
    return bot, top

def disc(bm, r, z, segs=18):
    c=bm.verts.new((0,0,z)); ring=[]
    for i in range(segs):
        a=2*math.pi*i/segs; ring.append(bm.verts.new((r*math.cos(a), r*math.sin(a), z)))
    for i in range(segs): j=(i+1)%segs; bm.faces.new((c, ring[i], ring[j]))

def leaf(bm, base, yaw, length, width, arch, segs=6):
    cy, sy = math.cos(yaw), math.sin(yaw)
    L=[]; R=[]
    for i in range(segs+1):
        t=i/segs
        horiz = length*t*(1.0-0.18*t)                       # slight foreshorten near the tip
        vert  = arch*math.sin(min(t*1.25,1.0)*math.pi*0.62) # arch up then level/droop
        w = width*(math.sin(math.pi*min(max(t,0.001),0.999))**0.55)  # widest mid-blade, points at ends
        def place(x,y,z):
            X=x*cy - y*sy; Y=x*sy + y*cy
            return (base[0]+X, base[1]+Y, base[2]+z)
        L.append(bm.verts.new(place(horiz, +w*0.5, vert)))
        R.append(bm.verts.new(place(horiz, -w*0.5, vert)))
    for i in range(segs):
        bm.faces.new((L[i], R[i], R[i+1], L[i+1]))

# ---------- POT ----------
bm=bmesh.new(); frustum(bm, 0.24, 0.32, 0.0, 0.40, cap0=True); pot=finish("pot", bm, mat("m_pot",(0.72,0.33,0.19)))
bm=bmesh.new(); frustum(bm, 0.32, 0.365, 0.36, 0.45, cap0=False); rim=finish("rim", bm, mat("m_rim",(0.60,0.27,0.15)))
bm=bmesh.new(); disc(bm, 0.30, 0.41); soil=finish("soil", bm, mat("m_soil",(0.10,0.07,0.05), rough=1.0))

# ---------- FOLIAGE ----------
mg = mat("m_leaf",(0.20,0.42,0.16)); mg2 = mat("m_leaf2",(0.31,0.55,0.21))
bm=bmesh.new(); bm2=bmesh.new()
N=11; base=(0.0,0.0,0.40)
for i in range(N):
    yaw = 2*math.pi*i/N + (0.21 if i%2 else -0.13)
    ln  = 0.62 + (0.16 if i%3==0 else 0.0)
    ar  = 0.52 + (0.12 if i%2 else 0.0)
    leaf(bm if i%2 else bm2, base, yaw, ln, 0.15, ar)
# a few short inner leaves standing up
for i in range(4):
    yaw=2*math.pi*i/4 + 0.4
    leaf(bm2, (0,0,0.44), yaw, 0.34, 0.11, 0.5)
finish("leaves_a", bm, mg); finish("leaves_b", bm2, mg2)

# ---------- export ----------
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_apply=True)
print("WROTE", OUT)
