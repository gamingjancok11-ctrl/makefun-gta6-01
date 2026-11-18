// Screenshot scenes: the 4 staged shots, built through the game's own code.
// Each scene sets up real game state (mission, wanted level, police, race),
// then an autopilot plays it forward for a fixed number of frames so the frame
// shows the game mid-action. window.__shotReady signals the capture.
//   ?shot=chase — cover: golden-hour police chase, 4★, helicopter, mission + timer
//   ?shot=fight — on-foot gunfight at the Foundry warehouse
//   ?shot=race  — Neon Sprint, position 2/4, gates + rivals
//   ?shot=map   — pause screen with the full city map + stats
import * as THREE from 'three';
import { buildCar } from '../vehicles/vehicleModels.js';
import { createVehicle } from '../vehicles/drivingPhysics.js';
import { missionById } from '../missions/storyMissions.js';

const SETTLE_FRAMES = 70;

function giveCar(G, kind, color, x, z, heading, speed) {
  const mesh = buildCar({ color, kind });
  const v = createVehicle(G.scene, mesh, kind, { x, z }, heading);
  v.driver = 'player';
  v.speed = speed;
  G.vehicles.push(v);
  G.player.state.vehicle = v;
  G.player.state.onFoot = false;
  G.player.mesh.visible = false;
  return v;
}

function stageChase(G) {
  // Player in a yellow sports car, speeding east on the Night Market road.
  const v = giveCar(G, 'sports', 0xffd700, -60, 0, Math.PI / 2, 30);
  // Mission 2, stage 2 (deliver + timer + wanted 2) — then push to 4 stars.
  G.missions.startMission(missionById('m2'));
  G.missions.jumpToStage(1);
  G.missions.state.stageTimer = 98;
  G.hud.setMission(G.missions.current, 1);
  G.wanted.setStars(4);
  // Police presence IN the frame: a roadblock far ahead (the player reaches it
  // after capture, so it reads as the chase's destination, not a crash).
  G.police.placeRoadblockAt(170, 0, Math.PI / 2);
  // Clear traffic from the chase corridor so nothing T-bones the hero car.
  for (const v of [...G.vehicles]) {
    if (v.driver === 'traffic' && v.pos.x > -80 && v.pos.x < 170 && Math.abs(v.pos.z) < 9) {
      G.scene.remove(v.mesh);
      G.vehicles.splice(G.vehicles.indexOf(v), 1);
      const ti = G.traffic.cars.indexOf(v);
      if (ti >= 0) G.traffic.cars.splice(ti, 1);
    }
  }
  const dialogue = [
    { speaker: 'Rook', text: 'The whole city is behind you. Do not stop. Do NOT stop.', color: '#ff2e88' },
  ];
  G.hud.showDialogue(dialogue);
  G.player.state.cash = 38420;
  G.combat.state.current = 'rifle';
  if (!G.combat.state.owned.includes('rifle')) G.combat.state.owned.push('rifle');
  G.combat.state.mag.rifle = 18;
  G.combat.state.ammo.rifle = 96;
  // Scripted camera: low chase view from behind-left, city + sunset ahead.
  // Tight: the hero car must fill the frame, not sit in the distance.
  G.cameraRig.script(
    [v.pos.x - 9, 3.5, v.pos.z + 6],
    [v.pos.x + 20, 1.8, v.pos.z],
  );
  return {
    dialogue,
    autopilot() {
      // Dead straight down the z=0 road: any weave steers the car into a
      // building at 160 km/h and the shot loses the car.
      return { throttle: 1, brake: 0, steer: 0, handbrake: false };
    },
  };
}

// Remove a vehicle from the scene entirely (traffic bookkeeping included).
function removeCar(G, v) {
  G.scene.remove(v.mesh);
  G.vehicles.splice(G.vehicles.indexOf(v), 1);
  const ti = G.traffic.cars.indexOf(v);
  if (ti >= 0) G.traffic.cars.splice(ti, 1);
}

// Traffic AND parked cars near a point: parked cars (driver === null) are
// not traffic, and one parked red sedan sat behind the dialogue box in the
// fight shot. The player never has a car in the fight shot, so nothing the
// scene needs is removed.
function clearCarsNear(G, x, z, radius) {
  for (const v of [...G.vehicles]) {
    if ((v.driver === 'traffic' || v.driver === null) && Math.hypot(v.pos.x - x, v.pos.z - z) < radius) {
      removeCar(G, v);
    }
  }
}

