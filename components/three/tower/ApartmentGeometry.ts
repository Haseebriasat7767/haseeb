import type { BlobSpec } from '../villa/landscape/LandscapeTypes';
import type { Form } from '../villa/furniture/FormTypes';
import {
  createBed,
  createBowl,
  createFloorLamp,
  createFloorVessel,
  createHeadboard,
  createLoungeChair,
  createLowTable,
  createNightstand,
  createOttoman,
  createPedestalTable,
  createSofa,
  createTableLamp,
} from '../villa/furniture/Pieces';
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

export type ApartmentLayout = {
  parts: Parts;
  forms: Form[];
  /** Partitions and the fluted faces applied to them. */
  walls: BoxSpec[];
  /** The dropped soffit over the lounge. */
  soffit: BoxSpec[];
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
  const soffitX: Range = [-8.2, 2.4];
  const soffitZ: Range = [-4.8, 4.8];
  // A cove is a hidden source washing the slab above it, not a lit strip
  // you look at. So: a thin dropped plane held well below the structural
  // ceiling, and the light line sitting on top of its edge, inboard, where
  // nothing at standing height can see it.
  //
  // The first attempt built the villa's detail instead — a matte black
  // channel with the strip inside it, which works at the scale of a
  // bedhead reveal and, stretched eleven metres across a ceiling and seen
  // edge-on, reads as a black gash. There is no channel here at all.
  const dropY: Range = [ceilingY - 0.4, ceilingY - 0.24];

  soffit.push(box('apt-soffit', soffitX, dropY, soffitZ));

  const coveY: Range = [dropY[1], dropY[1] + 0.045];
  const inset = 0.07;
  const cx: Range = [soffitX[0] + inset, soffitX[1] - inset];
  const cz: Range = [soffitZ[0] + inset, soffitZ[1] - inset];
  parts.strip.push(box('apt-cove-n', cx, coveY, [cz[0], cz[0] + 0.07]));
  parts.strip.push(box('apt-cove-s', cx, coveY, [cz[1] - 0.07, cz[1]]));
  parts.strip.push(box('apt-cove-w', [cx[0], cx[0] + 0.07], coveY, cz));
  parts.strip.push(box('apt-cove-e', [cx[1] - 0.07, cx[1]], coveY, cz));

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
  createSofa(forms, 'apt-sofa', { at: [0.9, 0.2], floorY, facing: 'west', seed: 31 }, {
    width: 3.2,
    depth: 1.08,
  });
  // Two chairs turned back toward it, closing the group.
  createLoungeChair(forms, 'apt-chair-a', { at: [-4.6, -3.3], floorY, facing: 'east', seed: 47 }, {
    width: 1.04,
  });
  createLoungeChair(forms, 'apt-chair-b', { at: [-4.4, 3.4], floorY, facing: 'east', seed: 53 }, {
    width: 1.04,
  });
  createOttoman(forms, 'apt-ottoman', { at: [-1.6, 3.7], floorY, facing: 'north', seed: 59 }, {
    width: 0.96,
    depth: 0.64,
  });

  // A cluster of low tables rather than one — the reference for this room
  // is three organic drums at different heights, not a rectangle.
  createLowTable(forms, 'apt-table', { at: [-2.4, 0.1], floorY, facing: 'west', seed: 61 }, {
    width: 1.2,
    depth: 0.82,
    height: 0.34,
  });
  createPedestalTable(forms, 'apt-drum-a', [-3.5, -1.4], floorY, { height: 0.44, radius: 0.3, seed: 67 });
  createPedestalTable(forms, 'apt-drum-b', [-1.4, 1.5], floorY, { height: 0.29, radius: 0.26, seed: 71 });
  createBowl(forms, 'apt-bowl', [-2.4, 0.1], floorY + 0.34, { radius: 0.18, height: 0.11 });

  createFloorLamp(forms, 'apt-lamp', [-6.6, 5.1], floorY, 1.62);
  createFloorVessel(forms, 'apt-urn', [-7.4, -5.2], floorY, { height: 0.7, radius: 0.23, material: 'ceramic' });

  // ── Lounge: planting ──────────────────────────────────────────────────
  // Two indoor trees, in the corners where the glass turns. Every one of
  // the reference interiors has one there, and it is not decoration: a tall
  // plant is what breaks the vertical line of a corner mullion.
  const plant = (key: string, px: number, pz: number, height: number, seed: number) => {
    // The pot, then the canopy as blob clusters the card renderer draws.
    createFloorVessel(forms, `${key}-pot`, [px, pz], floorY, {
      height: height * 0.26,
      radius: height * 0.15,
      material: 'ceramic',
    });
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

  const bedPlacement = { at: [bedX + 1.9, bedCentreZ] as const, floorY, facing: 'east' as const, seed: 97 };
  createHeadboard(forms, 'apt-headboard', bedPlacement, { width: 2.5, height: 1.2 });
  createBed(forms, 'apt-bed', bedPlacement, { width: 1.98, length: 2.12 });

  createNightstand(forms, 'apt-night-a', [bedX + 0.85, bedCentreZ - 1.5], floorY, 101, 'east');
  createNightstand(forms, 'apt-night-b', [bedX + 0.85, bedCentreZ + 1.5], floorY, 103, 'east');
  createTableLamp(forms, 'apt-lamp-a', [bedX + 0.85, bedCentreZ - 1.5], floorY + 0.52, { height: 0.48 });
  createTableLamp(forms, 'apt-lamp-b', [bedX + 0.85, bedCentreZ + 1.5], floorY + 0.52, { height: 0.48 });

  createLoungeChair(
    forms,
    'apt-bed-chair',
    { at: [bedX + 6.4, bedroomZ[0] + 2.2], floorY, facing: 'south', seed: 107 },
    { width: 1.0 },
  );
  createPedestalTable(forms, 'apt-bed-table', [bedX + 6.4, bedroomZ[0] + 3.6], floorY, {
    height: 0.5,
    radius: 0.24,
    seed: 109,
  });

  plant('apt-bed-tree', bedX + 5.6, bedroomZ[0] + 1.0, 2.3, 839);

  parts.sheer.push(
    box('apt-bed-sheer', [bedX + 3.4, loungeBackX - 0.4], [floorY, ceilingY], [z[0] + 0.28, z[0] + 0.34]),
  );

  return { parts, forms, walls, soffit };
}

export type { BlobSpec };
