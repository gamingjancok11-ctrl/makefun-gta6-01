// Arcade driving physics: acceleration, braking/reverse, speed-sensitive
// steering, handbrake drift, building + vehicle collision, damage and smoke.
// One update per vehicle per frame; the player's car is just vehicle #0.
import * as THREE from 'three';
import { resolveCircleColliders } from '../city/cityGenerator.js';

export const CAR_STATS = {
  sedan: { accel: 16, topSpeed: 34, grip: 6.5, turn: 1.9 },
  taxi: { accel: 15, topSpeed: 32, grip: 6.5, turn: 1.9 },
  pickup: { accel: 13, topSpeed: 30, grip: 6, turn: 1.7 },
  sports: { accel: 22, topSpeed: 46, grip: 7.5, turn: 2.3 },
  police: { accel: 20, topSpeed: 42, grip: 7.2, turn: 2.2 },
};

export function createVehicle(scene, mesh, kind, pos, heading) {
  scene.add(mesh);
  mesh.position.set(pos.x, 0, pos.z);
  mesh.rotation.y = heading;
  return {
    mesh,
    kind,
    pos: mesh.position,
    heading,
    speed: 0, // signed m/s, forward positive
    steer: 0,
    health: 100,
    maxHealth: 100,
    drifting: false,
    dead: false,
    isPolice: kind === 'police',
    driver: null, // 'player' | 'traffic' | 'police' | 'race' | null (parked)
    stats: CAR_STATS[kind] || CAR_STATS.sedan,
  };
}

/** Drive a vehicle from control inputs. `ctl`: {throttle, brake, steer, handbrake}. */
export function driveVehicle(G, v, dt, ctl) {
  const s = v.stats;
  if (v.dead) {
    v.speed *= 1 - Math.min(1, dt * 2);
  } else if (ctl.throttle > 0) {
    v.speed += s.accel * ctl.throttle * dt * (v.speed < 0 ? 2.2 : 1);
  } else if (ctl.brake > 0) {
    if (v.speed > 0.5) v.speed -= 30 * ctl.brake * dt;
    else v.speed -= 8 * ctl.brake * dt; // reverse
  } else {
    v.speed -= v.speed * 0.55 * dt;
  }
  if (ctl.handbrake) {
    v.speed -= v.speed * 1.6 * dt;
    v.drifting = Math.abs(v.speed) > 8;
  } else {
    v.drifting = false;
  }
  v.speed = Math.max(-10, Math.min(s.topSpeed, v.speed));
  // Steering: less at speed, more while drifting.
  const speedFactor = 1 / (1 + Math.abs(v.speed) * 0.045);
  const targetSteer = (ctl.steer || 0) * (v.drifting ? 1.5 : 1);
  v.steer += (targetSteer - v.steer) * Math.min(1, dt * 8);
  const turnRate = v.steer * s.turn * speedFactor * Math.sign(v.speed || 1);
  v.heading += turnRate * Math.min(1, Math.abs(v.speed) / 6) * dt * (v.speed >= 0 ? 1 : -1);
  const grip = v.drifting ? 2.2 : s.grip;
  const fx = Math.sin(v.heading);
  const fz = Math.cos(v.heading);
  v.pos.x += fx * v.speed * dt;
  v.pos.z += fz * v.speed * dt;
  // Lateral slide when drifting: keep a little of the old direction.
  if (v.drifting && G.effects && Math.random() < 0.5) {
    G.effects.tyreSmoke(new THREE.Vector3(v.pos.x - fx * 1.5, 0.3, v.pos.z - fz * 1.5));
    if (Math.random() < 0.3) G.effects.skidMark(v.pos, v.heading);
  }
  void grip;
  resolveCircleColliders(G.city, v.pos, 1.9);
  // Vehicle-vehicle bumps.
  for (const other of G.vehicles) {
    if (other === v || other.dead) continue;
    const dx = v.pos.x - other.pos.x;
    const dz = v.pos.z - other.pos.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < 12.5 && d2 > 0.01) {
      const d = Math.sqrt(d2);
      const push = (3.55 - d) * 0.5;
      v.pos.x += (dx / d) * push;
      v.pos.z += (dz / d) * push;
      const impact = Math.abs(v.speed - other.speed);
      if (impact > 6) {
        damageVehicle(G, v, impact * 1.5);
        damageVehicle(G, other, impact * 1.5);
        v.speed *= 0.55;
        if (v.driver === 'player') G.cameraRig.addShake(0.25);
      }
    }
  }
  v.mesh.rotation.y = v.heading;
  // Wheel spin + front-wheel steer.
  const wheels = v.mesh.userData.wheels || [];
  wheels.forEach((w, i) => {
    w.rotation.x += (v.speed / 0.42) * dt;
    if (i < 2) w.rotation.y = v.steer * 0.4;
  });
  // Body lean + damage smoke.
  v.mesh.rotation.z = -v.steer * Math.min(1, Math.abs(v.speed) / 30) * 0.06;
  if (v.health < 35 && Math.random() < dt * 6) {
    G.effects.tyreSmoke(new THREE.Vector3(v.pos.x + Math.sin(v.heading) * 1.5, 1.1, v.pos.z + Math.cos(v.heading) * 1.5));
  }
}

export function damageVehicle(G, v, amount) {
  if (v.dead) return;
  v.health = Math.max(0, v.health - amount);
  if (v.health <= 0) {
    v.dead = true;
    v.speed = 0;
    G.effects.explosion(new THREE.Vector3(v.pos.x, 1, v.pos.z));
    if (v.driver === 'player') G.player.state.vehicle = null;
    if (v.driver === 'player') G.player.state.onFoot = true;
  }
}

export function kmh(v) {
  return Math.abs(v.speed) * 3.6;
}
