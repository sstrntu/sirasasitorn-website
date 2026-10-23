"""
Rig Sira's character model for the island scene (src/components/jungle/Likeness.js).

Run with Blender in background mode, on the output of scripts/optimize-glb.py:
  /Applications/Blender.app/Contents/MacOS/Blender -b --python scripts/rig-sira.py -- in.glb out.glb [test-render-prefix]
then Draco + WebP compress it into public/jungle/models/sira.glb (see TASK.md).

- Builds a 19-bone humanoid skeleton (bone names are what siraPose.js drives) at joints
  measured from the mesh: wrist = narrowest arm slice, elbow from the source image's crease,
  sleeve line from the texture; the arms hang slightly behind the body's centre line
- Hand-made skin weights instead of bone heat (which tore the shoulders: the A-pose arms hang
  only a couple of cm from the torso): arm weights follow distance along the arm across the
  real elbow and wrist; the torso's side stays put at the armpit; the head is rigid from below
  the jawline so the chin doesn't shear when the head turns
- Model: height 1, feet at z = 0, facing +X, character's left = +Y (Blender axes)
"""
import sys, bpy, math, mathutils
argv = sys.argv[sys.argv.index('--') + 1:]
src, out, test = argv[0], argv[1], argv[2] if len(argv) > 2 else ''
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1: bpy.ops.object.join()
body = bpy.context.view_layer.objects.active; body.name = 'Body'
# Model: height 1, feet at z=0, facing +X, character's left = +Y
B = {  # name: (head, tail, parent)
    'hips':      ((0, 0, .30), (0, 0, .42), None),
    'spine':     ((0, 0, .42), (0, 0, .56), 'hips'),
    'chest':     ((0, 0, .56), (0, 0, .74), 'spine'),
    'neck':      ((0, 0, .74), (0, 0, .81), 'chest'),
    'head':      ((0, 0, .81), (0, 0, 1.0), 'neck'),
}
# Arm joints measured from the mesh (narrowest wrist slice, texture sleeve line, source-image elbow
# crease): shoulder, elbow, wrist, fingertips. The arms hang slightly behind the body's centre line.
ARM = {side: [mathutils.Vector((x, y * sy, z)) for x, y, z in ((-0.045, .125, .675), (-0.035, .158, .53), (-0.016, .177, .445), (-0.005, .17, .335))]
       for side, sy in (('L', 1), ('R', -1))}
for side, sy in (('L', 1), ('R', -1)):
    j = [tuple(v) for v in ARM[side]]
    B.update({
        f'shoulder_{side}': ((-0.02, .03 * sy, .71), j[0], 'chest'),
        f'upperarm_{side}': (j[0], j[1], f'shoulder_{side}'),
        f'forearm_{side}':  (j[1], j[2], f'upperarm_{side}'),
        f'hand_{side}':     (j[2], j[3], f'forearm_{side}'),
        f'thigh_{side}':    ((0, .06 * sy, .34), (.005, .065 * sy, .175), 'hips'),
        f'shin_{side}':     ((.005, .065 * sy, .175), (-.005, .068 * sy, .05), f'thigh_{side}'),
        f'foot_{side}':     ((-.005, .068 * sy, .05), (.07, .068 * sy, .01), f'shin_{side}'),
    })
arm_data = bpy.data.armatures.new('Rig'); rig = bpy.data.objects.new('Rig', arm_data)
bpy.context.scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig; bpy.ops.object.mode_set(mode='EDIT')
for name, (h, t, parent) in B.items():
    e = arm_data.edit_bones.new(name); e.head = h; e.tail = t
    if parent: e.parent = arm_data.edit_bones[parent]; e.use_connect = (mathutils.Vector(h) - arm_data.edit_bones[parent].tail).length < 1e-4
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.select_all(action='DESELECT'); body.select_set(True); rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.parent_set(type='ARMATURE_NAME')

# Hand-made weights from the measured silhouette (A-pose, arms clear of the torso below the armpit)
def ss(e0, e1, x):  # smoothstep 0..1
    t = min(max((x - e0) / (e1 - e0), 0), 1); return t * t * (3 - 2 * t)
def along(p, pts):
    """Distance along the joint polyline `pts` of the point nearest to p."""
    best, s0 = (1e9, 0.0), 0.0
    for a, b in zip(pts, pts[1:]):
        ab = b - a
        t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
        d = (a + ab * t - p).length
        if d < best[0]: best = (d, s0 + t * ab.length)
        s0 += ab.length
    return best[1]
ELBOW_S = {side: (ARM[side][1] - ARM[side][0]).length for side in ARM}
WRIST_S = {side: ELBOW_S[side] + (ARM[side][2] - ARM[side][1]).length for side in ARM}

