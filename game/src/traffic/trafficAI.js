// Ambient traffic: cars cruise the road grid, turn at intersections, brake for
// the car ahead, and respawn near the player so the streets always feel alive.
// Traffic cars can be stolen — that is a crime (see wantedSystem).
import { buildCar } from '../vehicles/vehicleModels.js';
import { createVehicle, driveVehicle } from '../vehicles/drivingPhysics.js';
import { WORLD, PALETTE } from '../config.js';
import { makeRng } from '../random.js';

const TRAFFIC_COUNT = 16;
const CRUISE = 11;

export function createTraffic(G) {
  const rng = makeRng(G.seed ^ 0x5eed);
  const cars = [];
  const kinds = ['sedan', 'sedan', 'taxi', 'pickup', 'sports'];

  function spawnCar(far) {
    const alongX = rng.chance(0.5);
    const line = rng.pick(WORLD.roadLines);
    const t = rng.float(-220, 220);
    const dir = rng.sign();
    const pos = alongX ? { x: t, z: line } : { x: line, z: t };
    if (far) {
      const p = G.player.state.pos;
      if (Math.hypot(pos.x - p.x, pos.z - p.z) < 60) return null;
    }
    const mesh = buildCar({ color: rng.pick(PALETTE.car), kind: rng.pick(kinds) });
    const v = createVehicle(G.scene, mesh, mesh.userData.kind, pos, alongX ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI));
    v.driver = 'traffic';
    v.traffic = { alongX, line, dir, targetSpeed: CRUISE * rng.float(0.85, 1.15) };
    cars.push(v);
    G.vehicles.push(v);
    return v;
  }

  for (let i = 0; i < TRAFFIC_COUNT; i += 1) spawnCar(false);

  function update(dt) {
    for (const v of cars) {
      if (v.driver !== 'traffic') continue;
      const t = v.traffic;
      // At an intersection, sometimes turn onto the crossing road.
      const coord = t.alongX ? v.pos.x : v.pos.z;
      const nearest = WORLD.roadLines.reduce((a, b) => (Math.abs(b - coord) < Math.abs(a - coord) ? b : a));
      if (Math.abs(coord - nearest) < 1.2 && rng.chance(dt * 0.6)) {
        t.alongX = !t.alongX;
        t.line = nearest;
        t.dir = rng.sign();
      }
      // Steer back onto the lane centre.
      const lane = t.alongX ? v.pos.z - t.line : v.pos.x - t.line;
      const wantHeading = t.alongX ? (t.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (t.dir > 0 ? 0 : Math.PI);
      let diff = wantHeading - v.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, diff * 2 - lane * 0.06 * t.dir));
      // Brake for the car ahead.
      let blocked = false;
      for (const o of G.vehicles) {
        if (o === v) continue;
        const dx = o.pos.x - v.pos.x;
        const dz = o.pos.z - v.pos.z;
        const ahead = dx * Math.sin(v.heading) + dz * Math.cos(v.heading);
        const side = Math.abs(dx * Math.cos(v.heading) - dz * Math.sin(v.heading));
        if (ahead > 0 && ahead < 9 && side < 2.4) { blocked = true; break; }
      }
      // Keep inside the grid; U-turn at the edge.
      const edge = t.alongX ? v.pos.x : v.pos.z;
      if (Math.abs(edge) > 215) t.dir *= -1;
      driveVehicle(G, v, dt, {
        throttle: blocked ? 0 : (v.speed < t.targetSpeed ? 0.8 : 0.1),
        brake: blocked ? 1 : 0,
        steer,
        handbrake: false,
      });
      // Respawn far-away cars near the player.
      const p = G.player.state.pos;
      if (Math.hypot(v.pos.x - p.x, v.pos.z - p.z) > 260) {
        const idx = cars.indexOf(v);
        G.scene.remove(v.mesh);
        G.vehicles.splice(G.vehicles.indexOf(v), 1);
        cars.splice(idx, 1);
        spawnCar(true);
      }
    }
  }

  return { cars, update, spawnCar };
}
