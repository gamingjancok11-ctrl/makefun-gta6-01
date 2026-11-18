// The mission runner: stage machine, objective markers, GPS routing, timers,
// payouts, failure + restart, and the JOB COMPLETE flow. Missions are data in
// storyMissions.js; this file only runs them.
import * as THREE from 'three';
import { nextMission, missionById } from './storyMissions.js';
import { buildCar } from '../vehicles/vehicleModels.js';
import { createVehicle } from '../vehicles/drivingPhysics.js';

export function createMissionRunner(G) {
  const state = {
    current: null, // mission object
    stageIndex: 0,
    stageKills: 0,
    stageCollected: 0,
    stageTimer: 0,
    doneIds: [],
    failed: false,
    removeBeacon: null,
    collectibles: [], // { mesh, pos, taken }
    stageCar: null,
  };

  function clearStageArt() {
    if (state.removeBeacon) { state.removeBeacon(); state.removeBeacon = null; }
    for (const c of state.collectibles) G.scene.remove(c.mesh);
    state.collectibles = [];
    G.gps.clearRoute();
  }

  function stageTarget(stage) {
    if (!stage.at) return null;
    return { x: stage.at[0], z: stage.at[1] };
  }

  function setupStage() {
    clearStageArt();
    G.combat.clearEnemies();
    const stage = state.current.stages[state.stageIndex];
    state.stageKills = 0;
    state.stageCollected = 0;
    state.stageTimer = stage.timer || 0;
    const target = stageTarget(stage);
    if (target) {
      state.removeBeacon = G.effects.beacon(target.x, target.z, 0xffd700);
      G.gps.setRoute(target);
    }
    if (stage.spawnEnemies) {
      for (let i = 0; i < stage.spawnEnemies; i += 1) {
        const a = (i / stage.spawnEnemies) * Math.PI * 2;
        G.combat.spawnEnemy(target.x + Math.cos(a) * (8 + i * 2), target.z + Math.sin(a) * (8 + i * 2), `Volcano Boy ${i + 1}`);
      }
    }
    if (stage.spawnCar) {
      const mesh = buildCar({ color: stage.spawnCar.color, kind: stage.spawnCar.kind });
      const v = createVehicle(G.scene, mesh, stage.spawnCar.kind, { x: target.x, z: target.z }, 0);
      v.driver = null;
      G.vehicles.push(v);
      state.stageCar = v;
    }
    if (stage.count && stage.kind === 'collect') {
      for (let i = 0; i < stage.count; i += 1) {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(1.2, 0.9, 1.2),
          new THREE.MeshLambertMaterial({ color: 0x27ae60, emissive: 0x1e8449, emissiveIntensity: 0.6 }),
        );
        const a = (i / stage.count) * Math.PI * 2;
        mesh.position.set(target.x + Math.cos(a) * 6, 0.45, target.z + Math.sin(a) * 6);
        G.scene.add(mesh);
        state.collectibles.push({ mesh, pos: mesh.position, taken: false });
      }
    }
    if (stage.wanted) G.wanted.setStars(Math.max(G.wanted.state.stars, stage.wanted));
    G.hud.setMission(state.current, state.stageIndex);
    G.hud.showObjective(stage.text);
  }

  function advanceStage() {
    G.audio.stinger('stage');
    state.stageIndex += 1;
    if (state.stageIndex >= state.current.stages.length) completeMission();
    else setupStage();
  }

  function completeMission() {
    const m = state.current;
    clearStageArt();
    G.combat.clearEnemies();
    state.doneIds.push(m.id);
    G.player.state.cash += m.payout;
    G.player.state.respect += 10;
    G.hud.jobComplete(m);
    G.audio.stinger('cash');
    state.current = null;
    G.save.autosave();
    G.hud.setMission(null, 0);
  }

  function failMission(reason) {
    clearStageArt();
    G.combat.clearEnemies();
    G.hud.flash(`MISSION FAILED — ${reason}`, '#ff4444');
    G.audio.stinger('fail');
    state.current = null;
    state.failed = true;
    G.hud.setMission(null, 0);
  }

  return {
    state,
    get current() { return state.current; },
    get doneIds() { return state.doneIds; },
    setDoneIds(ids) { state.doneIds = ids; },
    startMission(mission) {
      if (state.current) return false;
      state.current = mission;
      state.stageIndex = 0;
      state.failed = false;
      G.hud.chapterCard(mission);
      G.hud.showDialogue(mission.intro);
      setupStage();
      return true;
    },
    /** Jump to a later stage with full setup (beacon, GPS, spawns, timer). */
    jumpToStage(index) {
      if (!state.current) return;
      state.stageIndex = Math.min(index, state.current.stages.length - 1);
      setupStage();
    },
    startNextMission() {
      const next = nextMission(state.doneIds);
      if (!next) {
        G.hud.flash('STORY COMPLETE — CALDERA BAY IS YOURS', '#7cff00');
        return false;
      }
      return this.startMission(next);
    },
    onEnemyKilled() {
      if (!state.current) return;
      const stage = state.current.stages[state.stageIndex];
      if (stage.kind !== 'kill') return;
      state.stageKills += 1;
      G.hud.setMission(state.current, state.stageIndex, state.stageKills);
      if (state.stageKills >= stage.count) advanceStage();
    },
    /** Call when the player presses E near a mission point / person. */
    interact() {
      if (!state.current) return false;
      const stage = state.current.stages[state.stageIndex];
      if (stage.kind !== 'talk') return false;
      const t = stageTarget(stage);
      if (Math.hypot(G.player.state.pos.x - t.x, G.player.state.pos.z - t.z) < 6) {
        advanceStage();
        return true;
      }
      return false;
    },
    update(dt) {
      if (!state.current) return;
      const stage = state.current.stages[state.stageIndex];
      if (stage.timer) {
        state.stageTimer -= dt;
        G.hud.setTimer(state.stageTimer);
        if (state.stageTimer <= 0) {
          failMission('OUT OF TIME');
          return;
        }
      }
      const p = G.player.state.pos;
      const target = stageTarget(stage);
      if ((stage.kind === 'goto' || stage.kind === 'drive') && target) {
        if (Math.hypot(p.x - target.x, p.z - target.z) < 7) advanceStage();
      } else if (stage.kind === 'collect') {
        for (const c of state.collectibles) {
          if (!c.taken && Math.hypot(p.x - c.pos.x, p.z - c.pos.z) < 2.5) {
            c.taken = true;
            G.scene.remove(c.mesh);
            state.stageCollected += 1;
            G.audio.stinger('cash');
            G.hud.setMission(state.current, state.stageIndex, state.stageCollected);
            if (state.stageCollected >= stage.count) advanceStage();
          }
        }
      } else if (stage.kind === 'escape') {
        if (G.wanted.state.stars === 0) advanceStage();
      }
      // Death fails the mission.
      if (G.player.state.dead) failMission('YOU DIED');
    },
  };
}
