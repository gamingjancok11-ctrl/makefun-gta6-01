// Third-person chase camera: mouse orbit (yaw/pitch), smoothed follow, different
// framing on foot vs in a car, and scripted positions for screenshot scenes.
import * as THREE from 'three';

export function createChaseCamera(camera) {
  const state = {
    yaw: Math.PI * 0.75,
    pitch: 0.32,
    distance: 9,
    target: new THREE.Vector3(),
    shake: 0,
    scripted: null, // { pos: Vector3, look: Vector3 } — screenshot scenes own the camera
  };

  function applyLook(dx, dy) {
    state.yaw -= dx * 0.0026;
    state.pitch = Math.max(-0.15, Math.min(1.05, state.pitch + dy * 0.0022));
  }

  function update(dt, focus, inCar, speedKmh) {
    if (state.scripted) {
      // Near-instant follow: a scripted shot tracks a car at 160 km/h, and
      // exponential smoothing lags behind a moving target by v/rate — at
      // rate 12 the camera sat ~4 m further back than scripted, shrinking
      // the hero car. At rate 30 the lag is ~1.5 m and the framing holds.
      camera.position.lerp(state.scripted.pos, 1 - Math.exp(-30 * dt));
      camera.lookAt(state.scripted.look);
      return;
    }
    const wantDist = inCar ? 11.5 + Math.min(3, speedKmh / 60) : 8.5;
    state.distance += (wantDist - state.distance) * Math.min(1, dt * 3);
    const off = new THREE.Vector3(
      Math.sin(state.yaw) * Math.cos(state.pitch),
      Math.sin(state.pitch),
      Math.cos(state.yaw) * Math.cos(state.pitch),
    ).multiplyScalar(state.distance);
    const desired = focus.clone().add(off);
    desired.y = Math.max(1.6, desired.y);
    camera.position.lerp(desired, 1 - Math.exp(-9 * dt));
    state.target.lerp(focus, 1 - Math.exp(-12 * dt));
    if (state.shake > 0.001) {
      camera.position.x += (Math.random() - 0.5) * state.shake;
      camera.position.y += (Math.random() - 0.5) * state.shake;
      state.shake *= Math.exp(-6 * dt);
    }
    camera.lookAt(state.target);
  }

  return {
    state,
    applyLook,
    update,
    addShake(amount) { state.shake = Math.min(0.6, state.shake + amount); },
    /** Screenshot scenes pin the camera; pass null to release it. */
    script(pos, look) {
      state.scripted = pos ? { pos: new THREE.Vector3(...pos), look: new THREE.Vector3(...look) } : null;
    },
    get yaw() { return state.yaw; },
    setYaw(y) { state.yaw = y; },
  };
}
