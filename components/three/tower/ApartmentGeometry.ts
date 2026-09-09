import type { ArtworkPlacement } from '../ArtworkPanels';
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
    out.push(box(`${key}-${i}`, [at, at + depth], y, [c - step * 0.36, c + step * 0.36]));
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

/**
 * Which way a hung canvas faces.
 *
 * Not the `FACE` table above. That one is for glTF pieces, which are authored
 * facing Blender +Y and arrive facing −Z; a plane faces +Z. The two tables
 * are a quarter turn apart in three of four directions, and using the wrong
 * one hangs every picture flat against the inside of its own wall.
 */
export const PANEL_FACE = {
  /** Outward normal +Z. */
  south: 0,
  north: Math.PI,
  /** Outward normal +X. */
  east: Math.PI / 2,
  west: -Math.PI / 2,
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
  /** DEC-03 — the pictures, and the canvas depth behind each. */
  artwork: ArtworkPlacement[];
  artBodies: BoxSpec[];
};

/**
 * Folds one flat's geometry into another's.
 *
 * Fourteen apartments drawn as fourteen `<Apartment>` groups is fourteen
 * times fifteen draw calls, for a building whose whole point is that it is
 * about twenty. They are the same materials on every floor, so they are one
 * mesh per material for the whole tower — the same reason the balconies are.
 */
export function mergeApartments(flats: readonly ApartmentLayout[]): ApartmentLayout {
  const total = emptyParts();
  const out: ApartmentLayout = {
    parts: total,
    forms: [],
    walls: [],
    soffit: [],
    models: [],
    artwork: [],
    artBodies: [],
  };
  for (const flat of flats) {
    for (const key of Object.keys(total) as (keyof Parts)[]) {
      // Every `Parts` field is an array of something; which something varies
      // by field, and the two sides are the same field on the same type.
      (total[key] as unknown[]).push(...(flat.parts[key] as unknown[]));
    }
    out.forms.push(...flat.forms);
    out.walls.push(...flat.walls);
    out.soffit.push(...flat.soffit);
    out.models.push(...flat.models);
    out.artwork.push(...flat.artwork);
    out.artBodies.push(...flat.artBodies);
  }
  return out;
}

export type ApartmentOptions = {
  /**
   * Distinguishes one flat from the next.
   *
   * Fourteen identical apartments stacked on top of each other is what a
   * tower plan actually is, and what a walkthrough of one must not be: take
   * the lift twice and you would see the same bowl on the same table. So the
   * plan repeats — that is honest — and the dressing does not. Artwork,
   * shelf contents, plant heights and the handing of the seating all come
   * off this number.
   */
  variant?: number;
  /**
   * Prefix for every key, so fourteen flats can be merged into one set of
   * meshes without their keys colliding.
   */
  prefix?: string;
  /**
   * Whether to lay the small things out as well as the furniture.
   *
   * ## What this costs, measured
   *
   * Fourteen fitted flats add 1,810k triangles a frame, and 1,444k of that
   * is the glTF furniture — about 103k a flat, against 26k for all the
   * joinery, fluting, rugs and partitions put together. The boxes were never
   * the problem: a chamfered one is 56 triangles.
   *
   * Everything is merged into one mesh per material, which is what keeps the
   * building at about twenty draw calls, and the price of that is no
   * per-floor frustum culling — all fourteen flats draw wherever you stand.
   * On a desktop GPU 2.7M triangles a frame is unremarkable. On a phone it
   * is not, and the low tier drops the dressing rather than the rooms: the
   * shelf objects, the things on the coffee table, the bedside lamps. A
   * sofa you can sit on is the point; a candle cluster read from four
   * metres is not.
   */
  dressed?: boolean;
};

