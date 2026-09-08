import type { BlobSpec } from '../villa/landscape/LandscapeTypes';
import type { Form } from '../villa/furniture/FormTypes';
import { createFloorVessel } from '../villa/furniture/Pieces';
import type { ModelName } from '../models/ModelLibrary';
import { emptyParts, type Parts } from '../villa/interior/Furniture';
import type { BoxSpec, Range } from '../villa/VillaTypes';

/**
 * A fitted-out apartment: a lounge on the ocean glazing and a bedroom
 * behind it.
 *
 * The first cut of this floor was a handful of chamfered boxes, which is
 * why it read as a waiting room. Everything here is the residence's own
 * furniture library — the same swept sofas, waisted stone drums, turned
 * vessels and card-based planting the villa uses — because none of that was
 * villa-specific either. What is new is the fit-out a tower apartment has
 * and a house does not: a full-height millwork wall, a fluted media panel,
 * a dropped soffit with a cove, and sheers at a wall of glass.
 *
 * Pure, like every other layout function here: config in, geometry out.
 */

const mid = (r: Range) => (r[0] + r[1]) / 2;
const span = (r: Range) => r[1] - r[0];

function box(key: string, x: Range, y: Range, z: Range): BoxSpec {
  return { key, position: [mid(x), mid(y), mid(z)], scale: [span(x), span(y), span(z)] };
}

