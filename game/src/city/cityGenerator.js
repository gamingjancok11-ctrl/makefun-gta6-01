// Seeded city layout: road grid, blocks, buildings, palms, lights, parked cars,
// landmarks. Pure data — cityMeshes.js turns it into three.js meshes.
import { WORLD, PALETTE } from '../config.js';
import { makeRng, hashString } from '../random.js';
import { districtAt } from './districts.js';

const BUILDING_STYLE = {
  tower: { minH: 22, maxH: 58, minW: 14, maxW: 24, perBlock: 1, neon: 0.75 },
  villa: { minH: 6, maxH: 12, minW: 10, maxW: 16, perBlock: 3, neon: 0.05 },
  hangar: { minH: 8, maxH: 12, minW: 20, maxW: 26, perBlock: 1, neon: 0.1 },
  industrial: { minH: 9, maxH: 16, minW: 16, maxW: 24, perBlock: 2, neon: 0.15 },
  market: { minH: 6, maxH: 10, minW: 8, maxW: 14, perBlock: 4, neon: 0.5 },
  marina: { minH: 8, maxH: 18, minW: 10, maxW: 18, perBlock: 2, neon: 0.3 },
  beach: { minH: 4, maxH: 8, minW: 8, maxW: 12, perBlock: 2, neon: 0.1 },
  causeway: { minH: 8, maxH: 16, minW: 12, maxW: 18, perBlock: 2, neon: 0.25 },
  docks: { minH: 10, maxH: 18, minW: 16, maxW: 24, perBlock: 2, neon: 0.2 },
};

