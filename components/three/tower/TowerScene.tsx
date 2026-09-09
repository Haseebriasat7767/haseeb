'use client';

import { useEffect, useMemo } from 'react';
import { getMaterials } from '@/lib/three/materials';
import { disposeSurfaceMaps } from '../textures/SurfaceMaps';
import { ARCHITECTURAL_CHAMFER, ChamferProvider, MergedBoxes } from '../villa/VillaPrimitives';
import { disposeVillaGeometries } from '../villa/VillaPrimitiveCache';
import type { BoxSpec, DetailTier } from '../villa/VillaTypes';
import { FoliageCards } from '../villa/landscape/FoliageCards';
import { createFoliageCards } from '../villa/landscape/FoliageGeometry';
import { DecalPlanes } from '../DecalPlanes';
import {
  IDENTITY_SHEET,
  SIGNAGE_SHEET,
  WAYFINDING_SHEET,
  disposeDecalSheets,
} from '../textures/DecalMaps';
import { disposeImperfectionMasks } from '../textures/ImperfectionMaps';
import { createIdentityDecals, createSignageDecals, createWayfindingDecals } from './DecalGeometry';
import { Palms } from './Palms';
import { Shoreline } from './Shoreline';
import { Tower } from './Tower';
import { Amenity } from './Amenity';
import { Apartment } from './Apartment';
import { createAmenity } from './AmenityGeometry';
import { createCore } from './CoreGeometry';
import { setWalkFloors } from '@/lib/three/walk-floors';
import { createWalkCollider } from './WalkCollider';
import { WalkControls } from '../WalkControls';
import { createApartment, mergeApartments } from './ApartmentGeometry';
import { InstancedModels } from '../models/InstancedModels';
import { createParkLayout } from './Park';
import { createMallShops } from './MallShops';
import { createRetailProps } from './RetailProps';
import { createSiteProps } from './SiteProps';
import { createSkyline } from './Skyline';
import { createShorelineLayout, createTowerLayout, TOWER_CONFIG } from './TowerGeometry';
import type { TowerConfig } from './TowerTypes';

/**
 * The oceanfront mixed-use tower and the beach it stands on.
 *
 * A second building in the same engine as the residence, sharing its
 * materials, its primitives, its lighting rig and its finishing chain — the
 * point being that none of that was villa-specific. What is new here is
 * only what this building actually needs: an ocean at swell scale, a beach
 * that falls to the water, and palms.
 *
 * The site is fictional and deliberately unlocated. It is composed for the
 * light rather than surveyed: the sun at golden hour sits low over the
 * water on the building's ocean elevation, which is what puts the sunset
 * in front of the balconies and the pool.
 */
