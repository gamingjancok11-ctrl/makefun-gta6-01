// CALDERA BAY — game core: wires every system into one shared context G,
// runs the frame loop, and owns the verbs the player uses every second:
// move, drive, steal a car, talk, shoot, pause, save.
import * as THREE from 'three';
import { WORLD } from '../config.js';
import { createInput } from '../input.js';
import { generateCity } from '../city/cityGenerator.js';
import { buildCityMeshes, updateDaylight } from '../render/cityMeshes.js';
import { createChaseCamera } from '../render/chaseCamera.js';
import { createEffects } from '../render/effects.js';
import { createPlayer } from '../player/playerController.js';
import { buildCar } from '../vehicles/vehicleModels.js';
import { createVehicle, driveVehicle, kmh } from '../vehicles/drivingPhysics.js';
import { createTraffic } from '../traffic/trafficAI.js';
import { createPedestrians } from '../ai/pedestrianAI.js';
import { createWanted } from '../police/wantedSystem.js';
import { createPolice } from '../police/policeDispatch.js';
import { createCombat } from '../combat/weapons.js';
import { createMissionRunner } from '../missions/missionRunner.js';
import { createSideActivities } from '../missions/sideActivities.js';
import { createGps } from '../hud/gpsRoute.js';
import { createMinimap } from '../hud/minimap.js';
import { createHud } from '../hud/hud.js';
import { createAudio } from '../audio/audioEngine.js';
import { createSave } from '../save/saveGame.js';
import { createMenus } from '../ui/menus.js';
import { createPauseScreen } from '../ui/pauseScreen.js';
import { stageShot, updateShot } from '../shots/screenshotScenes.js';

