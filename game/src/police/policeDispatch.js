// CBPD dispatch: pursuit cruisers that chase and ram, roadblocks at 3★,
// and the searchlight helicopter at 4★. Units carry call signs + states shown
// on the HUD police list, and lose the player if he breaks line of sight.
import * as THREE from 'three';
import { buildPoliceCar, buildHelicopter } from '../vehicles/vehicleModels.js';
import { createVehicle, driveVehicle } from '../vehicles/drivingPhysics.js';
import { makeRng } from '../random.js';

const CALLSIGNS = ['CBPD-07', 'CBPD-12', 'CBPD-19', 'CBPD-23', 'CBPD-31', 'CBPD-42', 'CBPD-55', 'CBPD-66', 'AIR-1'];

export function createPolice(G) {
  const rng = makeRng(G.seed ^ 0xcb9d);
  const units = []; // { vehicle, callsign, state, lostTimer }
  const roadblocks = []; // { vehicles: [v, v], pos }
  let heli = null;
  let heliCallsign = 'AIR-1';
  let spawnCooldown = 0;

  function spawnCruiser() {
    const p = G.player.state.pos;
    const angle = rng.float(0, Math.PI * 2);
    const dist = rng.float(45, 70);
    const x = p.x + Math.cos(angle) * dist;
    const z = p.z + Math.sin(angle) * dist;
    const mesh = buildPoliceCar();
    const v = createVehicle(G.scene, mesh, 'police', { x, z }, Math.atan2(p.x - x, p.z - z));
    v.driver = 'police';
    G.vehicles.push(v);
    const unit = { vehicle: v, callsign: rng.pick(CALLSIGNS), state: 'EN ROUTE', lostTimer: 0 };
    units.push(unit);
    return unit;
  }

  function placeRoadblock() {
    const p = G.player.state.pos;
    const pv = G.player.state.vehicle;
    const heading = pv ? pv.heading : G.player.state.heading;
    const ahead = 55;
    const cx = p.x + Math.sin(heading) * ahead;
    const cz = p.z + Math.cos(heading) * ahead;
    const perp = heading + Math.PI / 2;
    const vs = [];
    for (const off of [-4, 0, 4]) {
      const mesh = buildPoliceCar();
      const v = createVehicle(G.scene, mesh, 'police', { x: cx + Math.sin(perp) * off, z: cz + Math.cos(perp) * off }, perp);
      v.driver = 'roadblock';
      G.vehicles.push(v);
      vs.push(v);
    }
    roadblocks.push({ vehicles: vs, x: cx, z: cz });
    G.hud.flash('ROADBLOCK AHEAD', '#ff4444');
  }

  function dispatchHelicopter() {
    if (heli) return;
    const p = G.player.state.pos;
    const mesh = buildHelicopter();
    mesh.position.set(p.x + 30, 55, p.z - 30);
    G.scene.add(mesh);
    heli = { mesh, angle: 0, callsign: heliCallsign, state: 'AIR SUPPORT' };
    G.hud.flash('POLICE HELICOPTER INBOUND', '#ff4444');
    G.audio.stinger('siren');
  }

  function removeHeli() {
    if (!heli) return;
    G.scene.remove(heli.mesh);
    heli = null;
  }

  function clearRoadblocks() {
    for (const rb of roadblocks) {
      for (const v of rb.vehicles) {
        G.scene.remove(v.mesh);
        G.vehicles.splice(G.vehicles.indexOf(v), 1);
      }
    }
    roadblocks.length = 0;
  }

  function updateUnit(dt, unit) {
    const v = unit.vehicle;
    const p = G.player.state.pos;
    const dist = Math.hypot(v.pos.x - p.x, v.pos.z - p.z);
    // Flash the light bar.
    const t = G.time.elapsed * 8;
    if (v.mesh.userData.lightRed) {
      v.mesh.userData.lightRed.material.emissiveIntensity = Math.sin(t) > 0 ? 2.4 : 0.2;
      v.mesh.userData.lightBlue.material.emissiveIntensity = Math.sin(t) > 0 ? 0.2 : 2.4;
    }
    const seen = dist < 90;
    unit.state = dist < 25 ? 'PURSUIT' : seen ? 'IN SIGHT' : 'SEARCHING';
    if (!seen) {
      unit.lostTimer += dt;
      if (unit.lostTimer > 25) {
        // Give up and despawn far away.
        G.scene.remove(v.mesh);
        G.vehicles.splice(G.vehicles.indexOf(v), 1);
        units.splice(units.indexOf(unit), 1);
        return;
      }
    } else {
      unit.lostTimer = 0;
    }
    // Pursuit steering: aim at the player's position, lead slightly by speed.
    const pv = G.player.state.vehicle;
    const lead = pv ? Math.min(12, Math.abs(pv.speed) * 0.4) : 0;
    const tx = p.x + (pv ? Math.sin(pv.heading) * lead : 0);
    const tz = p.z + (pv ? Math.cos(pv.heading) * lead : 0);
    const want = Math.atan2(tx - v.pos.x, tz - v.pos.z);
    let diff = want - v.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    // Ram: full throttle when close and roughly aligned.
    const throttle = dist > 4 ? 1 : 0.4;
    driveVehicle(G, v, dt, {
      throttle,
      brake: 0,
      steer: Math.max(-1, Math.min(1, diff * 2.2)),
      handbrake: Math.abs(diff) > 1.9,
    });
    // Ramming the player on foot hurts.
    if (dist < 2.4 && Math.abs(v.speed) > 5 && G.player.state.onFoot) {
      G.player.damage(Math.abs(v.speed) * 1.2);
      G.cameraRig.addShake(0.4);
    }
  }

  return {
    units,
    /** Deploy a pursuit cruiser at an exact spot (screenshot staging). */
    deployCruiserAt(x, z, heading) {
      const mesh = buildPoliceCar();
      const v = createVehicle(G.scene, mesh, 'police', { x, z }, heading);
      v.driver = 'police';
      G.vehicles.push(v);
      const unit = { vehicle: v, callsign: rng.pick(CALLSIGNS), state: 'PURSUIT', lostTimer: 0 };
      units.push(unit);
      return unit;
    },
    /** Place a roadblock across the road at an exact spot (staging). */
    placeRoadblockAt(x, z, heading) {
      const perp = heading + Math.PI / 2;
      const vs = [];
      for (const off of [-4, 0, 4]) {
        const mesh = buildPoliceCar();
        const v = createVehicle(G.scene, mesh, 'police', { x: x + Math.sin(perp) * off, z: z + Math.cos(perp) * off }, perp);
        v.driver = 'roadblock';
        G.vehicles.push(v);
        vs.push(v);
      }
      roadblocks.push({ vehicles: vs, x, z });
    },
    get heli() { return heli; },
    get roadblocks() { return roadblocks; },
    onWantedChange(stars, before) {
      if (stars === 0) {
        for (const u of [...units]) {
          G.scene.remove(u.vehicle.mesh);
          G.vehicles.splice(G.vehicles.indexOf(u.vehicle), 1);
        }
        units.length = 0;
        clearRoadblocks();
        removeHeli();
        return;
      }
      if (stars >= 4) dispatchHelicopter();
      else removeHeli();
      if (stars >= 3 && roadblocks.length === 0) placeRoadblock();
      if (stars < 3) clearRoadblocks();
    },
    onCrime() { /* dispatch reacts through the wanted level */ },
    anyUnitSeesPlayer() {
      const p = G.player.state.pos;
      if (heli) return true; // the eye in the sky always sees you
      for (const u of units) {
        if (Math.hypot(u.vehicle.pos.x - p.x, u.vehicle.pos.z - p.z) < 90) return true;
      }
      return false;
    },
    /** HUD police list: callsign, distance, state. */
    listUnits() {
      const p = G.player.state.pos;
      const list = units.slice(0, 5).map((u) => ({
        callsign: u.callsign,
        dist: Math.round(Math.hypot(u.vehicle.pos.x - p.x, u.vehicle.pos.z - p.z)),
        state: u.state,
      }));
      if (heli) list.unshift({ callsign: heli.callsign, dist: Math.round(Math.hypot(heli.mesh.position.x - p.x, heli.mesh.position.z - p.z)), state: heli.state });
      return list;
    },
    update(dt) {
      const stars = G.wanted.state.stars;
      if (stars > 0) {
        spawnCooldown -= dt;
        const wantUnits = Math.min(1 + stars, 6);
        if (units.length < wantUnits && spawnCooldown <= 0) {
          spawnCruiser();
          spawnCooldown = 3;
        }
        if (stars >= 3 && roadblocks.length === 0 && Math.random() < dt * 0.1) placeRoadblock();
        // Roadblocks the player has left behind get recycled (ahead ones stay,
        // however far: a staged roadblock 200m ahead must survive).
        for (const rb of [...roadblocks]) {
          const p = G.player.state.pos;
          const pv = G.player.state.vehicle;
          const hx = pv ? Math.sin(pv.heading) : Math.sin(G.player.state.heading);
          const hz = pv ? Math.cos(pv.heading) : Math.cos(G.player.state.heading);
          const ahead = (rb.x - p.x) * hx + (rb.z - p.z) * hz;
          if (ahead < -60) {
            for (const v of rb.vehicles) {
              G.scene.remove(v.mesh);
              G.vehicles.splice(G.vehicles.indexOf(v), 1);
            }
            roadblocks.splice(roadblocks.indexOf(rb), 1);
          }
        }
      }
      for (const u of [...units]) updateUnit(dt, u);
      if (heli) {
        const p = G.player.state.pos;
        heli.angle += dt * 0.35;
        const r = 32;
        heli.mesh.position.x += ((p.x + Math.cos(heli.angle) * r) - heli.mesh.position.x) * Math.min(1, dt * 1.5);
        heli.mesh.position.z += ((p.z + Math.sin(heli.angle) * r) - heli.mesh.position.z) * Math.min(1, dt * 1.5);
        heli.mesh.position.y = 55;
        heli.mesh.lookAt(p.x, 0, p.z);
        heli.mesh.userData.rotor.rotation.y += dt * 22;
        // Searchlight tracks the player.
        const light = heli.mesh.userData.light;
        light.lookAt(0, 0, 0);
        light.position.set(0, -13, 0);
      }
    },
  };
}
