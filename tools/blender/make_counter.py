# Short Order asset pipeline -- COUNTERTOP BASE (the shared worktop unit)
# OUT=/path/counterbase.glb blender --background --python make_counter.py
#
# Neutral cabinet + a chunky worktop with a chamfered front/back edge (reads as a
# stone/butcher slab instead of a flat box). Front-back symmetric so it doesn't
# care about import orientation. The game keeps the per-station accent FRONT panel
# + lip procedural on top of this, so the colour-coded identifier survives.
# Width == CELL (2.5) so adjacent units stay flush into one continuous line.
import bpy, bmesh, math, os
OUT = os.environ.get("OUT", "/tmp/counterbase.glb")
bpy.ops.wm.read_factory_settings(use_empty=True)

CELL = 2.5
SURF = 1.12   # worktop top surface (must match the game constant)

def mat(name, rgb, rough=0.7, metal=0.15):
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
    hx,hy,hz=sx/2,sy/2,sz/2; v={}
    for dx in(-1,1):
        for dy in(-1,1):
            for dz in(-1,1): v[(dx,dy,dz)]=bm.verts.new((cx+dx*hx,cy+dy*hy,cz+dz*hz))
    F=[[(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1)],[(-1,-1,1),(-1,1,1),(1,1,1),(1,-1,1)],
       [(-1,-1,-1),(-1,1,-1),(-1,1,1),(-1,-1,1)],[(1,-1,-1),(1,-1,1),(1,1,1),(1,1,-1)],
       [(-1,-1,-1),(-1,-1,1),(1,-1,1),(1,-1,-1)],[(-1,1,-1),(1,1,-1),(1,1,1),(-1,1,1)]]
    for f in F: bm.faces.new([v[k] for k in f])

def prism(bm, section, x0, x1):
    # section = list of (y,z), extruded along X. Caps as ngons (exporter triangulates).
    A=[bm.verts.new((x0,y,z)) for (y,z) in section]
    B=[bm.verts.new((x1,y,z)) for (y,z) in section]
    n=len(section)
    for i in range(n):
        j=(i+1)%n; bm.faces.new((A[i],A[j],B[j],B[i]))
    bm.faces.new(list(reversed(A))); bm.faces.new(B)

hw = CELL/2
# cabinet body
bm=bmesh.new(); box(bm, 0,0,0.58, CELL,1.5,0.84); finish("cabinet", bm, mat("m_cab",(0.21,0.25,0.29)))
# recessed toe kick (narrower depth -> the body overhangs it front & back)
bm=bmesh.new(); box(bm, 0,0,0.08, CELL,1.16,0.16); finish("kick", bm, mat("m_kick",(0.13,0.16,0.20), rough=0.85))
# worktop slab with chamfered top front+back edges, slight overhang
sec=[(-0.79,1.00),(0.79,1.00),(0.79,SURF-0.04),(0.75,SURF),(-0.75,SURF),(-0.79,SURF-0.04)]
bm=bmesh.new(); prism(bm, sec, -hw, hw); finish("worktop", bm, mat("m_top",(0.90,0.87,0.81), rough=0.5, metal=0.05))

os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_apply=True)
print("WROTE", OUT)