/** Deterministic hash, matching the rest of the project. */
function rand(seed: number): number {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Vertical fluting, as a run of thin half-round staves.
 *
 * The single most repeated detail in contemporary interiors of this class,
 * and the reason is that it is the cheapest way to make a flat wall carry a
 * gradient: every stave has a lit side and a shadowed side, so the wall
 * shades continuously across its width instead of reading as one value.
 */
function flutedPanel(
  out: BoxSpec[],
  key: string,
  along: Range,
  at: number,
  y: Range,
  depth: number,
  pitch = 0.075,
): void {
  const count = Math.max(2, Math.round(span(along) / pitch));
  const step = span(along) / count;
  for (let i = 0; i < count; i += 1) {
    const c = along[0] + step * (i + 0.5);
    out.push(
      box(
        `${key}-${i}`,
        [at, at + depth],
        y,
        [c - step * 0.36, c + step * 0.36],
      ),
    );
  }
}

/**
 * A Blender-authored piece standing somewhere in the room.
 *
 * Kept as data next to the procedural geometry rather than as JSX, so the
 * whole fit-out is still one pure function that a floor-plan file could
 * drive later.
 */
export type ModelPlacement = {
  key: string;
  name: ModelName;
  position: [number, number, number];
  rotationY: number;
};

/**
 * Which way a piece faces, in the rotation the loaded models actually need.
 *
 * The models are authored in Blender facing +Y, and the glTF exporter maps
 * Blender +Y onto -Z. So a piece at zero rotation looks toward -Z, which is
 * "north" in the villa's own vocabulary — and every angle here is derived
 * from that one fact rather than guessed at a site.
 */
export const FACE = {
  north: 0,
  east: -Math.PI / 2,
  south: Math.PI,
  west: Math.PI / 2,
} as const;

export type ApartmentLayout = {
  parts: Parts;
  forms: Form[];
  /** Partitions and the fluted faces applied to them. */
  walls: BoxSpec[];
  /** The dropped soffit over the lounge. */
  soffit: BoxSpec[];
  /** Furniture loaded from glTF rather than generated. */
  models: ModelPlacement[];
};

export function createApartment(
  /** Bounds of the glazed floor plate, and the level's finished floor. */
  x: Range,
  z: Range,
  floorY: number,
  ceilingY: number,
): ApartmentLayout {
  const parts = emptyParts();
  const forms: Form[] = [];
  const models: ModelPlacement[] = [];

  const put = (
    key: string,
    name: ModelName,
    x: number,
    z: number,
    y: number,
    facing: keyof typeof FACE,
  ) => {
    models.push({ key, name, position: [x, y, z], rotationY: FACE[facing] });
  };
  const walls: BoxSpec[] = [];
  const soffit: BoxSpec[] = [];

  const glassX = x[1];
  const westX = x[0];

  // ── Planning ──────────────────────────────────────────────────────────
  // The lounge takes the ocean end; the bedroom sits behind it against the
  // northern glazing, so both principal rooms have a window and neither is
  // an internal box.
  // Nine metres deep, not fifteen.
  //
  // The first fit-out furnished the whole floor plate as one lounge, which
  // put the media wall eighteen metres from the glass and left the seating
  // marooned in the middle of a hall. An apartment lounge is a room: the
  // plate is subdivided, and what the camera stands in is about nine metres
  // by twelve.
  const loungeBackX = -9.2;
  /** How far the millwork runs along the wall. */
  const caseZ: Range = [-6.4, 6.4];
  const bedroomZ: Range = [z[0], -1.6];

  // ── Partitions ────────────────────────────────────────────────────────
  walls.push(box('apt-wall-lounge', [loungeBackX, loungeBackX + 0.26], [floorY, ceilingY], z));
  walls.push(
    box('apt-wall-bed', [westX, loungeBackX], [floorY, ceilingY], [bedroomZ[1], bedroomZ[1] + 0.24]),
  );

  // ── Lounge: the millwork and media wall ───────────────────────────────
  // Reading left to right off the sofa: open shelving, then the fluted
  // panel the screen is set into, then more shelving.

  const wallFace = loungeBackX + 0.26;
  const shelfTop = ceilingY - 0.42;

  // Carcass — two bays of open shelving flanking the media panel.
  const bays: Range[] = [
    [caseZ[0], -2.3],
    [2.3, caseZ[1]],
  ];

  for (const [bi, bay] of bays.entries()) {
    parts.joinery.push(box(`apt-case-${bi}-back`, [wallFace, wallFace + 0.06], [floorY, shelfTop], bay));
    // Verticals.
    const divisions = 3;
    for (let i = 0; i <= divisions; i += 1) {
      const c = bay[0] + (span(bay) / divisions) * i;
      parts.joinery.push(
        box(`apt-case-${bi}-v${i}`, [wallFace, wallFace + 0.36], [floorY, shelfTop], [c - 0.025, c + 0.025]),
      );
    }
    // Shelves, and a lit reveal under each one.
    const rows = 5;
    for (let r = 1; r <= rows; r += 1) {
      const sy = floorY + ((shelfTop - floorY) / (rows + 1)) * r;
      parts.joinery.push(
        box(`apt-case-${bi}-s${r}`, [wallFace, wallFace + 0.36], [sy, sy + 0.035], bay),
      );
      parts.channel.push(
        box(`apt-case-${bi}-c${r}`, [wallFace + 0.02, wallFace + 0.1], [sy - 0.045, sy], bay),
      );
      parts.strip.push(
        box(`apt-case-${bi}-l${r}`, [wallFace + 0.03, wallFace + 0.09], [sy - 0.038, sy - 0.008], bay),
      );

      // Objects on the shelves. Turned vessels and stacked books — the
      // thing that separates joinery from a bookcase somebody lives with.
      const perShelf = 3;
      for (let o = 0; o < perShelf; o += 1) {
        const seed = bi * 191 + r * 37 + o * 11;
        const t = (o + 0.5) / perShelf;
        const oz = bay[0] + span(bay) * t + (rand(seed) - 0.5) * 0.5;
        const ox = wallFace + 0.18;
        if (rand(seed + 3) > 0.42) {
          createFloorVessel(forms, `apt-vessel-${bi}-${r}-${o}`, [ox, oz], sy + 0.035, {
            height: 0.16 + rand(seed + 5) * 0.26,
            radius: 0.05 + rand(seed + 7) * 0.055,
            material: rand(seed + 9) > 0.5 ? 'ceramic' : 'stone',
          });
        } else {
          const h = 0.05 + rand(seed + 11) * 0.09;
          parts.paper.push(
            box(
              `apt-books-${bi}-${r}-${o}`,
              [ox - 0.11, ox + 0.11],
              [sy + 0.035, sy + 0.035 + h],
              [oz - 0.13, oz + 0.13],
            ),
          );
        }
      }
    }
  }

  // The media panel: fluted timber, with a dark screen set proud of it.
  flutedPanel(parts.joinery, 'apt-flute', [-2.3, 2.3], wallFace, [floorY, shelfTop], 0.055);
  parts.dark.push(box('apt-screen', [wallFace + 0.06, wallFace + 0.11], [floorY + 0.92, floorY + 1.86], [-1.55, 1.55]));

  // ── Lounge: the dropped soffit ────────────────────────────────────────
  // A lowered plane over the seating with a cove around it. In a flat-slab
  // apartment this is the only ceiling modelling there is, and it is what
  // gives the room a centre.
  // The dropped soffit is a model — an amoeba plan with a lit rim around
  // its whole edge, which is the reference room's most recognisable
  // feature and not a shape worth expressing as boxes. Placed by the
  // height a person stands under it.
  put('apt-soffit', 'ceiling-soffit', -3.4, 0.4, ceilingY - 0.42, 'north');

  // ── Lounge: the furniture ─────────────────────────────────────────────
  // Turned toward the media wall, backs to the glass, which is how a room
  // with one spectacular elevation is actually arranged — you do not put
  // the sofa's back to the view by accident, you do it so the chairs
  // opposite face it.

  // The rug sets the room. Everything below is placed against its edges,
  // which is how a seating group is actually laid out — the furniture holds
  // the rug's perimeter and the floor outside it stays clear.
  parts.rugs.push(box('apt-rug', [-7.6, 1.6], [floorY, floorY + 0.022], [-4.4, 4.4]));

  // Sofa against the glass end, facing the media wall.
  put('apt-sofa', 'sofa-3seat', 0.9, 0.2, floorY, 'west');
  // Two chairs turned back toward it, closing the group.
  put('apt-chair-a', 'lounge-chair', -4.6, -3.3, floorY, 'east');
  put('apt-chair-b', 'lounge-chair', -4.4, 3.4, floorY, 'east');
  put('apt-ottoman', 'ottoman', -1.6, 3.7, floorY, 'north');

  // A cluster of kidney tables at three heights, overlapping in plan —
  // never a matching pair, and never one rectangle in the middle of a rug.
  put('apt-table-a', 'organic-table-lg', -2.5, 0.2, floorY, 'north');
  put('apt-table-b', 'organic-table-sm', -1.45, -0.85, floorY, 'east');
  put('apt-table-c', 'side-drum', -3.55, 1.35, floorY, 'north');

  // Dressed. An undressed table is the tell that a room was arranged by
  // somebody who does not live in it.
  put('apt-bowl', 'bowl', -2.75, 0.55, floorY + 0.43, 'north');
  put('apt-books', 'book-stack', -1.5, -0.9, floorY + 0.34, 'south');
  put('apt-candles', 'candle-cluster', -2.15, -0.15, floorY + 0.43, 'north');
  put('apt-tray', 'tray', -3.55, 1.35, floorY + 0.53, 'east');

  put('apt-lamp', 'floor-lamp', -6.6, 5.1, floorY, 'north');
  put('apt-urn', 'vessel-tall', -7.4, -5.2, floorY, 'north');

  // ── Lounge: planting ──────────────────────────────────────────────────
  // Two indoor trees, in the corners where the glass turns. Every one of
  // the reference interiors has one there, and it is not decoration: a tall
  // plant is what breaks the vertical line of a corner mullion.
  const plant = (key: string, px: number, pz: number, height: number, seed: number) => {
    // A real planter, then the canopy as blob clusters the card renderer
    // draws — geometry for the pot, cards for the leaves, which is the
    // right division of labour for both.
    put(`${key}-pot`, 'planter-cyl', px, pz, floorY, 'north');
    // A slender trunk.
    forms.push({
      kind: 'turned',
      key: `${key}-stem`,
      material: 'wood',
      position: [px, floorY + height * 0.24, pz],
      profile: [
        [0.035, 0],
        [0.028, height * 0.5],
        [0.022, height * 0.62],
      ],
      segments: 7,
    });
    const crownY = floorY + height * 0.26 + height * 0.6;
    for (let i = 0; i < 3; i += 1) {
      const r = rand(seed + i * 17);
      parts.foliageClusters.push({
        key: `${key}-crown-${i}`,
        position: [px + (r - 0.5) * 0.5, crownY + (rand(seed + i * 23) - 0.4) * 0.42, pz + (rand(seed + i * 31) - 0.5) * 0.5],
        radius: 0.42 + r * 0.2,
        scale: [1, 0.86, 1],
        seed: seed + i,
        deform: 0.3,
        detail: 1,
      });
    }
  };

  plant('apt-tree-a', 2.4, -6.4, 2.5, 811);
  plant('apt-tree-b', 1.9, 6.2, 2.15, 823);

  // ── Lounge: sheers at the glass ───────────────────────────────────────
  // Only the voile. A wall of glass on a private floor has no reason to
  // carry heavy curtains, and the sheer is what softens the light.
  parts.sheer.push(box('apt-sheer-n', [glassX - 0.34, glassX - 0.28], [floorY, ceilingY], [z[0] + 0.4, -6.6]));
  parts.sheer.push(box('apt-sheer-s', [glassX - 0.34, glassX - 0.28], [floorY, ceilingY], [6.6, z[1] - 0.4]));

  // ── Bedroom ───────────────────────────────────────────────────────────
  const bedX = westX + 0.3;
  const bedCentreZ = mid([bedroomZ[0] + 1.2, bedroomZ[1] - 1.2]);

  // A fluted headboard wall, which is the detail the reference bedroom is
  // built around.
  flutedPanel(
    parts.plaster,
    'apt-bed-flute',
    [bedroomZ[0] + 0.8, bedroomZ[1] - 0.8],
    bedX,
    [floorY, ceilingY - 0.5],
    0.05,
    0.09,
  );

  parts.rugs.push(
    box('apt-bed-rug', [bedX + 0.6, bedX + 5.4], [floorY, floorY + 0.022], [bedCentreZ - 2.6, bedCentreZ + 2.6]),
  );

  // The bed model carries its own headboard and pillows.
  put('apt-bed', 'bed', bedX + 1.9, bedCentreZ, floorY, 'east');
  put('apt-night-a', 'nightstand', bedX + 0.85, bedCentreZ - 1.5, floorY, 'east');
  put('apt-night-b', 'nightstand', bedX + 0.85, bedCentreZ + 1.5, floorY, 'east');
  put('apt-lamp-a', 'table-lamp', bedX + 0.85, bedCentreZ - 1.5, floorY + 0.44, 'east');
  put('apt-lamp-b', 'table-lamp', bedX + 0.85, bedCentreZ + 1.5, floorY + 0.44, 'east');

  put('apt-bed-chair', 'wingback', bedX + 6.4, bedroomZ[0] + 2.2, floorY, 'south');
  put('apt-bed-table', 'side-drum', bedX + 6.4, bedroomZ[0] + 3.6, floorY, 'north');

  plant('apt-bed-tree', bedX + 5.6, bedroomZ[0] + 1.0, 2.3, 839);

  parts.sheer.push(
    box('apt-bed-sheer', [bedX + 3.4, loungeBackX - 0.4], [floorY, ceilingY], [z[0] + 0.28, z[0] + 0.34]),
  );

  // Dining, between the kitchen and the lounge glazing.
  put('apt-dining', 'dining-table', -12.6, -6.0, floorY, 'north');
  for (let i = 0; i < 6; i += 1) {
    const side = i < 3 ? -1 : 1;
    const z = -6.0 + ((i % 3) - 1) * 0.78;
    put(`apt-dchair-${i}`, 'dining-chair', -12.6 + side * 0.86, z, floorY,
        side < 0 ? 'east' : 'west');
  }

  // ── Kitchen and bathroom ──────────────────────────────────────────────
  //
  // The zone behind the bedroom and west of the lounge was empty floor
  // plate. An apartment without a kitchen or a bathroom does not read as an
  // apartment however well the lounge is dressed — it reads as a showroom.

  const kitchenBackX = westX + 0.3;
  const partX = -16.7;
  const bathZ = 3.8;

  walls.push(box('apt-wall-kitchen', [partX, partX + 0.2], [floorY, ceilingY], [-1.4, 10.8]));
  walls.push(box('apt-wall-bath', [partX + 0.2, -9.4], [floorY, ceilingY], [bathZ, bathZ + 0.2]));

  // Honed stone underfoot in the wet rooms, as it would be.
  parts.stone.push(box('apt-bath-floor', [partX + 0.2, -9.4], [floorY, floorY + 0.015], [bathZ + 0.2, 10.8]));

  // Kitchen: a run against the wall, an island parallel to it.
  put('apt-kitchen-run', 'kitchen-run', kitchenBackX + 0.33, 5.0, floorY, 'east');
  put('apt-kitchen-island', 'kitchen-island', kitchenBackX + 3.3, 5.0, floorY, 'east');

  // Bathroom: vanity on the party wall, bath freestanding in the light.
  put('apt-vanity', 'vanity', partX + 0.46, 7.2, floorY, 'east');
  put('apt-bath', 'bath', -12.4, 7.6, floorY, 'north');
  put('apt-wc', 'wc', -15.2, bathZ + 0.5, floorY, 'south');
  put('apt-shower', 'shower-screen', -10.6, 5.2, floorY, 'north');

  return { parts, forms, walls, soffit, models };
}

export type { BlobSpec };
