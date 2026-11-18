// GPS routing along the road grid: Manhattan path from the player to the
// target (nearest road, along it, turn, along the next), drawn as a ground
// line in 3D and as a polyline on the minimap.
import * as THREE from 'three';
import { nearestRoad } from '../city/cityGenerator.js';

export function createGps(G) {
  let route = null; // [{x, z}, ...]
  let line = null;
  let target = null;

  function computeRoute(from, to) {
    const rx = nearestRoad(from.x);
    const rz = nearestRoad(to.z);
    const pts = [{ x: from.x, z: from.z }];
    pts.push({ x: rx, z: from.z });
    pts.push({ x: rx, z: rz });
    pts.push({ x: to.x, z: rz });
    pts.push({ x: to.x, z: to.z });
    return pts;
  }

  return {
    get route() { return route; },
    get target() { return target; },
    setRoute(to) {
      target = to;
      route = computeRoute(G.player.state.pos, to);
      if (line) { G.scene.remove(line); line.geometry.dispose(); }
      const pts = route.map((p) => new THREE.Vector3(p.x, 0.15, p.z));
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x00e5ff, linewidth: 3 }));
      G.scene.add(line);
    },
    clearRoute() {
      route = null;
      target = null;
      if (line) { G.scene.remove(line); line.geometry.dispose(); line = null; }
    },
    /** Re-route from the player's current position (call when the target moves). */
    refresh() {
      if (target) this.setRoute(target);
    },
  };
}
