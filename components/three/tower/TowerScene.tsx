'use client';

import { useEffect, useMemo } from 'react';
import { getMaterials } from '@/lib/three/materials';
import { disposeSurfaceMaps } from '../textures/SurfaceMaps';
import { ARCHITECTURAL_CHAMFER, ChamferProvider, MergedBoxes } from '../villa/VillaPrimitives';
import { disposeVillaGeometries } from '../villa/VillaPrimitiveCache';
import type { BoxSpec, DetailTier } from '../villa/VillaTypes';
import { FoliageCards } from '../villa/landscape/FoliageCards';
import { createFoliageCards } from '../villa/landscape/FoliageGeometry';
import { Palms } from './Palms';
import { Shoreline } from './Shoreline';
import { Tower } from './Tower';
import { Apartment } from './Apartment';
import { createApartment } from './ApartmentGeometry';
import { createParkLayout } from './Park';
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
}: {
  config?: Partial<TowerConfig>;
  detail?: DetailTier;
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
  const park = useMemo(() => createParkLayout(layout.plan.podiumX[0] - 52, 300), [layout.plan]);

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

  // The one fitted apartment, built to the level the walkthrough enters.
  const apartment = useMemo(
    () =>
      createApartment(
        layout.plan.glazedX,
        layout.plan.towerZ,
        layout.plan.furnishedFloorY,
        layout.plan.furnishedCeilingY,
      ),
    [layout.plan],
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

  useEffect(
    () => () => {
      disposeVillaGeometries();
      disposeSurfaceMaps();
    },
    [],
  );

  return (
    <ChamferProvider value={ARCHITECTURAL_CHAMFER[detail]}>
      <group name="TowerScene">
        {/* The land behind the building. Takes the villa's terrain material,
            which already fades into the atmosphere with distance, so the
            city side of the site has a horizon rather than an edge. */}
        <mesh
          name="ground"
          rotation={[-Math.PI / 2, 0, 0]}
          position={[layout.plan.podiumX[0] - 640, -0.08, 0]}
          material={materials.terrain}
          receiveShadow
        >
          <planeGeometry args={[1400, 1400]} />
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
          <MergedBoxes name="park-lawn" specs={park.lawn} material={materials.grass} castShadow={false} />
          <MergedBoxes name="park-beds" specs={park.beds} material={materials.foliageMid} />
          <MergedBoxes name="park-edging" specs={park.edging} material={materials.stone} />
          <MergedBoxes name="park-path" specs={park.path} material={materials.paving} castShadow={false} />
          <MergedBoxes name="park-benches" specs={park.benches} material={materials.teak} />
          <MergedBoxes name="park-trunks" specs={park.trees.trunks} material={materials.bark} />
          <FoliageCards name="park-canopy" cards={parkCanopy} castShadow={detail === 'high'} />
          <Palms specs={park.palms} detail={detail} name="park-palms" />
        </group>

        <Tower layout={layout} detail={detail} />
        <Apartment layout={apartment} detail={detail} />
        <Shoreline layout={shoreline} detail={detail} />
      </group>
    </ChamferProvider>
  );
}

export default TowerScene;
