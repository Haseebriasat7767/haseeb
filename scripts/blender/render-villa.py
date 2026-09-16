"""
Renders the generated residence with Cycles.

Nothing here models anything. The geometry arrives as JSON emitted from the
same `createVillaLayout` / `createInteriorLayout` the website's 3D scene is
built from, so the floor plans, the accommodation schedule, the panorama door
graph and the brochure figures all still derive from one source. Blender is a
better renderer, not a second building.

  python3 scripts/blender/render-villa.py <scene.json> <spaceId> <out.png> [samples]
"""
import json
import math
import os
import re
import sys

import bpy
from mathutils import Matrix, Vector

scene_path, space_id, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
samples = int(sys.argv[4]) if len(sys.argv) > 4 else 64
width = int(sys.argv[5]) if len(sys.argv) > 5 else 1920
height = int(sys.argv[6]) if len(sys.argv) > 6 else 1080

# Cube mode renders six square faces into `out_path` as a directory, instead
# of one still to a file.
CUBE = os.environ.get('PANO_CUBE') == '1'

# Copied from lib/pano/cube-faces.ts, which is itself copied from three's
# CubeCamera. Expressed as dir+up because a YXZ Euler gimbal-locks at pitch
# +/-90 and cannot express the pole faces' roll at all. Order matches
# CUBE_FACE_ORDER, which is the order CubeTextureLoader reads its URLs in.
CUBE_FACES = [
    ('px', (1, 0, 0), (0, 1, 0)),
    ('nx', (-1, 0, 0), (0, 1, 0)),
    ('py', (0, 1, 0), (0, 0, -1)),
    ('ny', (0, -1, 0), (0, 0, 1)),
    ('pz', (0, 0, 1), (0, 1, 0)),
    ('nz', (0, 0, -1), (0, 1, 0)),
]

data = json.load(open(scene_path))

# ── Clean slate ───────────────────────────────────────────────────────────
bpy.ops.wm.read_factory_settings(use_empty=True)
scn = bpy.context.scene
scn.render.engine = 'CYCLES'
scn.cycles.device = 'CPU'
scn.cycles.samples = samples
scn.cycles.use_adaptive_sampling = True
scn.cycles.use_denoising = True
scn.cycles.max_bounces = 8
scn.cycles.transmission_bounces = 8
scn.render.resolution_x = width
scn.render.resolution_y = height
scn.render.filepath = out_path
scn.render.image_settings.file_format = 'PNG'
_transforms = [t.name for t in scn.view_settings.bl_rna.properties['view_transform'].enum_items]
# AgX rolls highlights off far more gracefully than Standard, which matters
# here: every interior framing looks out through full-height glazing at a
# sky several stops brighter than the room.
scn.view_settings.view_transform = next(
    (t for t in ('AgX', 'Filmic', 'Standard') if t in _transforms), 'Standard'
)


