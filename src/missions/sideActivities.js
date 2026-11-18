// Side activities: 3 street races (gates + AI rivals + standings), taxi fares,
// 20 Sunset Tapes collectibles, the gun shop, the respray garage and the
// safehouse. Each feeds cash, respect and the % complete counter.
import * as THREE from 'three';
import { ECONOMY } from '../config.js';
import { buildCar } from '../vehicles/vehicleModels.js';
import { createVehicle, driveVehicle } from '../vehicles/drivingPhysics.js';
import { makeRng } from '../random.js';

export const RACES = [
  { id: 'race1', name: 'Neon Sprint', start: [0, -80], gates: [[0, -40], [80, -40], [80, 40], [0, 40], [0, -80]], laps: 1, prize: 300 },
  { id: 'race2', name: 'Causeway Loop', start: [0, 120], gates: [[80, 120], [80, 200], [-80, 200], [-80, 120], [0, 120]], laps: 1, prize: 400 },
  { id: 'race3', name: 'Volcano Climb', start: [-80, -80], gates: [[-160, -80], [-160, -160], [-80, -160], [-80, -80]], laps: 2, prize: 500 },
];

const TAPE_SPOTS = [
  [-180, -180], [-100, -200], [0, -200], [120, -180], [200, -120], [200, -40],
  [-200, -120], [-200, 40], [-120, 120], [-40, 200], [40, 160], [120, 200],
  [200, 120], [160, 80], [-180, 180], [0, 0], [80, -120], [-120, -40],
  [40, -160], [-40, 80],
];