def weights(x, y, z):
    ay = abs(y); side = 'L' if y > 0 else 'R'; w = {}
    def add(name, v):
        if v > 1e-4: w[name] = w.get(name, 0) + v
    # how much of this vertex belongs to the arm: outside the torso below the armpit, blending in over the shoulder
    if z < 0.29:
        arm = 0.0  # feet and legs are wider than the arm threshold but never arm
    elif z < 0.40:
        arm = ss(0.118, 0.135, ay)
    elif z < 0.585:
        arm = ss(0.110, 0.122, ay)
    else:
        # Around the armpit only the arm itself moves (the torso's side stays put, so
        # raised arms don't drag a "wing" of shirt up with them); over the top of the
        # shoulder the torso blends into the arm
        armpit = ss(0.112, 0.128, ay)
        cap = ss(0.085, 0.145, ay) * (1 - ss(0.70, 0.76, z))
        arm = armpit + (cap - armpit) * ss(0.62, 0.67, z)
    # legs below the crotch, blending into the hips
    leg = (1 - ss(0.30, 0.37, z)) * (1 - arm)
    core = 1 - arm - leg
    # torso chain
    hips = 1 - ss(0.39, 0.45, z); spine = ss(0.39, 0.45, z) * (1 - ss(0.53, 0.59, z))
    # The head moves as one rigid piece, chin and jaw included (the chin's underside is at
    # z ~0.785): the neck/head blend sits below the jawline at the front, a little higher at
    # the nape, and stays off the collar and shoulders
    front = ss(-0.03, 0.02, x)
    head = ss(0.778 - 0.016 * front, 0.80 - 0.016 * front, z)
    if z < 0.80:
        head *= 1 - ss(0.075, 0.095, ay)
    chest = ss(0.53, 0.59, z) * (1 - ss(0.73, 0.77, z)); neck = ss(0.73, 0.77, z) * (1 - head)
    for n, v in (('hips', hips), ('spine', spine), ('chest', chest), ('neck', neck), ('head', head)): add(n, core * v)
    if arm > 0:
        sh = 1 - ss(0.12, 0.15, ay) if z > 0.62 else 0
        # Along the arm, blending across the real elbow and wrist
        s = along(mathutils.Vector((x, y, z)), ARM[side])
        a = ss(ELBOW_S[side] - 0.022, ELBOW_S[side] + 0.022, s)
        b = ss(WRIST_S[side] - 0.012, WRIST_S[side] + 0.012, s)
        upper, fore, hand = 1 - a, a * (1 - b), a * b
        add(f'shoulder_{side}', arm * sh); rest = arm * (1 - sh)
        add(f'upperarm_{side}', rest * upper); add(f'forearm_{side}', rest * fore); add(f'hand_{side}', rest * hand)
    if leg > 0:
        lside = 'L' if y > 0 else 'R'
        thigh = ss(0.15, 0.20, z); shin = (1 - ss(0.15, 0.20, z)) * ss(0.035, 0.07, z); foot = 1 - ss(0.035, 0.07, z)
        add(f'thigh_{lside}', leg * thigh); add(f'shin_{lside}', leg * shin); add(f'foot_{lside}', leg * foot)
    t = sum(w.values()); return {k: v / t for k, v in w.items()}
groups = {vg.name: vg for vg in body.vertex_groups}
for name in B:
    if name not in groups: groups[name] = body.vertex_groups.new(name=name)
mw = body.matrix_world
for v in body.data.vertices:
    co = mw @ v.co
    for name, wt in weights(co.x, co.y, co.z).items(): groups[name].add([v.index], wt, 'REPLACE')
used = {g.group for v in body.data.vertices for g in v.groups if g.weight > 0.01}
empty = [vg.name for vg in body.vertex_groups if vg.index not in used]
print('groups', len(body.vertex_groups), 'possibly empty', empty)
unweighted = sum(1 for v in body.data.vertices if not v.groups)
print('unweighted verts', unweighted, 'of', len(body.data.vertices))
if test:
    # Test pose: head turned, right arm pointing forward-out, left arm waving
    bpy.context.view_layer.objects.active = rig; bpy.ops.object.mode_set(mode='POSE')
    pb = rig.pose.bones
    def aim(bone, target):
        e = bpy.data.objects.new('t_' + bone, None); e.location = target; bpy.context.scene.collection.objects.link(e)
        c = pb[bone].constraints.new('DAMPED_TRACK'); c.target = e
    aim('upperarm_R', (0.45, -0.35, 0.80))   # pointing forward, out and up
    aim('forearm_R', (0.75, -0.50, 0.95))
    aim('upperarm_L', (0.05, 0.30, 0.95))    # waving: arm up and out
    aim('forearm_L', (0.05, 0.30, 1.30))
    aim('head', (0.6, -0.5, 1.0))            # looking toward the pointing hand
    bpy.ops.object.mode_set(mode='OBJECT')
    sc = bpy.context.scene; sc.render.resolution_x = 500; sc.render.resolution_y = 600
    w = bpy.data.worlds.new('w'); w.use_nodes = True; w.node_tree.nodes['Background'].inputs[1].default_value = 3; sc.world = w
    cam = bpy.data.cameras.new('c'); co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co); sc.camera = co
    for ang in (0, 45):
        a = math.radians(ang); t = mathutils.Vector((0, 0, .55)); d = 2.6
        co.location = t + mathutils.Vector((math.cos(a) * d, math.sin(a) * d, .2))
        co.rotation_euler = (t - co.location).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = f'{test}_{ang}.png'; bpy.ops.render.render(write_still=True)
    for b in rig.pose.bones:
        for c in list(b.constraints): b.constraints.remove(c)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=90, export_skins=True, export_animations=False)
print('exported')