export function generateCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const colliders = []; // {x0,z0,x1,z1} ground AABBs
  const palms = [];
  const lights = [];
  const parkedCars = [];
  const crates = [];
  const landmarks = [];

  const lines = WORLD.roadLines;
  // Blocks sit between neighbouring road lines.
  for (let ix = 0; ix < lines.length - 1; ix += 1) {
    for (let iz = 0; iz < lines.length - 1; iz += 1) {
      const bx0 = lines[ix] + WORLD.roadWidth / 2 + 1.5;
      const bz0 = lines[iz] + WORLD.roadWidth / 2 + 1.5;
      const bx1 = lines[ix + 1] - WORLD.roadWidth / 2 - 1.5;
      const bz1 = lines[iz + 1] - WORLD.roadWidth / 2 - 1.5;
      const cx = (bx0 + bx1) / 2;
      const cz = (bz0 + bz1) / 2;
      const district = districtAt(cx, cz);
      const style = BUILDING_STYLE[district.style];
      const blockRng = makeRng(seed ^ hashString(`${ix},${iz}`));
      // A few blocks stay open: plazas, parking, beach.
      if (blockRng.chance(0.12)) {
        if (district.style === 'beach') {
          for (let p = 0; p < 5; p += 1) palms.push({ x: blockRng.float(bx0, bx1), z: blockRng.float(bz0, bz1), s: blockRng.float(0.8, 1.3) });
        } else {
          for (let p = 0; p < 3; p += 1) {
            parkedCars.push({ x: blockRng.float(bx0 + 3, bx1 - 3), z: blockRng.float(bz0 + 3, bz1 - 3), heading: blockRng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]), color: blockRng.pick(PALETTE.car) });
          }
        }
        continue;
      }
      const count = style.perBlock;
      for (let b = 0; b < count; b += 1) {
        const w = blockRng.float(style.minW, style.maxW);
        const d = blockRng.float(style.minW, style.maxW);
        const h = blockRng.float(style.minH, style.maxH);
        // Subdivide the block so buildings do not overlap.
        const cols = Math.ceil(Math.sqrt(count));
        const col = b % cols;
        const row = Math.floor(b / cols);
        const cellW = (bx1 - bx0) / cols;
        const cellD = (bz1 - bz0) / Math.ceil(count / cols);
        const x = bx0 + col * cellW + cellW / 2 + blockRng.float(-1, 1);
        const z = bz0 + row * cellD + cellD / 2 + blockRng.float(-1, 1);
        const color = blockRng.pick(PALETTE.building);
        const neon = blockRng.chance(style.neon) ? blockRng.pick(PALETTE.neon) : 0;
        buildings.push({ x, z, w: Math.min(w, cellW - 2), d: Math.min(d, cellD - 2), h, color, neon, district: district.id });
        colliders.push({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2 });
      }
      if (blockRng.chance(0.5)) {
        parkedCars.push({ x: bx0 + 2, z: bz0 + 2, heading: blockRng.pick([0, Math.PI / 2]), color: blockRng.pick(PALETTE.car) });
      }
      if (district.style === 'docks' && blockRng.chance(0.7)) {
        for (let c = 0; c < 4; c += 1) crates.push({ x: blockRng.float(bx0, bx1), z: blockRng.float(bz0, bz1), s: blockRng.float(1.4, 2.4), color: blockRng.pick(PALETTE.car) });
      }
    }
  }

  // Palms along the beach roads + marina, street lights at intersections.
  for (const line of lines) {
    for (let t = -200; t <= 200; t += 40) {
      if (rng.chance(0.55)) palms.push({ x: line + WORLD.roadWidth / 2 + 3, z: t, s: rng.float(0.8, 1.4) });
      if (rng.chance(0.4)) palms.push({ x: t, z: line + WORLD.roadWidth / 2 + 3, s: rng.float(0.8, 1.4) });
    }
  }
  for (const lx of lines) {
    for (const lz of lines) {
      if (rng.chance(0.5)) lights.push({ x: lx + WORLD.roadWidth / 2 + 1, z: lz + WORLD.roadWidth / 2 + 1 });
    }
  }

  landmarks.push(
    { id: 'crater', name: 'Mount Caldera', x: -150, z: -150, kind: 'volcano' },
    { id: 'tower', name: 'Ember Spire', x: 0, z: -160, kind: 'spire' },
    { id: 'pier', name: 'Marina Pier', x: 200, z: 20, kind: 'pier' },
    { id: 'bridge', name: 'Causeway Bridge', x: 0, z: 200, kind: 'bridge' },
  );

  return {
    seed, buildings, colliders, palms, lights, parkedCars, crates, landmarks,
    roads: lines,
    bounds: WORLD.size / 2,
  };
}

/** Push a circle (x, z, radius) out of every building AABB it overlaps. */
export function resolveCircleColliders(city, pos, radius) {
  for (const c of city.colliders) {
    const nx = Math.max(c.x0, Math.min(pos.x, c.x1));
    const nz = Math.max(c.z0, Math.min(pos.z, c.z1));
    const dx = pos.x - nx;
    const dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * radius;
        pos.z = nz + (dz / d) * radius;
      } else {
        // Centre inside the box: push out along the smallest penetration axis.
        const pushL = pos.x - c.x0 + radius;
        const pushR = c.x1 - pos.x + radius;
        const pushT = pos.z - c.z0 + radius;
        const pushB = c.z1 - pos.z + radius;
        const m = Math.min(pushL, pushR, pushT, pushB);
        if (m === pushL) pos.x = c.x0 - radius;
        else if (m === pushR) pos.x = c.x1 + radius;
        else if (m === pushT) pos.z = c.z0 - radius;
        else pos.z = c.z1 + radius;
      }
    }
  }
  const b = city.bounds - 4;
  pos.x = Math.max(-b, Math.min(b, pos.x));
  pos.z = Math.max(-b, Math.min(b, pos.z));
}

/** Nearest road line coordinate to a value. */
export function nearestRoad(value) {
  let best = WORLD.roadLines[0];
  for (const line of WORLD.roadLines) {
    if (Math.abs(line - value) < Math.abs(best - value)) best = line;
  }
  return best;
}
