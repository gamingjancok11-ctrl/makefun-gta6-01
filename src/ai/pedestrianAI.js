// Pedestrians: sidewalk walkers with varied shirts, who stroll between random
// corners and flee screaming (visually: sprinting away) when shots are fired or
// a car bears down on them. Hitting one is a crime.
import * as THREE from 'three';
import { buildHumanoid } from '../player/playerController.js';
import { WORLD, PALETTE } from '../config.js';
import { makeRng } from '../random.js';
import { resolveCircleColliders } from '../city/cityGenerator.js';

const PED_COUNT = 22;

export function createPedestrians(G) {
  const rng = makeRng(G.seed ^ 0x9e37);
  const peds = [];

  function spawnPed() {
    const line = rng.pick(WORLD.roadLines);
    const t = rng.float(-220, 220);
    const alongX = rng.chance(0.5);
    const x = alongX ? t : line + WORLD.roadWidth / 2 + 2.5;
    const z = alongX ? line + WORLD.roadWidth / 2 + 2.5 : t;
    const mesh = buildHumanoid({ shirt: rng.pick(PALETTE.car), pants: rng.pick([0x2c3e50, 0x6b4a2f, 0x444444]), skin: rng.pick([0xc68642, 0x8d5524, 0xffdbac, 0xf1c27d]) });
    mesh.position.set(x, 0, z);
    G.scene.add(mesh);
    const ped = {
      mesh,
      pos: mesh.position,
      heading: rng.float(0, Math.PI * 2),
      speed: rng.float(1.2, 2),
      target: null,
      fleeing: 0,
      phase: rng.float(0, 6),
      dead: false,
    };
    peds.push(ped);
    return ped;
  }

  for (let i = 0; i < PED_COUNT; i += 1) spawnPed();

  function pickTarget(ped) {
    const line = rng.pick(WORLD.roadLines);
    const t = rng.float(-220, 220);
    ped.target = { x: line + WORLD.roadWidth / 2 + 2.5, z: t };
  }

  return {
    peds,
    /** Called when gunfire happens near (x, z): peds in range flee. */
    scare(x, z, radius) {
      for (const p of peds) {
        if (p.dead) continue;
        if (Math.hypot(p.pos.x - x, p.pos.z - z) < radius) p.fleeing = 4 + Math.random() * 3;
      }
    },
    update(dt) {
      for (const p of peds) {
        if (p.dead) continue;
        if (!p.target) pickTarget(p);
        let speed = p.speed;
        if (p.fleeing > 0) {
          p.fleeing -= dt;
          speed = 6.5;
          // Flee away from the player.
          const pl = G.player.state.pos;
          p.target = { x: p.pos.x + (p.pos.x - pl.x), z: p.pos.z + (p.pos.z - pl.z) };
        }
        const dx = p.target.x - p.pos.x;
        const dz = p.target.z - p.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 2) { pickTarget(p); continue; }
        const want = Math.atan2(dx, dz);
        let diff = want - p.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        p.heading += diff * Math.min(1, dt * 5);
        p.pos.x += Math.sin(p.heading) * speed * dt;
        p.pos.z += Math.cos(p.heading) * speed * dt;
        resolveCircleColliders(G.city, p.pos, 0.6);
        p.mesh.rotation.y = p.heading;
        p.phase += dt * speed * 1.8;
        const s = Math.sin(p.phase) * (p.fleeing > 0 ? 0.9 : 0.55);
        p.mesh.userData.legL.rotation.x = s;
        p.mesh.userData.legR.rotation.x = -s;
        p.mesh.userData.armL.rotation.x = -s * 0.7;
        p.mesh.userData.armR.rotation.x = s * 0.7;
        // Run over by a fast car: ragdoll-ish fall + crime.
        for (const v of G.vehicles) {
          if (v.driver !== 'player' || Math.abs(v.speed) < 4) continue;
          if (Math.hypot(v.pos.x - p.pos.x, v.pos.z - p.pos.z) < 2.2) {
            p.dead = true;
            p.mesh.rotation.x = Math.PI / 2;
            p.mesh.position.y = 0.3;
            G.wanted.commitCrime('pedDown', p.pos);
            G.hud.flash('PEDESTRIAN DOWN', '#ff4444');
          }
        }
      }
    },
  };
}