function stageFight(G) {
  // On foot at the Foundry warehouse, rifle out, mission 4 kill stage.
  // Clear traffic AND parked cars near the scene so no car photobombs the frame.
  clearCarsNear(G, -150, -40, 50);
  G.player.state.pos.set(-150, 0, -40);
  G.player.state.heading = Math.PI / 2;
  G.player.mesh.visible = true;
  G.player.heal(100); // full health at the start of the settle
  G.missions.startMission(missionById('m4'));
  G.missions.jumpToStage(1);
  // One guard is already down when the frame opens (counter reads 1/4).
  if (G.combat.enemies[0]) G.combat.damageEnemy(G.combat.enemies[0], 999);
  G.combat.state.current = 'rifle';
  if (!G.combat.state.owned.includes('rifle')) G.combat.state.owned.push('rifle');
  if (!G.combat.state.owned.includes('smg')) G.combat.state.owned.push('smg');
  G.combat.state.mag.rifle = 18;
  G.combat.state.ammo.rifle = 96;
  G.wanted.setStars(2);
  const dialogue = [
    { speaker: 'Rook', text: 'Four guards, one warehouse. Walk in like you own it.', color: '#ff2e88' },
  ];
  G.hud.showDialogue(dialogue);
  G.cameraRig.script(
    [-136, 6.5, -26],
    [-162, 1.5, -42],
  );
  let shots = 0;
  return {
    dialogue,
    autopilot() {
      // Keep traffic AND parked cars out of the frame for the whole settle.
      clearCarsNear(G, G.player.state.pos.x, G.player.state.pos.z, 35);
      // The player must be alive at capture: enemy fire is unseeded random
      // (40% hit chance, 8–16 damage per shot), so some runs ended on the
      // WASTED screen. Top the player up every frame — the autopilot runs
      // before the systems update, so no single frame can kill them.
      G.player.heal(100);
      // Aim at the nearest enemy and fire in bursts so tracers show.
      const alive = G.combat.enemies.filter((e) => e.alive);
      if (alive.length > 0 && shots < 14) {
        const e = alive[0];
        G.player.state.heading = Math.atan2(e.pos.x - G.player.state.pos.x, e.pos.z - G.player.state.pos.z);
        if (G.time.frames % 6 === 0) {
          G.combat.fire();
          shots += 1;
        }
      }
      return null;
    },
  };
}

function stageRace(G) {
  const def = G.side.RACES[0];
  const v = giveCar(G, 'sports', 0xe74c3c, 20, -40, Math.PI / 2, 26);
  G.side.startRace(def);
  // Fast-forward: player through gate 1, rivals spread out.
  G.side.state.race.gateIndex = 1;
  G.side.state.race.rivals[0].gateIndex = 2;
  G.side.state.race.rivals[0].vehicle.pos.set(60, 0, -40);
  G.side.state.race.rivals[1].gateIndex = 1;
  G.side.state.race.rivals[1].vehicle.pos.set(10, 0, -34);
  G.side.state.race.rivals[2].gateIndex = 0;
  G.side.state.race.rivals[2].vehicle.pos.set(-10, 0, -46);
  // Rivals roll from the start, facing their next gate: as staged they sat
  // at speed 0 facing north, so the player rear-ended the leader and the
  // bump shoved both cars sideways across the road.
  for (const r of G.side.state.race.rivals) {
    const g = def.gates[r.gateIndex];
    r.vehicle.heading = Math.atan2(g[0] - r.vehicle.pos.x, g[1] - r.vehicle.pos.z);
    r.vehicle.mesh.rotation.y = r.vehicle.heading;
    r.vehicle.speed = 26;
  }
  G.hud.racePanel(def, 2, 1);
  const dialogue = [
    { speaker: 'Vex', text: 'You drive like a tourist. Try keeping up.', color: '#9b59b6' },
  ];
  G.hud.showDialogue(dialogue);
  G.cameraRig.script(
    [v.pos.x - 9, 3.5, v.pos.z + 6],
    [v.pos.x + 20, 1.8, v.pos.z],
  );
  return {
    dialogue,
    autopilot() {
      const race = G.side.state.race;
      const gate = race.def.gates[race.gateIndex];
      const want = Math.atan2(gate[0] - v.pos.x, gate[1] - v.pos.z);
      let diff = want - v.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      // Lane-centering: signed offset from the current leg's centreline
      // (previous gate → next gate). Gate-aim alone recovers too slowly at
      // 160 km/h, so steer back onto the line directly: lat is negative
      // when the car sits left of the leg, and +steer turns left, so adding
      // it pulls the car onto the road instead of the wall. Clamped, so a
      // big offset after a corner is a firm pull, not a full-lock yank.
      const prev = race.gateIndex > 0 ? race.def.gates[race.gateIndex - 1] : race.def.start;
      const dx = gate[0] - prev[0];
      const dz = gate[1] - prev[1];
      const len = Math.hypot(dx, dz) || 1;
      const lat = ((dx / len) * (v.pos.z - prev[1]) - (dz / len) * (v.pos.x - prev[0]));
      const latTerm = Math.max(-0.6, Math.min(0.6, lat * 0.08));
      const steer = Math.max(-1, Math.min(1, diff * 2 + latTerm));
      // Brake for corners: at 166 km/h the turn radius (~60 m) is far wider
      // than the 90° gate turn, so the car used to overshoot the corner into
      // the buildings and get pinned against a wall by the colliders. Slow
      // to cornering speed (~20 m/s) on approach to a sharp turn and hold
      // it while the heading error is large — but never brake below it, or
      // the car crawls through the turn and the shot loses its speed.
      const nextGate = race.def.gates[(race.gateIndex + 1) % race.def.gates.length];
      const ndx = nextGate[0] - gate[0];
      const ndz = nextGate[1] - gate[1];
      const nlen = Math.hypot(ndx, ndz) || 1;
      const turn = Math.acos(Math.max(-1, Math.min(1, (dx * ndx + dz * ndz) / (len * nlen))));
      const distToGate = Math.hypot(gate[0] - v.pos.x, gate[1] - v.pos.z);
      const cornerSpeed = 20;
      const braking = v.speed > cornerSpeed
        && ((turn > 0.5 && distToGate < 35) || Math.abs(diff) > 0.6);
      return { throttle: braking ? 0 : 1, brake: braking ? 1 : 0, steer, handbrake: false };
    },
  };
}

