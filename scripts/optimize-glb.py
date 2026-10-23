"""
Prepare an AI-generated GLB (e.g. from Higgsfield/Tripo) for the web scene.

Run with Blender in background mode:
  /Applications/Blender.app/Contents/MacOS/Blender -b --python scripts/optimize-glb.py -- in.glb out.glb [--faces 20000] [--tex 2048]

- Centers the model on X/Z and puts its lowest point at Y = 0
- Scales it to a height of 1 unit (the scene scales it to size)
- Welds UV-seam vertices so the surface stays watertight, then optionally decimates to a target face count
- Downscales textures (base color to --tex, other maps to half) and exports JPEG-compressed GLB
"""
import sys
import bmesh
import bpy
import mathutils

argv = sys.argv[sys.argv.index('--') + 1:]
src, out = argv[0], argv[1]
opts = dict(zip(argv[2::2], argv[3::2]))
max_faces = int(opts.get('--faces', 0))
tex = int(opts.get('--tex', 2048))

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']

# Bake every transform into the mesh data, then work in world space
for o in bpy.context.scene.objects:
    o.select_set(o.type == 'MESH')
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for o in list(bpy.context.scene.objects):
    if o.type != 'MESH':
        bpy.data.objects.remove(o)

mn = mathutils.Vector((1e9,) * 3)
mx = mathutils.Vector((-1e9,) * 3)
for o in meshes:
    for v in o.data.vertices:
        mn = mathutils.Vector(map(min, mn, v.co))
        mx = mathutils.Vector(map(max, mx, v.co))
# Blender is Z-up: height is along Z
height = mx.z - mn.z
offset = mathutils.Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))
for o in meshes:
    for v in o.data.vertices:
        v.co = (v.co - offset) / height

# glTF stores a separate vertex wherever the UVs change, so every UV island
# imports as a loose piece. Weld them back into one surface first: decimating
# the pieces separately pulls their shared edges apart into cracks that the
# background flickers through.
for o in meshes:
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.to_mesh(o.data)
    bm.free()

if max_faces:
    for o in meshes:
        faces = len(o.data.polygons)
        if faces > max_faces:
            mod = o.modifiers.new('decimate', 'DECIMATE')
            mod.ratio = max_faces / faces
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.modifier_apply(modifier=mod.name)

# The imported custom normals don't survive welding and decimation: smooth-shade the result instead
for o in meshes:
    bpy.context.view_layer.objects.active = o
    if o.data.has_custom_normals:
        bpy.ops.mesh.customdata_custom_splitnormals_clear()
    o.data.shade_smooth()

for img in bpy.data.images:
    if img.size[0] == 0:
        continue
    is_color = any(
        link.to_socket.name == 'Base Color'
        for mat in bpy.data.materials if mat.use_nodes
        for node in mat.node_tree.nodes if node.type == 'TEX_IMAGE' and node.image == img
        for link in node.outputs[0].links
    )
    size = tex if is_color else tex // 2
    if img.size[0] > size:
        img.scale(size, size)

bpy.ops.export_scene.gltf(
    filepath=out,
    export_format='GLB',
    export_image_format='JPEG',
    export_jpeg_quality=82,
    export_yup=True,
)
faces = sum(len(o.data.polygons) for o in meshes)
print('OPTIMIZED', out, 'faces', faces, 'footprint', round((mx.x - mn.x) / height, 3), round((mx.y - mn.y) / height, 3))
