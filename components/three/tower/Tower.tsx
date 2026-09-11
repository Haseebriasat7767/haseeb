'use client';

import { getMaterials } from '@/lib/three/materials';
import { MergedBoxes, Supports } from '../villa/VillaPrimitives';
import type { DetailTier } from '../villa/VillaTypes';
import { Palms } from './Palms';
import type { TowerLayout } from './TowerTypes';

/**
 * The mixed-use tower: five retail levels, fifteen residential, and the
 * amenity deck on the roof between them.
 *
 * Every group here is one merged mesh. That matters more than it does on
 * the villa — fifteen floors of balconies, four glazed elevations and five
 * levels of shopfront come to several thousand volumes, and drawn
 * individually the building would not hold a frame rate on anything.
 * Sorted by material, the whole twenty storeys is about twenty draw calls.
 */
export function Tower({ layout, detail = 'high' }: { layout: TowerLayout; detail?: DetailTier }) {
  const materials = getMaterials();
  const { podium, tower, stair, base, balconies, crown, deck, columns, palms } = layout;

  return (
    <group name="Tower">
      {/* ── Retail podium ─────────────────────────────────────────────── */}
      <MergedBoxes
        name="podium-shell"
        specs={podium.mass}
        material={materials.stone}
        chamfer={0.008}
        chamferSegments={2}
      />
      {/* The retail floor plates. Polished stone, because the atrium floor
          is the surface every one of those lit coves is reflecting in. */}
      <MergedBoxes name="podium-floors" specs={podium.floors} material={materials.marble} />
      <MergedBoxes name="podium-bands" specs={podium.bands} material={materials.concrete} />
      {/* Shopfronts do not cast: a lit opening that throws a shadow reads as
          a solid panel, which is the opposite of what glass is doing here. */}
      <MergedBoxes
        name="podium-glazing"
        specs={podium.glazing}
        material={materials.shopfront}
        castShadow={false}
      />
      <MergedBoxes name="podium-mullions" specs={podium.mullions} material={materials.darkMetal} />
      <MergedBoxes name="podium-soffit" specs={podium.soffits} material={materials.concrete} />
      {/* The lit reveal under each retail band. */}
      <MergedBoxes
        name="podium-signage"
        specs={podium.signage}
        material={materials.lightStrip}
        castShadow={false}
        receiveShadow={false}
      />
      <Supports specs={columns} material={materials.stone} />
      {/* Atrium balustrades, their capping rails, the coves that light the
          void, and the roof light over the whole five storeys. */}
      <MergedBoxes
        name="atrium-balustrades"
        specs={podium.balustrades}
        material={materials.glazing}
        castShadow={false}
      />
      <MergedBoxes name="atrium-rails" specs={podium.rails} material={materials.bronze} />
      <MergedBoxes
        name="atrium-coves"
        specs={podium.coves}
        material={materials.lightStrip}
        castShadow={false}
        receiveShadow={false}
      />
      <MergedBoxes
        name="atrium-skylight"
        specs={podium.skylight}
        material={materials.glazing}
        castShadow={false}
      />

      {/* ── The base ──────────────────────────────────────────────────── */}
      {/* The plinth the whole thing stands on, the flight up to it and the
          walls that hold its edge. Paving on top, stone at the edges — the
          two materials are what tell you the terrace is a made platform and
          not just higher ground. */}
      <MergedBoxes name="base-terrace" specs={base.terrace} material={materials.paving} />
      <MergedBoxes name="base-steps" specs={base.steps} material={materials.stone} />
      <MergedBoxes name="base-walls" specs={base.seatWalls} material={materials.stone} />
      {/* The door surround. Bronze, standing proud of the glass, because the
          entrance to a twenty-storey building should be findable from the
          far side of the forecourt. */}
      <MergedBoxes name="base-portal" specs={base.portal} material={materials.bronze} />

      {/* ── The stair ─────────────────────────────────────────────────── */}
      {/* Runs the whole height of the building, so it is neither podium nor
          tower and is drawn once rather than in both. Concrete treads in a
          stone shaft: this is the back of house, and dressing it in the
          lobby's marble would be a lie about what it is. */}
      <MergedBoxes name="stair-shaft" specs={stair.walls} material={materials.stone} />
      <MergedBoxes name="stair-steps" specs={stair.steps} material={materials.concrete} />

      {/* ── Residential tower ─────────────────────────────────────────── */}
      <MergedBoxes
        name="tower-core"
        specs={tower.core}
        material={materials.stone}
        chamfer={0.006}
        chamferSegments={2}
      />
      <MergedBoxes name="tower-slabs" specs={tower.slabs} material={materials.concrete} />
      {/* The apartment floors. Stone rather than concrete: this is the one
          surface of the tower a resident stands on. */}
      <MergedBoxes name="tower-plates" specs={tower.plates} material={materials.marble} />
      <MergedBoxes
        name="tower-glazing"
        specs={tower.glazing}
        material={materials.glazing}
        castShadow={false}
      />
      <MergedBoxes
        name="tower-ceilings"
        specs={tower.ceilings}
        material={materials.plaster}
        castShadow={false}
      />
      <MergedBoxes
        name="tower-fins"
        specs={tower.fins}
        material={materials.bronze}
        chamfer={0.012}
        chamferSegments={2}
      />
      <MergedBoxes name="tower-spandrels" specs={tower.spandrels} material={materials.concrete} />

      {/* ── Balconies ─────────────────────────────────────────────────── */}
      <MergedBoxes
        name="balcony-slabs"
        specs={balconies.slabs}
        material={materials.concrete}
        chamfer={0.008}
        chamferSegments={2}
      />
      <MergedBoxes
        name="balcony-glass"
        specs={balconies.glass}
        material={materials.glazing}
        castShadow={false}
      />
      <MergedBoxes
        name="balcony-rails"
        specs={balconies.rails}
        material={materials.bronze}
        chamfer={0.008}
        chamferSegments={2}
      />

      {/* ── Crown ─────────────────────────────────────────────────────── */}
      <MergedBoxes name="crown-parapet" specs={crown.parapets} material={materials.concrete} />
      <MergedBoxes
        name="crown-glow"
        specs={crown.glow}
        material={materials.lightStrip}
        castShadow={false}
        receiveShadow={false}
      />

      {/* ── Amenity deck ──────────────────────────────────────────────── */}
      <MergedBoxes name="deck-paving" specs={deck.paving} material={materials.paving} />
      <MergedBoxes name="deck-upstand" specs={deck.parapet} material={materials.stone} />
      <MergedBoxes
        name="deck-balustrade"
        specs={deck.glass}
        material={materials.glazing}
        castShadow={false}
      />
      <MergedBoxes name="deck-planters" specs={deck.planters} material={materials.stone} />
      <MergedBoxes
        name="deck-pool-shell"
        specs={deck.poolShell}
        material={materials.poolInterior}
      />
      <MergedBoxes
        name="deck-pool-water"
        specs={deck.water}
        material={materials.poolWater}
        castShadow={false}
      />
      <MergedBoxes name="deck-furniture" specs={deck.furniture} material={materials.teak} />
      <Palms specs={palms} detail={detail} name="deck-palms" />
    </group>
  );
}

export default Tower;