export function createSideActivities(G) {
  const rng = makeRng(G.seed ^ 0x51de);
  const state = {
    race: null, // { def, gateIndex, lap, rivals: [{vehicle, gateIndex, lap, finished}], standings, removeBeacons }
    taxi: null, // { stage, at, fare, timer }
    tapes: 0,
    tapeMeshes: [],
    racesWon: [],
  };

  // Sunset Tapes: glowing discs scattered across the city.
  const tapeGeo = new THREE.CylinderGeometry(0.9, 0.9, 0.18, 12);
  const tapeMat = new THREE.MeshBasicMaterial({ color: 0xff2e88 });
  for (const [x, z] of TAPE_SPOTS) {
    const m = new THREE.Mesh(tapeGeo, tapeMat);
    m.position.set(x, 1.2, z);
    m.rotation.x = Math.PI / 3;
    G.scene.add(m);
    state.tapeMeshes.push({ mesh: m, x, z, taken: false });
  }

  function startRace(def) {
    if (state.race) return;
    const rivals = [];
    for (let i = 0; i < 3; i += 1) {
      const mesh = buildCar({ color: [0x9b59b6, 0x1abc9c, 0xe67e22][i], kind: 'sports' });
      const v = createVehicle(G.scene, mesh, 'sports', { x: def.start[0] + 4 + i * 4, z: def.start[1] - 6 }, Math.PI);
      v.driver = 'race';
      G.vehicles.push(v);
      rivals.push({ vehicle: v, gateIndex: 0, lap: 1, finished: false, name: ['Vex', 'Mira', 'Juno'][i] });
    }
    const beacons = def.gates.map(([x, z]) => G.effects.beacon(x, z, 0x00e5ff));
    state.race = { def, gateIndex: 0, lap: 1, rivals, beacons, finished: false, startTime: G.time.elapsed };
    G.hud.racePanel(def, 4, 1);
    G.hud.flash(`RACE: ${def.name} — GO!`, '#00e5ff');
    G.audio.stinger('go');
  }

  function endRace(won) {
    const race = state.race;
    if (!race) return;
    race.beacons.forEach((rm) => rm());
    for (const r of race.rivals) {
      G.scene.remove(r.vehicle.mesh);
      G.vehicles.splice(G.vehicles.indexOf(r.vehicle), 1);
    }
    if (won) {
      G.player.state.cash += race.def.prize;
      state.racesWon.push(race.def.id);
      G.hud.flash(`RACE WON — +$${race.def.prize}`, '#7cff00');
      G.audio.stinger('cash');
    } else {
      G.hud.flash('RACE LOST', '#ff4444');
    }
    G.hud.racePanel(null);
    state.race = null;
    G.save.autosave();
  }

  function updateRace(dt) {
    const race = state.race;
    if (!race) return;
    const p = G.player.state.pos;
    const gate = race.def.gates[race.gateIndex];
    if (Math.hypot(p.x - gate[0], p.z - gate[1]) < 9) {
      race.gateIndex += 1;
      G.audio.stinger('stage');
      if (race.gateIndex >= race.def.gates.length) {
        race.gateIndex = 0;
        race.lap += 1;
        if (race.lap > race.def.laps) {
          // Player finished: rank by rivals' progress.
          const rivalsAhead = race.rivals.filter((r) => r.finished).length;
          endRace(rivalsAhead === 0);
          return;
        }
      }
      G.hud.racePanel(race.def, position(), race.lap);
    }
    // Rivals follow the gates with rubber-banding.
    for (const r of race.rivals) {
      if (r.finished) continue;
      const g = race.def.gates[r.gateIndex];
      const v = r.vehicle;
      const dist = Math.hypot(v.pos.x - g[0], v.pos.z - g[1]);
      if (dist < 9) {
        r.gateIndex += 1;
        if (r.gateIndex >= race.def.gates.length) {
          r.gateIndex = 0;
          r.lap += 1;
          if (r.lap > race.def.laps) r.finished = true;
        }
      }
      const want = Math.atan2(g[0] - v.pos.x, g[1] - v.pos.z);
      let diff = want - v.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const behind = Math.hypot(v.pos.x - p.x, v.pos.z - p.z);
      const boost = behind > 60 ? 1 : 0.75;
      // Brake for the car ahead (same check as traffic): without it a rival
      // at 166 km/h rear-ends a player braking for a corner and both cars
      // die on the spot — the race shot lost two rivals that way.
      let blocked = false;
      for (const o of G.vehicles) {
        if (o === v || o.dead) continue;
        const dx = o.pos.x - v.pos.x;
        const dz = o.pos.z - v.pos.z;
        const ahead = dx * Math.sin(v.heading) + dz * Math.cos(v.heading);
        const side = Math.abs(dx * Math.cos(v.heading) - dz * Math.sin(v.heading));
        if (ahead > 0 && ahead < 18 && side < 2.8) { blocked = true; break; }
      }
      driveVehicle(G, v, dt, { throttle: blocked ? 0 : boost, brake: blocked ? 1 : 0, steer: Math.max(-1, Math.min(1, diff * 2)), handbrake: Math.abs(diff) > 2 });
    }
  }

  function position() {
    const race = state.race;
    if (!race) return 4;
    const myProgress = (race.lap - 1) * race.def.gates.length + race.gateIndex;
    let pos = 1;
    for (const r of race.rivals) {
      const rp = r.finished ? Infinity : (r.lap - 1) * race.def.gates.length + r.gateIndex;
      if (rp > myProgress) pos += 1;
    }
    return pos;
  }

  function startTaxiFare() {
    const line = G.city.roads[Math.floor(Math.random() * G.city.roads.length)];
    const t = (Math.random() - 0.5) * 400;
    state.taxi = {
      stage: 'pickup',
      at: { x: line, z: t },
      fare: ECONOMY.taxiBaseFare + Math.floor(Math.random() * 60),
      removeBeacon: G.effects.beacon(line, t, 0xf1c40f),
    };
    G.gps.setRoute(state.taxi.at);
    G.hud.flash('TAXI FARE: PICK UP THE PASSENGER', '#f1c40f');
  }

  return {
    state,
    RACES,
    startRace,
    updateRace,
    position,
    /** Interact (E) near a race start / taxi / shop / garage / safehouse. */
    interact() {
      const p = G.player.state.pos;
      for (const def of RACES) {
        if (Math.hypot(p.x - def.start[0], p.z - def.start[1]) < 8 && !state.race) {
          if (!G.player.state.vehicle) { G.hud.flash('YOU NEED A CAR TO RACE', '#ff4444'); return true; }
          startRace(def);
          return true;
        }
      }
      // Taxi: press E while driving a taxi with no active fare.
      if (G.player.state.vehicle && G.player.state.vehicle.kind === 'taxi' && !state.taxi) {
        startTaxiFare();
        return true;
      }
      // Gun shop at the Foundry.
      if (Math.hypot(p.x - -180, p.z - 40) < 8) {
        G.hud.showShop();
        return true;
      }
      // Respray garage at the Docks.
      if (Math.hypot(p.x - 160, p.z - 160) < 8 && G.player.state.vehicle) {
        G.wanted.respray();
        return true;
      }
      // Safehouse in the Heights.
      if (Math.hypot(p.x - -120, p.z - -180) < 8) {
        G.save.saveGame();
        G.player.heal(100);
        G.hud.flash('SAFEHOUSE — GAME SAVED, HEALTH RESTORED', '#7cff00');
        return true;
      }
      return false;
    },
    update(dt) {
      updateRace(dt);
      // Tapes spin + collect.
      for (const t of state.tapeMeshes) {
        if (t.taken) continue;
        t.mesh.rotation.y += dt * 2;
        t.mesh.position.y = 1.2 + Math.sin(G.time.elapsed * 2 + t.x) * 0.2;
        if (Math.hypot(G.player.state.pos.x - t.x, G.player.state.pos.z - t.z) < 2.5) {
          t.taken = true;
          G.scene.remove(t.mesh);
          state.tapes += 1;
          G.audio.stinger('cash');
          G.hud.flash(`SUNSET TAPE ${state.tapes}/20`, '#ff2e88');
          if (state.tapes === 20) {
            G.player.state.cash += ECONOMY.tapeBonus;
            G.hud.flash(`ALL TAPES — BONUS $${ECONOMY.tapeBonus}`, '#7cff00');
          }
          G.save.autosave();
        }
      }
      // Taxi flow.
      if (state.taxi) {
        const p = G.player.state.pos;
        const t = state.taxi;
        if (Math.hypot(p.x - t.at.x, p.z - t.at.z) < 7) {
          if (t.stage === 'pickup') {
            t.stage = 'dropoff';
            t.removeBeacon();
            const line = G.city.roads[Math.floor(Math.random() * G.city.roads.length)];
            const tt = (Math.random() - 0.5) * 400;
            t.at = { x: tt, z: line };
            t.removeBeacon = G.effects.beacon(t.at.x, t.at.z, 0xf1c40f);
            G.gps.setRoute(t.at);
            G.hud.flash('PASSENGER ABOARD — DRIVE TO THE MARKER', '#f1c40f');
          } else {
            t.removeBeacon();
            G.player.state.cash += t.fare;
            G.hud.flash(`FARE COMPLETE — +$${t.fare}`, '#7cff00');
            G.audio.stinger('cash');
            G.gps.clearRoute();
            state.taxi = null;
            G.save.autosave();
          }
        }
      }
    },
  };
}