function stageMap(G) {
  // A lived-in save: story half done, tapes collected, cash earned.
  G.missions.setDoneIds(['m1', 'm2', 'm3']);
  G.player.state.cash = 12480;
  G.player.state.respect = 42;
  G.side.state.tapes = 9;
  G.side.state.racesWon = ['race1'];
  G.player.state.pos.set(0, 0, 0);
  G.gps.setRoute({ x: -160, z: -40 });
  G.missions.startMission(missionById('m4'));
  G.pause.open();
  return { autopilot: null };
}

const SCENES = { chase: stageChase, fight: stageFight, race: stageRace, map: stageMap };

/** Stage the named shot (default: chase) and arm the ready signal. */
export function stageShot(G, name) {
  G.audio.ensure(); // radio track names show even without a user gesture
  const fn = SCENES[name] || SCENES.chase;
  const scene = fn(G);
  G.shot = { name, frames: 0, scene, ready: false };
  // Staging fires flashes (wanted stars, race GO) before G.shot existed, so
  // hud.flash's shot-mode guard never saw them — hide any that are up.
  G.hud.clearFlash();
  window.__shotReady = false;
  return G.shot;
}

/** Called every frame while a shot is staged: runs the autopilot, follows with
 * the camera, and signals ready once. NOTE: it must keep running AFTER ready —
 * the car keeps driving and the camera must keep following it, or any delay
 * between the signal and the screenshot leaves the car far from the camera. */
export function updateShot(G, dt) {
  const shot = G.shot;
  if (!shot) return null;
  shot.frames += 1;
  let ctl = null;
  if (shot.scene && shot.scene.autopilot) ctl = shot.scene.autopilot(dt);
  // Re-show the scene's dialogue just before capture so it is in the frame.
  if (shot.frames === SETTLE_FRAMES - 12 && shot.scene && shot.scene.dialogue) {
    G.hud.showDialogue(shot.scene.dialogue);
  }
  // Driving shots: keep the scripted camera glued behind the car so the car
  // never outruns the frame while the scene settles. Tight follow (7 m
  // back, 2.8 m up): the old 11 m / 4.2 m framing plus the camera's speed
  // lag left the hero car a speck in the middle of the road.
  if ((shot.name === 'chase' || shot.name === 'race') && G.player.state.vehicle) {
    const v = G.player.state.vehicle;
    const fx = Math.sin(v.heading);
    const fz = Math.cos(v.heading);
    const rx = -Math.cos(v.heading);
    const rz = Math.sin(v.heading);
    G.cameraRig.script(
      [v.pos.x - fx * 7 + rx * 3, 2.8, v.pos.z - fz * 7 + rz * 3],
      [v.pos.x + fx * 16, 1.5, v.pos.z + fz * 16],
    );
  }
  if (shot.frames >= SETTLE_FRAMES && !shot.ready) {
    shot.ready = true;
    window.__shotReady = true;
  }
  return ctl;
}