export function createApartment(
  /** Bounds of the glazed floor plate, and the level's finished floor. */
  x: Range,
  z: Range,
  floorY: number,
  ceilingY: number,
  { variant = 0, prefix = 'apt', dressed = true }: ApartmentOptions = {},
): ApartmentLayout {
  const parts = emptyParts();
  const forms: Form[] = [];
  const models: ModelPlacement[] = [];

  /** Every key, namespaced to this flat, so fourteen can share one mesh. */
  const k = (name: string) => `${prefix}-${name}`;

  // Handing. Alternate floors are the mirror of the one below, which is what
  // a tower plan does anyway — a pair of flats off one lobby are handed.
  const hand = variant % 2 === 0 ? 1 : -1;
  /** Mirrors a Z coordinate on handed floors. */
  const hz = (value: number) => value * hand;
  /** And the facing that goes with it. */
  const hf = (facing: keyof typeof FACE): keyof typeof FACE =>
    hand === 1 || facing === 'east' || facing === 'west'
      ? facing
      : facing === 'north'
        ? 'south'
        : 'north';
  /** Varies the dressing without varying the plan. */
  const vseed = variant * 977;

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
  /**
   * Everything below is clamped to the plate rather than written to it.
   *
   * The tower steps in twice on the way up, so the top three floors are
   * shorter on the ocean end and narrower on both flanks. The fit-out was
   * authored to the full plate: run unchanged on level fourteen it puts the
   * bathroom two metres outside the building and the sofa through the glass.
   */
  const inset = (value: number, margin: number) =>
    Math.max(z[0] + margin, Math.min(z[1] - margin, value));
  /** How far the millwork runs along the wall. */
  const caseZ: Range = [inset(-6.4, 1), inset(6.4, 1)];
  const bedroomZ: Range = [z[0], -1.6];

  // ── Partitions ────────────────────────────────────────────────────────
  walls.push(box(k('wall-lounge'), [loungeBackX, loungeBackX + 0.26], [floorY, ceilingY], z));
  walls.push(
    box(k('wall-bed'), [westX, loungeBackX], [floorY, ceilingY], [bedroomZ[1], bedroomZ[1] + 0.24]),
  );

  // ── Lounge: the millwork and media wall ───────────────────────────────
  // Reading left to right off the sofa: open shelving, then the fluted
  // panel the screen is set into, then more shelving.

  const wallFace = loungeBackX + 0.26;
  const shelfTop = ceilingY - 0.42;

  /**
   * A position across the lounge, 0 at the media wall and 1 at the glass.
   *
   * The room is a different depth on the setback floors, so the seating is
   * placed by proportion. Written in absolute metres — which is how the
   * first fit-out did it, correctly, for the one floor it was built for —
   * the sofa ends up outside the building three floors from the top.
   */
  const loungeDepth = glassX - wallFace;
  const across = (t: number) => wallFace + loungeDepth * t;

  // Carcass — two bays of open shelving flanking the media panel.
  const bays: Range[] = [
    [caseZ[0], -2.3],
    [2.3, caseZ[1]],
  ];

  for (const [bi, bay] of bays.entries()) {
    parts.joinery.push(
      box(k(`case-${bi}-back`), [wallFace, wallFace + 0.06], [floorY, shelfTop], bay),
    );
    // Verticals.
    const divisions = 3;
    for (let i = 0; i <= divisions; i += 1) {
      const c = bay[0] + (span(bay) / divisions) * i;
      parts.joinery.push(
        box(
          k(`case-${bi}-v${i}`),
          [wallFace, wallFace + 0.36],
          [floorY, shelfTop],
          [c - 0.025, c + 0.025],
        ),
      );
    }
    // Shelves, and a lit reveal under each one.
    const rows = 5;
    for (let r = 1; r <= rows; r += 1) {
      const sy = floorY + ((shelfTop - floorY) / (rows + 1)) * r;
      parts.joinery.push(
        box(k(`case-${bi}-s${r}`), [wallFace, wallFace + 0.36], [sy, sy + 0.035], bay),
      );
      parts.channel.push(
        box(k(`case-${bi}-c${r}`), [wallFace + 0.02, wallFace + 0.1], [sy - 0.045, sy], bay),
      );
      parts.strip.push(
        box(
          k(`case-${bi}-l${r}`),
          [wallFace + 0.03, wallFace + 0.09],
          [sy - 0.038, sy - 0.008],
          bay,
        ),
      );

      // Objects on the shelves. Turned vessels and stacked books — the
      // thing that separates joinery from a bookcase somebody lives with.
      const perShelf = dressed ? 3 : 0;
      for (let o = 0; o < perShelf; o += 1) {
        const seed = bi * 191 + r * 37 + o * 11 + vseed;
        const t = (o + 0.5) / perShelf;
        const oz = bay[0] + span(bay) * t + (rand(seed) - 0.5) * 0.5;
        const ox = wallFace + 0.18;
        if (rand(seed + 3) > 0.42) {
          createFloorVessel(forms, k(`vessel-${bi}-${r}-${o}`), [ox, oz], sy + 0.035, {
            height: 0.16 + rand(seed + 5) * 0.26,
            radius: 0.05 + rand(seed + 7) * 0.055,
            material: rand(seed + 9) > 0.5 ? 'ceramic' : 'stone',
          });
        } else {
          const h = 0.05 + rand(seed + 11) * 0.09;
          parts.paper.push(
            box(
              k(`books-${bi}-${r}-${o}`),
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
  flutedPanel(parts.joinery, k('flute'), [-2.3, 2.3], wallFace, [floorY, shelfTop], 0.055);
  parts.dark.push(
    box(
      k('screen'),
      [wallFace + 0.06, wallFace + 0.11],
      [floorY + 0.92, floorY + 1.86],
      [-1.55, 1.55],
    ),
  );

  // ── Lounge: the dropped soffit ────────────────────────────────────────
  // A lowered plane over the seating with a cove around it. In a flat-slab
  // apartment this is the only ceiling modelling there is, and it is what
  // gives the room a centre.
  // The dropped soffit is a model — an amoeba plan with a lit rim around
  // its whole edge, which is the reference room's most recognisable
  // feature and not a shape worth expressing as boxes. Placed by the
  // height a person stands under it.
  put(k('soffit'), 'ceiling-soffit', -3.4, 0.4, ceilingY - 0.42, 'north');

  // ── Lounge: the furniture ─────────────────────────────────────────────
  // Turned toward the media wall, backs to the glass, which is how a room
  // with one spectacular elevation is actually arranged — you do not put
  // the sofa's back to the view by accident, you do it so the chairs
  // opposite face it.

  // The rug sets the room. Everything below is placed against its edges,
  // which is how a seating group is actually laid out — the furniture holds
  // the rug's perimeter and the floor outside it stays clear.
  parts.rugs.push(
    box(k('rug'), [across(0.1), across(0.82)], [floorY, floorY + 0.022], [hz(-4.4), hz(4.4)]),
  );

  // Sofa against the glass end, facing the media wall.
  put(k('sofa'), 'sofa-3seat', across(0.76), hz(0.2), floorY, 'west');
  // Two chairs turned back toward it, closing the group.
  put(k('chair-a'), 'lounge-chair', across(0.335), hz(-3.3), floorY, 'east');
  put(k('chair-b'), 'lounge-chair', across(0.351), hz(3.4), floorY, 'east');
  put(k('ottoman'), 'ottoman', across(0.567), hz(3.7), floorY, hf('north'));

  // A cluster of kidney tables at three heights, overlapping in plan —
  // never a matching pair, and never one rectangle in the middle of a rug.
  put(k('table-a'), 'organic-table-lg', across(0.498), hz(0.2), floorY, hf('north'));
  put(k('table-b'), 'organic-table-sm', across(0.578), hz(-0.85), floorY, 'east');
  put(k('table-c'), 'side-drum', across(0.416), hz(1.35), floorY, hf('north'));

  // Dressed. An undressed table is the tell that a room was arranged by
  // somebody who does not live in it.
  if (dressed) {
    put(k('bowl'), 'bowl', across(0.478), hz(0.55), floorY + 0.43, hf('north'));
    put(k('books'), 'book-stack', across(0.575), hz(-0.9), floorY + 0.34, hf('south'));
    put(k('candles'), 'candle-cluster', across(0.525), hz(-0.15), floorY + 0.43, hf('north'));
    put(k('tray'), 'tray', across(0.416), hz(1.35), floorY + 0.53, 'east');
  }

  put(k('lamp'), 'floor-lamp', across(0.181), hz(inset(5.1, 0.9)), floorY, hf('north'));
  put(k('urn'), 'vessel-tall', across(0.119), hz(inset(-5.2, 0.9)), floorY, hf('north'));

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
        position: [
          px + (r - 0.5) * 0.5,
          crownY + (rand(seed + i * 23) - 0.4) * 0.42,
          pz + (rand(seed + i * 31) - 0.5) * 0.5,
        ],
        radius: 0.42 + r * 0.2,
        scale: [1, 0.86, 1],
        seed: seed + i,
        deform: 0.3,
        detail: 1,
      });
    }
  };

  plant(k('tree-a'), across(0.876), hz(inset(-6.4, 0.9)), 2.5 + rand(vseed + 5) * 0.4, 811 + vseed);
  plant(k('tree-b'), across(0.838), hz(inset(6.2, 0.9)), 2.15 + rand(vseed + 9) * 0.4, 823 + vseed);

  // ── Lounge: sheers at the glass ───────────────────────────────────────
  // Only the voile. A wall of glass on a private floor has no reason to
  // carry heavy curtains, and the sheer is what softens the light.
  parts.sheer.push(
    box(k('sheer-n'), [glassX - 0.34, glassX - 0.28], [floorY, ceilingY], [z[0] + 0.4, -6.6]),
  );
  parts.sheer.push(
    box(k('sheer-s'), [glassX - 0.34, glassX - 0.28], [floorY, ceilingY], [6.6, z[1] - 0.4]),
  );

  // ── Bedroom ───────────────────────────────────────────────────────────
  const bedX = westX + 0.3;
  const bedCentreZ = mid([bedroomZ[0] + 1.2, bedroomZ[1] - 1.2]);

  // A fluted headboard wall, which is the detail the reference bedroom is
  // built around.
  flutedPanel(
    parts.plaster,
    k('bed-flute'),
    [bedroomZ[0] + 0.8, bedroomZ[1] - 0.8],
    bedX,
    [floorY, ceilingY - 0.5],
    0.05,
    0.09,
  );

  parts.rugs.push(
    box(
      k('bed-rug'),
      [bedX + 0.6, bedX + 5.4],
      [floorY, floorY + 0.022],
      [bedCentreZ - 2.6, bedCentreZ + 2.6],
    ),
  );

  // The bed model carries its own headboard and pillows.
  put(k('bed'), 'bed', bedX + 1.9, bedCentreZ, floorY, 'east');
  put(k('night-a'), 'nightstand', bedX + 0.85, bedCentreZ - 1.5, floorY, 'east');
  put(k('night-b'), 'nightstand', bedX + 0.85, bedCentreZ + 1.5, floorY, 'east');
  if (dressed) {
    put(k('lamp-a'), 'table-lamp', bedX + 0.85, bedCentreZ - 1.5, floorY + 0.44, 'east');
    put(k('lamp-b'), 'table-lamp', bedX + 0.85, bedCentreZ + 1.5, floorY + 0.44, 'east');
  }

  put(k('bed-chair'), 'wingback', bedX + 6.4, bedroomZ[0] + 2.2, floorY, 'south');
  put(k('bed-table'), 'side-drum', bedX + 6.4, bedroomZ[0] + 3.6, floorY, 'north');

  plant(k('bed-tree'), bedX + 5.6, bedroomZ[0] + 1.0, 2.3 + rand(vseed + 13) * 0.35, 839 + vseed);

  parts.sheer.push(
    box(
      k('bed-sheer'),
      [bedX + 3.4, loungeBackX - 0.4],
      [floorY, ceilingY],
      [z[0] + 0.28, z[0] + 0.34],
    ),
  );

  // Dining, between the kitchen and the lounge glazing.
  const diningZ = inset(-6.0, 1.4);
  put(k('dining'), 'dining-table', -12.6, diningZ, floorY, 'north');
  for (let i = 0; i < 6; i += 1) {
    const side = i < 3 ? -1 : 1;
    const z = diningZ + ((i % 3) - 1) * 0.78;
    put(
      k(`dchair-${i}`),
      'dining-chair',
      -12.6 + side * 0.86,
      z,
      floorY,
      side < 0 ? 'east' : 'west',
    );
  }

  // ── Kitchen and bathroom ──────────────────────────────────────────────
  //
  // The zone behind the bedroom and west of the lounge was empty floor
  // plate. An apartment without a kitchen or a bathroom does not read as an
  // apartment however well the lounge is dressed — it reads as a showroom.

  const kitchenBackX = westX + 0.3;
  const partX = -16.7;
  const bathZ = 3.8;
  /** The wet rooms run to the flank glazing, wherever that is on this floor. */
  const serviceZ = inset(10.8, 0.3);

  walls.push(box(k('wall-kitchen'), [partX, partX + 0.2], [floorY, ceilingY], [-1.4, serviceZ]));
  walls.push(box(k('wall-bath'), [partX + 0.2, -9.4], [floorY, ceilingY], [bathZ, bathZ + 0.2]));

  // Honed stone underfoot in the wet rooms, as it would be.
  parts.stone.push(
    box(k('bath-floor'), [partX + 0.2, -9.4], [floorY, floorY + 0.015], [bathZ + 0.2, serviceZ]),
  );

  // Kitchen: a run against the wall, an island parallel to it.
  put(k('kitchen-run'), 'kitchen-run', kitchenBackX + 0.33, inset(5.0, 1.6), floorY, 'east');
  put(k('kitchen-island'), 'kitchen-island', kitchenBackX + 3.3, inset(5.0, 1.6), floorY, 'east');

  // Bathroom: vanity on the party wall, bath freestanding in the light.
  put(k('vanity'), 'vanity', partX + 0.46, inset(7.2, 1.2), floorY, 'east');
  put(k('bath'), 'bath', -12.4, inset(7.6, 1.2), floorY, 'north');
  put(k('wc'), 'wc', -15.2, bathZ + 0.5, floorY, 'south');
  put(k('shower'), 'shower-screen', -10.6, inset(5.2, 1.2), floorY, 'north');

  // ── DEC-03 · the pictures ─────────────────────────────────────────────
  //
  // Hung where this plan actually has blank wall, which is less of it than a
  // house would have: the lounge is glazed on three sides and its fourth is
  // millwork, so the two lounge pieces go on the returns of that wall beyond
  // the shelving bays rather than on the bays themselves.
  const artwork: ArtworkPlacement[] = [];
  const artBodies: BoxSpec[] = [];
  const hang = (
    key: string,
    art: string,
    px: number,
    pz: number,
    py: number,
    w: number,
    h: number,
    facing: keyof typeof PANEL_FACE,
  ) => {
    artwork.push({ key, art, position: [px, py, pz], size: [w, h], rotationY: PANEL_FACE[facing] });
    // A stretcher behind the face, so the canvas has a depth and an edge
    // that catches the light. Without it these read as posters printed on
    // the plaster — which is what a decal is, and what this must not be.
    const normal = facing === 'east' || facing === 'west' ? 0 : 2;
    const depth = 0.045;
    // Clearance, not just an offset. Setting the body's centre at exactly
    // half its own depth puts its front face ON the picture plane, and two
    // coplanar surfaces z-fight — which rendered as a hard stair-stepped
    // wedge of dark metal across the top two thirds of every canvas, and
    // looked convincingly like a lighting bug for as long as it took to
    // render one unlit.
    const gap = 0.006;
    const back = facing === 'east' || facing === 'south' ? -(depth / 2 + gap) : depth / 2 + gap;
    artBodies.push({
      key: `${key}-body`,
      position: normal === 0 ? [px + back, py, pz] : [px, py, pz + back],
      scale: normal === 0 ? [depth, h - 0.03, w - 0.03] : [w - 0.03, h - 0.03, depth],
    });
  };

  const artY = floorY + 1.62;
  /**
   * A different hang on every floor.
   *
   * Six works and five walls, rotated by the floor: the same collection
   * appearing in the same five places fourteen times is the tell that a
   * building was stamped rather than fitted out. Rotating is honest here in
   * a way inventing more art would not be — these are the six DEC-03 pieces
   * that exist, and the rotation just deals them differently.
   */
  const works = ['art-01', 'art-02', 'art-03', 'art-04', 'art-05', 'art-06'];
  const work = (slot: number) => works[(slot + variant) % works.length] as string;
  // Lounge, on the millwork wall's two blank returns. The camera stands in
  // the corner looking into the room, so these sit either side of frame.
  hang(k('art-lounge-s'), work(0), wallFace + 0.03, inset(8.4, 1.2), artY, 1.3, 1.3, 'east');
  hang(k('art-lounge-n'), work(5), wallFace + 0.03, inset(-8.5, 1.2), artY, 1.6, 0.96, 'east');
  // Bedroom, over the bed on the fluted headboard wall.
  hang(k('art-bed'), work(3), bedX + 0.08, bedCentreZ, floorY + 1.95, 1.05, 1.4, 'east');
  // The dining end, on the back of the lounge partition.
  hang(k('art-dining'), work(1), loungeBackX - 0.03, inset(-6.2, 1.2), artY, 1.24, 1.24, 'west');
  // And on the bedroom partition, facing the kitchen and dining side.
  hang(k('art-hall'), work(2), -13.4, bedroomZ[1] + 0.27, artY, 1.34, 1.34, 'south');

  return { parts, forms, walls, soffit, models, artwork, artBodies };
}

export type { BlobSpec };