export function TowerScene({
  config,
  detail = 'high',
  walk = false,
}: {
  config?: Partial<TowerConfig>;
  detail?: DetailTier;
  /** Hands the camera to the visitor and builds the collider they walk on. */
  walk?: boolean;
}) {
  const layout = useMemo(
    () => createTowerLayout(config ? { ...TOWER_CONFIG, ...config } : TOWER_CONFIG),
    [config],
  );

  const shoreline = useMemo(() => createShorelineLayout(layout.plan), [layout.plan]);
  const skyline = useMemo(() => createSkyline(), []);

  // The park behind the plaza, laid out from the building's own back line.
  // Clear of the plaza, which already reaches fourteen metres past the
  // podium: at the first setting the path ran straight through the
  // building's own footprint.
  const parkBackX = layout.plan.podiumX[0] - 52;
  const park = useMemo(() => createParkLayout(parkBackX, 300), [parkBackX]);

  // People, cars, a boat, and the loose furniture on the deck.
  const props = useMemo(() => createSiteProps(layout.plan, parkBackX), [layout.plan, parkBackX]);

  // The retail fit-out, on every level around the atrium.
  const retail = useMemo(() => createRetailProps(layout.plan), [layout.plan]);
  // The shops: sixteen demised units off the atrium, with fronts and names.
  const mall = useMemo(
    () => createMallShops(layout.plan, { dressed: detail !== 'low' }),
    [layout.plan, detail],
  );

  // The amenity floor at the base of the tower — gym, spa and residents'
  // lounge, on the one level that opens onto the deck.
  const amenity = useMemo(() => createAmenity(layout.plan), [layout.plan]);

  // The lift lobby, on every residential level. One arrangement repeated,
  // which is what a core is.
  const core = useMemo(
    () => createCore(layout.plan, TOWER_CONFIG.towerLevels, layout.stair.doorX),
    [layout.plan, layout.stair.doorX],
  );

  // Tier 4. Three sheets, three draw calls, and the difference between a
  // podium that is let and one that is not.
  const signage = useMemo(() => createSignageDecals(layout.plan), [layout.plan]);
  const wayfinding = useMemo(() => createWayfindingDecals(layout.plan), [layout.plan]);
  const identity = useMemo(() => createIdentityDecals(layout), [layout]);

  // Broadleaf crowns reuse the villa's card technique — a tree's outline is
  // decided by a texture with leaves and gaps in it, not by geometry.
  const parkCanopy = useMemo(
    () =>
      createFoliageCards(
        park.trees.canopy.map((c) => ({
          key: c.key,
          position: c.position,
          radius: c.radius,
          scale: [1, 0.82, 1] as [number, number, number],
          seed: c.seed,
          deform: 0.3,
          detail: 1 as const,
        })),
        detail,
      ),
    [park.trees.canopy, detail],
  );

  // Every residential floor, fitted out.
  //
  // It used to be one — the level the walkthrough's interior framings stand
  // in — which was right while the camera was on rails and could only ever
  // be in one apartment. Once the lift will take a visitor to any of the
  // fourteen, thirteen of them being empty glazed plates is worse than not
  // offering the floors at all.
  //
  // Level 0 is the amenity deck and is fitted out by `createAmenity`, so the
  // flats start at 1. Each is built to its own plate, which matters above
  // the setbacks where the plate is shorter and narrower than the plan the
  // fit-out was first written for.
  const apartment = useMemo(
    () =>
      mergeApartments(
        layout.residentialPlates
          .filter((plate) => plate.level > 0)
          .map((plate) =>
            createApartment(plate.x, plate.z, plate.floorY, plate.ceilingY, {
              variant: plate.level,
              prefix: `apt${plate.level}`,
              // On a phone, the shelf objects and the coffee-table dressing
              // come out of every flat but the one the tour actually stands
              // in. See `ApartmentOptions.dressed` for the measurements.
              dressed: detail !== 'low' || plate.level === TOWER_CONFIG.furnishedLevel,
            }),
          ),
      ),
    [layout.residentialPlates, detail],
  );

  const materials = getMaterials();

  // The plaza the podium stands in, and the kerb that edges it. Everything
  // landward of this is the ground plane below.
  const plaza = useMemo<BoxSpec[]>(() => {
    const [x0, x1] = layout.plan.podiumX;
    const [z0, z1] = layout.plan.podiumZ;
    const apron = 14;
    return [
      {
        key: 'plaza',
        position: [(x0 + x1) / 2 - apron / 2, -0.04, 0],
        scale: [x1 - x0 + apron * 2, 0.16, z1 - z0 + apron * 2],
      },
    ];
  }, [layout.plan]);

  // The surfaces a visitor can stand on. Built only when they can actually
  // walk — it is a second merged geometry over the whole building and there
  // is no reason to pay for it while the camera is on rails.
  const collider = useMemo(
    () =>
      walk ? createWalkCollider(layout, amenity, core, apartment, mall, shoreline, plaza) : null,
    [walk, layout, amenity, core, apartment, mall, shoreline, plaza],
  );

  useEffect(() => () => collider?.geometry.dispose(), [collider]);

  // Hand the page the floors this building actually has, so the picker over
  // the canvas is a reading of the model rather than a list kept in step by
  // hand. Cleared on unmount: a stale list would offer to take the visitor
  // into a scene that is no longer mounted.
  useEffect(() => {
    if (!walk) return;
    setWalkFloors(layout.walkFloors);
    return () => setWalkFloors([]);
  }, [walk, layout.walkFloors]);

  useEffect(
    () => () => {
      disposeVillaGeometries();
      disposeSurfaceMaps();
      disposeDecalSheets();
      disposeImperfectionMasks();
    },
    [],
  );

  return (
    <ChamferProvider value={ARCHITECTURAL_CHAMFER[detail]}>
      <group name="TowerScene">
        {/* Free roam. Starts on the boardwalk at the ocean entrance, facing
            the colonnade, so the first thing a visitor does is walk in. */}
        {collider ? (
          <WalkControls collider={collider} start={[40, 0.3, 6]} heading={Math.PI / 2} />
        ) : null}
        {/* The land behind the building IS the lawn.
            
            It used to be the villa's terrain material with a separate green
            slab laid over the park, and that slab was the problem: an
            eighty-metre rectangle of bright green on dark ground, whose
            edges were the most visible thing in any aerial. Widening it
            only made a bigger rectangle. Mown ground has no edge because it
            runs past everything you can see, so the ground plane carries
            the grass itself and is sized to end well beyond the fog. */}
        <mesh
          name="ground"
          rotation={[-Math.PI / 2, 0, 0]}
          position={[layout.plan.podiumX[0] - 900, -0.08, 0]}
          material={materials.grass}
          receiveShadow
        >
          <planeGeometry args={[3000, 3000]} />
        </mesh>

        <MergedBoxes name="plaza" specs={plaza} material={materials.paving} castShadow={false} />

        {/* The city across the water. Shadows off throughout: it is half a
            kilometre away, inside the haze, and every one of its faces is
            already lit by the sky rather than by the key. */}
        <group name="Skyline">
          <MergedBoxes
            name="city-ground"
            specs={skyline.ground}
            material={materials.terrain}
            castShadow={false}
          />
          <MergedBoxes
            name="city-masses"
            specs={skyline.masses}
            material={materials.concrete}
            castShadow={false}
            receiveShadow={false}
          />
          {/* Takes the shopfront material, so the city comes up with the
              retail podium as the hour turns — a skyline that stays dark at
              night is the one thing nobody has ever photographed. */}
          <MergedBoxes
            name="city-glass"
            specs={skyline.glass}
            material={materials.shopfront}
            castShadow={false}
            receiveShadow={false}
          />
        </group>

        {/* ── The park ─────────────────────────────────────────────── */}
        <group name="Park">
          <MergedBoxes name="park-beds" specs={park.beds} material={materials.foliageMid} />
          <MergedBoxes name="park-edging" specs={park.edging} material={materials.stone} />
          <MergedBoxes
            name="park-path"
            specs={park.path}
            material={materials.paving}
            castShadow={false}
          />
          <MergedBoxes name="park-benches" specs={park.benches} material={materials.teak} />
          <MergedBoxes name="park-trunks" specs={park.trees.trunks} material={materials.bark} />
          <FoliageCards name="park-canopy" cards={parkCanopy} castShadow={detail === 'high'} />
          <Palms specs={park.palms} detail={detail} name="park-palms" />
        </group>

        <Tower layout={layout} detail={detail} />

        {/* ── The shops ────────────────────────────────────────────────
            Sixteen demised units off the atrium. Merged by material like
            everything else, so the whole mall is six draw calls. */}
        <MergedBoxes name="mall-walls" specs={mall.walls} material={materials.plaster} />
        <MergedBoxes name="mall-floors" specs={mall.floors} material={materials.interiorStone} />
        <MergedBoxes name="mall-fascia" specs={mall.fascia} material={materials.joinery} />
        <MergedBoxes
          name="mall-glazing"
          specs={mall.glazing}
          material={materials.glazing}
          castShadow={false}
        />
        <MergedBoxes
          name="mall-coves"
          specs={mall.coves}
          material={materials.lightStrip}
          castShadow={false}
          receiveShadow={false}
        />

        {/* ── Tier 4 ───────────────────────────────────────────────────
            Signage, wayfinding and the building's own name. Three sheets,
            three draw calls, and the cheapest realism in the schedule: a
            retail podium with no tenant names on it does not read as a
            quiet podium, it reads as an unlet one. */}
        <DecalPlanes
          name="tenant-signage"
          sheet={SIGNAGE_SHEET}
          decals={signage}
          emissiveIntensity={0.62}
        />
        {/* The same sixteen names, on the fascias inside the mall. One sheet
            and one more draw call, because they share the atlas. */}
        <DecalPlanes
          name="mall-signage"
          sheet={SIGNAGE_SHEET}
          decals={mall.signage}
          emissiveIntensity={0.7}
        />
        {/* Painted, not illuminated. A level number is a graphic on a wall. */}
        <DecalPlanes
          name="wayfinding"
          sheet={WAYFINDING_SHEET}
          decals={wayfinding}
          emissiveIntensity={0.14}
        />
        {/* The crown lettering is the one sign on this building that is
            genuinely a light, and it is what the tower is read by after
            dark from a mile up the beach. */}
        <DecalPlanes
          name="identity"
          sheet={IDENTITY_SHEET}
          decals={identity}
          // Dark by day, lit by night — which is what a channel letter on a
          // parapet actually is, and the only way a wordmark reads against
          // stone this pale at golden hour.
          tint="#4a3a26"
          emissiveIntensity={1.35}
        />

        {/* What makes the site look inhabited — the cars and people on the
            plaza, and five storeys of shop fitting around the atrium.

            Instanced, not cloned. Mounted one `Model` per placement this was
            802 draw calls on its own: a clone shares geometry and materials
            but not draw calls, and `retail-shelf` is nineteen primitives
            standing in twenty places. Batched by piece it is a few dozen,
            and the cost stops scaling with how many floors are furnished. */}
        <InstancedModels name="site-props" placements={[...props, ...retail, ...mall.models]} />
        {/* ── The core ─────────────────────────────────────────────── */}
        <group name="Core">
          <MergedBoxes name="core-joinery" specs={core.joinery} material={materials.joinery} />
          <MergedBoxes
            name="core-screens"
            specs={core.screens}
            material={materials.glazing}
            castShadow={false}
          />
          <MergedBoxes name="core-rugs" specs={core.soft} material={materials.rug} />
          <MergedBoxes
            name="core-coves"
            specs={core.coves}
            material={materials.lightStrip}
            castShadow={false}
            receiveShadow={false}
          />
          <InstancedModels name="core-models" placements={core.models} />
        </group>

        <Amenity layout={amenity} />
        <Apartment layout={apartment} detail={detail} />
        <Shoreline layout={shoreline} detail={detail} />
      </group>
    </ChamferProvider>
  );
}

export default TowerScene;