def material(name, rgba, roughness=0.6, metallic=0.0, transmission=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = rgba
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    if transmission and 'Transmission Weight' in bsdf.inputs:
        bsdf.inputs['Transmission Weight'].default_value = transmission
        mat.use_backface_culling = False
    return mat


# Buckets mirror the generator's own material grouping — the layout is
# already sorted by material, so this is a lookup rather than a guess.
MATS = {
    'shell.foundation': material('plinth', (0.30, 0.29, 0.27, 1), 0.85),
    'shell.groundFloor': material('stone', (0.62, 0.59, 0.54, 1), 0.72),
    'shell.upperFloor': material('stone-upper', (0.62, 0.59, 0.54, 1), 0.72),
    'shell.roof': material('roof', (0.40, 0.39, 0.37, 1), 0.80),
    'shell.terrace': material('terrace', (0.68, 0.65, 0.60, 1), 0.55),
    'shell.openings': material('glazing', (0.86, 0.90, 0.92, 1), 0.03, 0.0, 1.0),
    'shell.facade': material('fins', (0.55, 0.52, 0.48, 1), 0.60),
    'shell.railings': material('railing', (0.18, 0.18, 0.19, 1), 0.35, 0.9),
    'shell.columns': material('column', (0.60, 0.57, 0.53, 1), 0.70),
    'shell.stairs': material('ext-stair', (0.64, 0.61, 0.56, 1), 0.65),
    'int.floorsStone': material('floor-stone', (0.74, 0.71, 0.66, 1), 0.30),
    'int.floorsTimber': material('floor-timber', (0.36, 0.24, 0.15, 1), 0.42),
    'int.ceilings': material('ceiling', (0.90, 0.89, 0.87, 1), 0.92),
    'int.partitions': material('plaster', (0.86, 0.85, 0.82, 1), 0.90),
    'int.panelling': material('panelling', (0.42, 0.29, 0.19, 1), 0.48),
    'int.stairs': material('stair', (0.70, 0.67, 0.62, 1), 0.45),
    'int.laylight': material('laylight', (0.92, 0.94, 0.96, 1), 0.05, 0.0, 0.95),
    'int.furniture': material('furniture', (0.52, 0.48, 0.43, 1), 0.65),
}
DEFAULT = material('default', (0.6, 0.6, 0.6, 1), 0.7)

# Some groups are not one material. `shell.openings` holds the glazing AND
# the frames that carry it, and rendering the whole group as glass makes
# every mullion, sill and jamb vanish — the building loses its dark window
# frames and reads as a model with holes in it. The keys say which is which.
FRAME_MAT = material('window-frame', (0.13, 0.13, 0.14, 1), 0.34, 0.85)
COVE_MAT = material('cove', (1.0, 0.89, 0.70, 1), 0.45)
_cove = COVE_MAT.node_tree.nodes['Principled BSDF']
if 'Emission Color' in _cove.inputs:
    _cove.inputs['Emission Color'].default_value = (1.0, 0.86, 0.64, 1)
    _cove.inputs['Emission Strength'].default_value = 7.0

GLASS_KEY = re.compile(r'(glass|leaf)', re.I)
COVE_KEY = re.compile(r'(cove|strip)', re.I)


def material_for(group, key):
    if COVE_KEY.search(key):
        return COVE_MAT
    if group == 'shell.openings':
        return MATS[group] if GLASS_KEY.search(key) else FRAME_MAT
    return MATS.get(group, DEFAULT)

# The generator's own material vocabulary for soft geometry. Each form names
# one of these, so this is a lookup rather than a guess about what a sofa is
# made of.
FORM_MATS = {
    'joinery': material('joinery', (0.38, 0.26, 0.17, 1), 0.45),
    'wood': material('wood', (0.34, 0.22, 0.13, 1), 0.50),
    'upholstery': material('upholstery', (0.56, 0.52, 0.45, 1), 0.88),
    'upholsteryDark': material('upholstery-dark', (0.17, 0.16, 0.16, 1), 0.85),
    'marble': material('marble', (0.84, 0.83, 0.80, 1), 0.18),
    'stone': material('form-stone', (0.62, 0.59, 0.54, 1), 0.65),
    'bronze': material('bronze', (0.44, 0.31, 0.16, 1), 0.32, 0.95),
    'darkMetal': material('dark-metal', (0.12, 0.12, 0.13, 1), 0.38, 0.9),
    'frameMetal': material('frame-metal', (0.30, 0.30, 0.31, 1), 0.30, 0.9),
    'ceramic': material('ceramic', (0.88, 0.87, 0.84, 1), 0.22),
    'rug': material('rug', (0.47, 0.40, 0.31, 1), 0.95),
    'drapery': material('drapery', (0.72, 0.68, 0.60, 1), 0.92),
    # A sheer is mostly hole. At 0.55 transmission it rendered as a white
    # diffuse sheet and erased the sea behind every glazed wall, which is
    # the one view the building exists for.
    'sheer': material('sheer', (0.94, 0.93, 0.90, 1), 0.18, 0.0, 0.92),
    'glow': material('glow', (1.0, 0.90, 0.72, 1), 0.40),
    'plaster': material('form-plaster', (0.86, 0.85, 0.82, 1), 0.90),
    'paper': material('paper', (0.93, 0.91, 0.86, 1), 0.80),
    'glazing': material('form-glazing', (0.86, 0.90, 0.92, 1), 0.03, 0.0, 1.0),
    'indoorFoliage': material('foliage', (0.20, 0.33, 0.16, 1), 0.70),
}
# The glow material is what a lit shade reads as; give it real emission.
_glow = FORM_MATS['glow'].node_tree.nodes['Principled BSDF']
if 'Emission Color' in _glow.inputs:
    _glow.inputs['Emission Color'].default_value = (1.0, 0.88, 0.68, 1)
    _glow.inputs['Emission Strength'].default_value = 3.0

# ── Geometry ──────────────────────────────────────────────────────────────
# Three's Y-up becomes Blender's Z-up: (x, y, z) -> (x, -z, y).
total = 0
for group, items in data['groups'].items():
    buckets = {}
    for box in items:
        px, py, pz = box['position']
        sx, sy, sz = box['scale']
        bpy.ops.mesh.primitive_cube_add(size=1, location=(px, -pz, py))
        obj = bpy.context.object
        obj.scale = (sx, sz, sy)
        if box.get('rotationY'):
            obj.rotation_euler = (0, 0, -box['rotationY'])
        mat = material_for(group, box['key'])
        obj.data.materials.append(mat)
        buckets.setdefault(mat.name, []).append(obj)
        total += 1

    # One merged mesh per material, as the web scene does.
    for objs in buckets.values():
        if len(objs) > 1:
            bpy.ops.object.select_all(action='DESELECT')
            for obj in objs:
                obj.select_set(True)
            bpy.context.view_layer.objects.active = objs[0]
            bpy.ops.object.join()

print(f'built {total} boxes in {len(data["groups"])} material groups')


def place(obj, form):
    """Three's Y-up to Blender's Z-up, with the form's own tilt and yaw."""
    px, py, pz = form['position']
    obj.location = (px, -pz, py)
    obj.rotation_euler = (float(form.get('tiltX', 0) or 0), 0, -float(form.get('rotationY', 0) or 0))
    obj.data.materials.append(FORM_MATS.get(form.get('material'), DEFAULT))


def build_soft(form):
    """A rounded solid. The generator's `radius` is a fillet, which is a
    bevel here — it is what stops a sofa reading as a stack of crates."""
    sx, sy, sz = form['size']
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj = bpy.context.object
    obj.scale = (sx, sz, sy)
    bpy.ops.object.transform_apply(scale=True)

    bevel = obj.modifiers.new('round', 'BEVEL')
    bevel.width = min(float(form.get('radius', 0.05)), min(sx, sy, sz) * 0.49)
    bevel.segments = int(form.get('detail', 3)) or 3
    bevel.limit_method = 'ANGLE'
    subsurf = obj.modifiers.new('soften', 'SUBSURF')
    subsurf.levels = subsurf.render_levels = 1
    place(obj, form)
    return obj


def build_turned(form):
    """A lathed solid, spun from the generator's own [radius, height]
    profile — lamp bases, shades, vessels, pots."""
    profile = form.get('profile') or []
    if len(profile) < 2:
        return None
    verts = [(float(r), 0.0, float(h)) for r, h in profile]
    mesh = bpy.data.meshes.new(form['key'])
    mesh.from_pydata(verts, [(i, i + 1) for i in range(len(verts) - 1)], [])
    obj = bpy.data.objects.new(form['key'], mesh)
    scn.collection.objects.link(obj)

    screw = obj.modifiers.new('lathe', 'SCREW')
    screw.axis = 'Z'
    screw.angle = math.radians(360)
    screw.steps = screw.render_steps = int(form.get('segments', 24)) or 24
    screw.use_merge_vertices = True
    place(obj, form)
    return obj


def build_fold(form):
    """A hanging fabric panel. The pleats are a real wave across the width,
    not a flat plane — drapery that does not fold reads as painted-on."""
    width = float(form['width'])
    height = float(form['height'])
    depth = max(float(form.get('depth', 0.06)), 0.01)
    pleats = max(int(form.get('pleats', 6)), 1)
    cols = max(pleats * 4, 8)
    rows = max(int(form.get('rows', 6)), 2)

    verts, faces = [], []
    for row in range(rows + 1):
        for col in range(cols + 1):
            u = col / cols
            v = row / rows
            x = (u - 0.5) * width
            y = math.sin(u * pleats * math.tau) * depth * 0.5
            z = (0.5 - v) * height
            verts.append((x, y, z))
    for row in range(rows):
        for col in range(cols):
            a = row * (cols + 1) + col
            faces.append((a, a + 1, a + cols + 2, a + cols + 1))

    mesh = bpy.data.meshes.new(form['key'])
    mesh.from_pydata(verts, [], faces)
    mesh.validate()
    obj = bpy.data.objects.new(form['key'], mesh)
    scn.collection.objects.link(obj)
    solid = obj.modifiers.new('thickness', 'SOLIDIFY')
    solid.thickness = 0.012
    place(obj, form)
    return obj


BUILDERS = {'soft': build_soft, 'turned': build_turned, 'fold': build_fold}

made = 0
for form in data.get('forms', []):
    builder = BUILDERS.get(form.get('kind'))
    if builder and builder(form) is not None:
        made += 1
print(f'built {made} forms of {len(data.get("forms", []))}')

# ── Daylight ──────────────────────────────────────────────────────────────
# Golden hour, matching the web scene's presentation default: a low sun and
# a sky that actually fills the interior through the glazing.
world = bpy.data.worlds.new('sky')
world.use_nodes = True
scn.world = world
bg = world.node_tree.nodes['Background']
sky = world.node_tree.nodes.new('ShaderNodeTexSky')
sky.sun_elevation = math.radians(11)
sky.sun_rotation = math.radians(-58)
world.node_tree.links.new(sky.outputs[0], bg.inputs['Color'])
# Dimmer than it looks like it should be. The interior carries a 2.6x
# exposure boost, and that boost lands on the sky as well — at full strength
# the glazing clips to white and the horizon disappears.
bg.inputs['Strength'].default_value = float(os.environ.get('PANO_SKY', '0.42'))

sun = bpy.data.lights.new('sun', type='SUN')
sun.energy = float(os.environ.get('PANO_SUN', '3.2'))
sun.angle = math.radians(1.2)
sun.color = (1.0, 0.86, 0.68)
sun_obj = bpy.data.objects.new('sun', sun)
scn.collection.objects.link(sun_obj)
sun_obj.rotation_euler = (math.radians(79), 0, math.radians(-58))

# ── The interior practicals the generator specifies ───────────────────────
for spec in data.get('lights', []):
    px, py, pz = spec['position']
    light = bpy.data.lights.new(spec['key'], type='SPOT')
    light.energy = 120 * float(spec.get('intensity', 1))
    light.spot_size = float(spec.get('angle', 1.0)) * 2
    light.spot_blend = float(spec.get('penumbra', 0.5))
    hexcolor = spec.get('color', '#ffffff').lstrip('#')
    light.color = tuple(int(hexcolor[i:i + 2], 16) / 255 for i in (0, 2, 4))
    obj = bpy.data.objects.new(spec['key'], light)
    scn.collection.objects.link(obj)
    obj.location = (px, -pz, py)
    tx, ty, tz = spec.get('target', [px, py - 1, pz])
    direction = Vector((tx, -tz, ty)) - obj.location
    obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()

# ── Camera: the space's own authored framing ──────────────────────────────
space = next((s for s in data['spaces'] if s['id'] == space_id), None)
if space is None:
    raise SystemExit(f'unknown space "{space_id}"')

cam_data = bpy.data.cameras.new('cam')
# three's fov is vertical; Blender's sensor_fit VERTICAL matches it exactly.
cam_data.sensor_fit = 'VERTICAL'
cam_data.angle_y = math.radians(space['fov'])
cam = bpy.data.objects.new('cam', cam_data)
scn.collection.objects.link(cam)
scn.camera = cam
px, py, pz = space['position']
cam.location = (px, -pz, py)
tx, ty, tz = space['target']
cam.rotation_euler = (Vector((tx, -tz, ty)) - cam.location).to_track_quat('-Z', 'Y').to_euler()

# Exposure, matching the web renderer's own reasoning.
#
# Each space carries an exposure value tuned against the rasterizer, and
# `PathTracer` then multiplies it by a further 2.6 because light that
# actually has to arrive somewhere renders roughly a stop and a half darker
# than a hemisphere light pretending to be ambient. Cycles has exactly that
# problem, so it gets exactly that boost. Without it every interior comes
# out underexposed in the same way the web tracer did before the boost
# existed.
EXPOSURE_BOOST = float(os.environ.get('PANO_EXPOSURE_BOOST', '2.6'))
scn.view_settings.exposure = math.log2(
    max(float(space.get('exposure', 1)), 0.01) * EXPOSURE_BOOST
)

def to_blender(vec):
    """three's Y-up to Blender's Z-up."""
    x, y, z = vec
    return Vector((x, -z, y))


def aim(obj, direction, up):
    """Points a camera along `direction` with an exact roll.

    Not `to_track_quat`: that picks its own up vector, which is fine for a
    framed shot and wrong for a cube face, where the roll is the whole
    point. The pole faces have no valid Euler form at all, so the basis is
    built directly — a Blender camera looks down its own -Z with +Y up.
    """
    forward = to_blender(direction).normalized()
    upward = to_blender(up).normalized()
    cam_z = -forward
    cam_x = upward.cross(cam_z).normalized()
    cam_y = cam_z.cross(cam_x)
    obj.matrix_world = Matrix((
        (cam_x.x, cam_y.x, cam_z.x, obj.location.x),
        (cam_x.y, cam_y.y, cam_z.y, obj.location.y),
        (cam_x.z, cam_y.z, cam_z.z, obj.location.z),
        (0, 0, 0, 1),
    ))


if CUBE:
    import pathlib

    # A cube face is square and exactly 90 degrees. Both are necessary: six
    # faces at any other angle do not tile, and a non-square target bakes a
    # wrong projection into every one of them.
    size = width
    scn.render.resolution_x = scn.render.resolution_y = size
    cam_data.sensor_fit = 'VERTICAL'
    cam_data.angle_y = math.radians(90)
    scn.render.image_settings.file_format = 'JPEG'
    scn.render.image_settings.quality = 90

    out_dir = pathlib.Path(out_path)
    out_dir.mkdir(parents=True, exist_ok=True)
    for face_id, direction, up in CUBE_FACES:
        cam.location = to_blender(space['position'])
        aim(cam, direction, up)
        scn.render.filepath = str(out_dir / f'{face_id}.jpg')
        print(f'  face {face_id} -> {scn.render.filepath}')
        bpy.ops.render.render(write_still=True)
    print(f'wrote 6 faces for {space["name"]} into {out_dir}')
else:
    print(f'rendering {space["name"]} at {width}x{height}, {samples} samples')
    bpy.ops.render.render(write_still=True)
    print('wrote', out_path)