export function createGame() {
  const params = new URLSearchParams(window.location.search);
  const seed = parseInt(params.get('seed') || String(WORLD.defaultSeed), 10) || WORLD.defaultSeed;
  const shotName = params.get('shot');
  const fixed = params.get('fixed') === '1';

  const canvas = document.getElementById('game-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffd9a0);
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
  camera.position.set(-30, 20, 40);

  const G = {
    seed, shotName, fixed,
    renderer, scene, camera,
    time: { elapsed: 0, dayTime: WORLD.goldenHour, frames: 0 },
    vehicles: [],
    started: false,
    paused: false,
    shopOpen: false,
    shot: null,
  };
  G.input = createInput(canvas);
  G.city = generateCity(seed);
  const sunRig = buildCityMeshes(scene, G.city);
  G.sunRig = sunRig;
  G.effects = createEffects(scene);
  G.cameraRig = createChaseCamera(camera);
  G.player = createPlayer(scene, new THREE.Vector3(-20, 0, -20));
  G.gps = createGps(G);
  G.wanted = createWanted(G);
  G.police = createPolice(G);
  G.combat = createCombat(G);
  G.missions = createMissionRunner(G);
  G.side = createSideActivities(G);
  G.traffic = createTraffic(G);
  G.peds = createPedestrians(G);
  G.audio = createAudio();
  G.save = createSave(G);
  G.hud = createHud(G);
  G.minimap = createMinimap(G, document.getElementById('minimap'));
  G.menus = createMenus(G);
  G.pause = createPauseScreen(G);
  window.__game = G;
  window.__shotReady = false;

  // Parked cars from the city layout (stealable).
  for (const pc of G.city.parkedCars.slice(0, 40)) {
    const mesh = buildCar({ color: pc.color, kind: 'sedan' });
    const v = createVehicle(scene, mesh, 'sedan', { x: pc.x, z: pc.z }, pc.heading);
    v.driver = null;
    G.vehicles.push(v);
  }

  // First click anywhere unlocks audio.
  window.addEventListener('pointerdown', () => G.audio.ensure(), { once: true });
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  function nearestVehicle(maxDist) {
    const p = G.player.state.pos;
    let best = null;
    let bestD = maxDist;
    for (const v of G.vehicles) {
      if (v.dead || v.driver === 'police' || v.driver === 'race' || v.driver === 'roadblock') continue;
      const d = Math.hypot(v.pos.x - p.x, v.pos.z - p.z);
      if (d < bestD) { bestD = d; best = v; }
    }
    return best;
  }

  function enterCar(v) {
    const wasTraffic = v.driver === 'traffic';
    v.driver = 'player';
    G.player.state.vehicle = v;
    G.player.state.onFoot = false;
    G.player.mesh.visible = false;
    G.player.state.pos.copy(v.pos);
    G.hud.flash(v.kind === 'taxi' ? 'TAXI — PRESS E FOR A FARE' : 'CAR STOLEN', '#ffcc00');
    if (wasTraffic || v.kind) G.wanted.commitCrime('carTheft', v.pos);
    G.audio.stinger('stage');
  }

  function exitCar() {
    const v = G.player.state.vehicle;
    if (!v) return;
    v.driver = null;
    v.speed *= 0.3;
    G.player.state.vehicle = null;
    G.player.state.onFoot = true;
    G.player.mesh.visible = true;
    const side = 2.6;
    G.player.state.pos.set(v.pos.x - Math.cos(v.heading) * side, 0, v.pos.z + Math.sin(v.heading) * side);
    G.player.state.heading = v.heading;
  }

  function interact() {
    if (G.shopOpen) { G.hud.hideShop(); return; }
    if (G.missions.interact()) return;
    if (G.side.interact()) return;
  }

  G.startGame = (continueSave) => {
    if (continueSave) G.save.loadGame();
    G.started = true;
    G.menus.hideTitle();
    document.getElementById('hud').style.display = 'block';
    G.hud.showObjective(continueSave ? 'Welcome back to Caldera Bay' : 'Welcome to Caldera Bay — press M to start the story');
    if (shotName) {
      stageShot(G, shotName);
    }
  };

  const clock = new THREE.Clock();
  let deathShown = false;

  function frame() {
    requestAnimationFrame(frame);
    const rawDt = clock.getDelta();
    const dt = Math.min(0.05, rawDt);
    G.time.frames += 1;

    // Title-screen backdrop: slow orbit over the city.
    if (!G.started) {
      const t = G.time.elapsed;
      camera.position.set(Math.cos(t * 0.05) * 90, 42, Math.sin(t * 0.05) * 90);
      camera.lookAt(0, 0, -40);
      G.time.elapsed += dt;
      updateDaylight(sunRig, G.time.dayTime);
      renderer.render(scene, camera);
      return;
    }

    const shotCtl = G.shot ? updateShot(G, dt) : null;

    // Escape works paused or not: the pause screen's own button says
    // RESUME (Esc), so the key must close the pause screen as well as open
    // it. It lives outside the !G.paused block below — pause.open() sets
    // G.paused, and a check inside that block could never fire while paused.
    if (G.input.wasPressed('Escape')) {
      if (G.shopOpen) G.hud.hideShop();
      else if (G.pause.isOpen) G.pause.close();
      else G.pause.open();
    }

    if (!G.paused) {
      G.time.elapsed += dt;
      G.time.dayTime = (G.time.dayTime + dt * (24 / WORLD.dayLengthSeconds)) % 24;
      updateDaylight(sunRig, G.time.dayTime);

      // Mouse look.
      const md = G.input.takeMouseDelta();
      if (md.x !== 0 || md.y !== 0) G.cameraRig.applyLook(md.x, md.y);

      // Global keys.
      if (G.input.wasPressed('KeyH')) G.menus.toggleHelp();
      if (G.input.wasPressed('KeyQ')) {
        const st = G.audio.nextStation();
        if (st) G.hud.flash(`RADIO: ${st.name}`, '#00e5ff');
      }
      if (G.input.wasPressed('KeyM')) G.missions.startNextMission();

      const P = G.player.state;
      if (P.dead) {
        P.deadTimer += dt;
        if (P.deadTimer > 1.5 && !deathShown) {
          deathShown = true;
          G.menus.showDeath();
        }
      } else {
        deathShown = false;
      }

      if (!P.dead) {
        if (G.input.wasPressed('KeyE')) {
          if (P.onFoot) {
            const v = nearestVehicle(4.5);
            if (v) enterCar(v);
            else interact();
          } else {
            exitCar();
          }
        }

        if (P.onFoot) {
          // Camera-relative WASD.
          const yaw = G.cameraRig.yaw;
          const fx = -Math.sin(yaw);
          const fz = -Math.cos(yaw);
          const rx = Math.cos(yaw);
          const rz = -Math.sin(yaw);
          let mx = 0;
          let mz = 0;
          if (G.input.isDown('KeyW')) { mx += fx; mz += fz; }
          if (G.input.isDown('KeyS')) { mx -= fx; mz -= fz; }
          if (G.input.isDown('KeyD')) { mx += rx; mz += rz; }
          if (G.input.isDown('KeyA')) { mx -= rx; mz -= rz; }
          const len = Math.hypot(mx, mz);
          const move = len > 0 ? { x: mx / len, z: mz / len } : null;
          G.player.moveOnFoot(G, dt, move, G.input.isDown('ShiftLeft') || G.input.isDown('ShiftRight'));
        } else if (P.vehicle) {
          const ctl = shotCtl || {
            throttle: G.input.isDown('KeyW') ? 1 : 0,
            brake: G.input.isDown('KeyS') ? 1 : 0,
            steer: (G.input.isDown('KeyA') ? 1 : 0) + (G.input.isDown('KeyD') ? -1 : 0),
            handbrake: G.input.isDown('Space'),
          };
          driveVehicle(G, P.vehicle, dt, ctl);
          P.pos.copy(P.vehicle.pos);
        }
      }

      // Systems.
      G.traffic.update(dt);
      G.peds.update(dt);
      G.police.update(dt);
      G.wanted.update(dt);
      G.combat.update(dt);
      G.missions.update(dt);
      G.side.update(dt);
      G.effects.update(dt);
      G.audio.update(dt, P.vehicle ? kmh(P.vehicle) : 0, !!P.vehicle);

      // Camera follows the player (or the scripted shot camera).
      const focus = new THREE.Vector3(P.pos.x, 1.8, P.pos.z);
      G.cameraRig.update(dt, focus, !!P.vehicle, P.vehicle ? kmh(P.vehicle) : 0);

      // HUD + minimap.
      G.hud.update(dt);
      G.minimap.update();
    }

    G.input.endFrame();
    renderer.render(scene, camera);
  }

  return {
    G,
    start() {
      if (shotName) {
        // Screenshot mode: skip the title, start straight into the staged scene.
        G.startGame(false);
      } else {
        G.menus.showTitle();
      }
      frame();
    },
  };
}
