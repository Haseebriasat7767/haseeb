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
import sys

import bpy
from mathutils import Vector

scene_path, space_id, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
samples = int(sys.argv[4]) if len(sys.argv) > 4 else 64
width = int(sys.argv[5]) if len(sys.argv) > 5 else 1920
height = int(sys.argv[6]) if len(sys.argv) > 6 else 1080

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
scn.view_settings.view_transform = 'Filmic' if 'Filmic' in [
    t.name for t in scn.view_settings.bl_rna.properties['view_transform'].enum_items
] else 'Standard'


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

# ── Geometry ──────────────────────────────────────────────────────────────
# Three's Y-up becomes Blender's Z-up: (x, y, z) -> (x, -z, y).
total = 0
for group, items in data['groups'].items():
    mat = MATS.get(group, DEFAULT)
    mesh_objects = []
    for box in items:
        px, py, pz = box['position']
        sx, sy, sz = box['scale']
        bpy.ops.mesh.primitive_cube_add(size=1, location=(px, -pz, py))
        obj = bpy.context.object
        obj.scale = (sx, sz, sy)
        if box.get('rotationY'):
            obj.rotation_euler = (0, 0, -box['rotationY'])
        obj.data.materials.append(mat)
        mesh_objects.append(obj)
        total += 1
    # One merged mesh per material, as the web scene does.
    if len(mesh_objects) > 1:
        bpy.ops.object.select_all(action='DESELECT')
        for obj in mesh_objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = mesh_objects[0]
        bpy.ops.object.join()

print(f'built {total} boxes in {len(data["groups"])} material groups')

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
bg.inputs['Strength'].default_value = 1.1

sun = bpy.data.lights.new('sun', type='SUN')
sun.energy = 5.5
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

# The web renderer opens interiors up by the space's own exposure value.
scn.view_settings.exposure = math.log2(max(float(space.get('exposure', 1)), 0.01))

print(f'rendering {space["name"]} at {width}x{height}, {samples} samples')
bpy.ops.render.render(write_still=True)
print('wrote', out_path)
