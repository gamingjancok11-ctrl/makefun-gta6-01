// The player on foot: a low-poly character with a walk cycle, sprint, jump,
// and the enter/exit-car handoff. Movement is camera-relative (W = away from
// the camera) so the third-person controls feel right immediately.
import * as THREE from 'three';
import { resolveCircleColliders } from '../city/cityGenerator.js';

const WALK_SPEED = 6;
const SPRINT_SPEED = 10.5;

export function buildHumanoid({ shirt = 0x2e86c1, pants = 0x2c3e50, skin = 0xc68642, hair = 0x1a1a1a } = {}) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.34), mat(shirt));
  torso.position.y = 1.15;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), mat(skin));
  head.position.y = 1.82;
  const hairM = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.46), mat(hair));
  hairM.position.y = 2.06;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.75, 0.28), mat(pants));
  legL.position.set(-0.18, 0.38, 0);
  const legR = legL.clone();
  legR.position.x = 0.18;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.24), mat(shirt));
  armL.position.set(-0.44, 1.2, 0);
  const armR = armL.clone();
  armR.position.x = 0.44;
  g.add(torso, head, hairM, legL, legR, armL, armR);
  g.userData = { legL, legR, armL, armR, torso, head };
  return g;
}

export function createPlayer(scene, startPos) {
  const mesh = buildHumanoid({ shirt: 0xe74c3c, pants: 0x2c3e50, skin: 0xc68642, hair: 0x141414 });
  mesh.position.copy(startPos);
  scene.add(mesh);
  const state = {
    mesh,
    pos: mesh.position, // alias: mesh.position IS the position
    heading: Math.PI,
    speed: 0,
    health: 100,
    maxHealth: 100,
    onFoot: true,
    vehicle: null,
    walkPhase: 0,
    vy: 0,
    grounded: true,
    cash: 250,
    respect: 0,
    dead: false,
    deadTimer: 0,
  };

  function animateWalk(dt, moving) {
    const u = mesh.userData;
    if (moving) {
      state.walkPhase += dt * state.speed * 1.6;
      const s = Math.sin(state.walkPhase);
      u.legL.rotation.x = s * 0.7;
      u.legR.rotation.x = -s * 0.7;
      u.armL.rotation.x = -s * 0.5;
      u.armR.rotation.x = s * 0.5;
    } else {
      u.legL.rotation.x *= 0.8;
      u.legR.rotation.x *= 0.8;
      u.armL.rotation.x *= 0.8;
      u.armR.rotation.x *= 0.8;
    }
  }

  return {
    state,
    mesh,
    /** Move on foot. `move` is {x, z} in world space, already normalised. */
    moveOnFoot(G, dt, move, sprint) {
      const targetSpeed = move ? (sprint ? SPRINT_SPEED : WALK_SPEED) : 0;
      state.speed += (targetSpeed - state.speed) * Math.min(1, dt * 8);
      if (move && state.speed > 0.1) {
        const wantHeading = Math.atan2(move.x, move.z);
        let diff = wantHeading - state.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        state.heading += diff * Math.min(1, dt * 10);
        state.pos.x += Math.sin(state.heading) * state.speed * dt;
        state.pos.z += Math.cos(state.heading) * state.speed * dt;
      }
      // Jump + gravity.
      if (G.input.wasPressed('Space') && state.grounded) {
        state.vy = 6.5;
        state.grounded = false;
      }
      if (!state.grounded) {
        state.vy -= 18 * dt;
        state.pos.y += state.vy * dt;
        if (state.pos.y <= 0) {
          state.pos.y = 0;
          state.vy = 0;
          state.grounded = true;
        }
      }
      resolveCircleColliders(G.city, state.pos, 0.7);
      mesh.rotation.y = state.heading;
      animateWalk(dt, state.speed > 0.5);
    },
    damage(amount) {
      if (state.dead) return;
      state.health = Math.max(0, state.health - amount);
      if (state.health <= 0) {
        state.dead = true;
        state.deadTimer = 0;
      }
    },
    heal(amount) {
      state.health = Math.min(state.maxHealth, state.health + amount);
    },
    respawn(pos) {
      state.health = state.maxHealth;
      state.dead = false;
      state.pos.set(pos.x, 0, pos.z);
      state.heading = Math.PI;
    },
  };
}
