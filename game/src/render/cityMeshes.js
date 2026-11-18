// Turns the generated city layout into three.js meshes: ground, roads, buildings
// with lit windows, palms, street lights, water, the volcano and the sky.
// Instanced where counts are high so the frame budget stays small.
import * as THREE from 'three';
import { WORLD, PALETTE } from '../config.js';

function box(w, h, d, color, opts = {}) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color, emissive: opts.emissive || 0x000000, emissiveIntensity: opts.ei || 1 }),
  );
  return m;
}

export function buildCityMeshes(scene, city) {
  const group = new THREE.Group();
  group.name = 'city';
  const S = WORLD.size;

  // Ground: black sand at the edges, warm pavement inside.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(S + 400, S + 400),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  group.add(ground);
  const plaza = new THREE.Mesh(
    new THREE.PlaneGeometry(S, S),
    new THREE.MeshLambertMaterial({ color: PALETTE.ground }),
  );
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0;
  group.add(plaza);

  // Water ring around the island.
  const water = new THREE.Mesh(
    new THREE.RingGeometry(S / 2 + 6, S / 2 + 220, 48),
    new THREE.MeshLambertMaterial({ color: PALETTE.water, transparent: true, opacity: 0.9 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = WORLD.waterLevel;
  group.add(water);

  // Roads: dark strips along every grid line + centre dashes.
  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.road });
  const dashMat = new THREE.MeshBasicMaterial({ color: PALETTE.roadLine });
  const dashGeo = new THREE.PlaneGeometry(2.2, 0.5);
  const dashes = [];
  for (const line of city.roads) {
    const h = new THREE.Mesh(new THREE.PlaneGeometry(S, WORLD.roadWidth), roadMat);
    h.rotation.x = -Math.PI / 2;
    h.position.set(0, 0.02, line);
    group.add(h);
    const v = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.roadWidth, S), roadMat);
    v.rotation.x = -Math.PI / 2;
    v.position.set(line, 0.02, 0);
    group.add(v);
    for (let t = -230; t <= 230; t += 12) {
      dashes.push([t, line, 0], [line, t, Math.PI / 2]);
    }
  }
  const dashMesh = new THREE.InstancedMesh(dashGeo, dashMat, dashes.length);
  {
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const sc = new THREE.Vector3(1, 1, 1);
    dashes.forEach(([x, z, rot], i) => {
      e.set(-Math.PI / 2, 0, rot);
      q.setFromEuler(e);
      m4.compose(new THREE.Vector3(x, 0.04, z), q, sc);
      dashMesh.setMatrixAt(i, m4);
    });
  }
  group.add(dashMesh);

  // Buildings: one mesh per building (a few hundred) + window glow strips.
  // The strips used to be one mesh each (~800 draw calls on their own);
  // they now share a single InstancedMesh — a unit plane scaled per strip.
  const windowMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const windowStrips = [];
  for (const b of city.buildings) {
    const m = box(b.w, b.h, b.d, b.color);
    m.position.set(b.x, b.h / 2, b.z);
    group.add(m);
    // Roof lip.
    const lip = box(b.w + 0.6, 0.5, b.d + 0.6, 0x6b5d4a);
    lip.position.set(b.x, b.h + 0.25, b.z);
    group.add(lip);
    // Window strips on the two street-facing sides.
    const floors = Math.max(1, Math.floor(b.h / 4));
    for (let f = 0; f < floors; f += 1) {
      const y = 2.5 + f * 4;
      if (y > b.h - 1) break;
      windowStrips.push([b.x, y, b.z + b.d / 2 + 0.06, b.w * 0.8]);
    }
    if (b.neon) {
      const strip = box(b.w * 0.9, 0.7, 0.3, 0x111111, { emissive: b.neon, ei: 1.6 });
      strip.position.set(b.x, b.h - 1.2, b.z + b.d / 2 + 0.15);
      group.add(strip);
    }
  }
  const windowMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1.1), windowMat, windowStrips.length);
  {
    const m4 = new THREE.Matrix4();
    windowStrips.forEach(([x, y, z, w], i) => {
      m4.makeScale(w, 1, 1);
      m4.setPosition(x, y, z);
      windowMesh.setMatrixAt(i, m4);
    });
  }
  group.add(windowMesh);

  // Palms: trunk + frond star, instanced trunks, merged fronds per palm.
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.35, 5, 5);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, city.palms.length);
  const frondGeo = new THREE.ConeGeometry(2.6, 2.2, 6);
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x2e7d32 });
  const fronds = new THREE.InstancedMesh(frondGeo, frondMat, city.palms.length);
  {
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    city.palms.forEach((p, i) => {
      q.setFromEuler(e.set(0, 0, 0));
      m4.compose(new THREE.Vector3(p.x, 2.5 * p.s, p.z), q, new THREE.Vector3(p.s, p.s, p.s));
      trunks.setMatrixAt(i, m4);
      q.setFromEuler(e.set(Math.PI, 0, 0));
      m4.compose(new THREE.Vector3(p.x, 5.4 * p.s, p.z), q, new THREE.Vector3(p.s, p.s, p.s));
      fronds.setMatrixAt(i, m4);
    });
  }
  group.add(trunks, fronds);

  // Street lights: pole + glowing head.
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 6, 5);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, city.lights.length);
  const headGeo = new THREE.SphereGeometry(0.45, 6, 5);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const heads = new THREE.InstancedMesh(headGeo, headMat, city.lights.length);
  {
    const m4 = new THREE.Matrix4();
    city.lights.forEach((l, i) => {
      m4.makeTranslation(l.x, 3, l.z);
      poles.setMatrixAt(i, m4);
      m4.makeTranslation(l.x, 6.1, l.z);
      heads.setMatrixAt(i, m4);
    });
  }
  group.add(poles, heads);

  // Crates at the docks.
  for (const c of city.crates) {
    const m = box(c.s, c.s, c.s, c.color);
    m.position.set(c.x, c.s / 2, c.z);
    m.rotation.y = 0.4;
    group.add(m);
  }

  // Landmarks: volcano cone, the Ember Spire, marina pier, causeway bridge.
  const volcano = new THREE.Mesh(
    new THREE.ConeGeometry(42, 34, 24),
    new THREE.MeshLambertMaterial({ color: 0x4a3a32 }),
  );
  volcano.position.set(-150, 17, -150);
  group.add(volcano);
  const craterGlow = new THREE.Mesh(
    new THREE.CircleGeometry(9, 20),
    new THREE.MeshBasicMaterial({ color: 0xff5a00 }),
  );
  craterGlow.rotation.x = -Math.PI / 2;
  craterGlow.position.set(-150, 34.1, -150);
  group.add(craterGlow);
  const spire = box(10, 74, 10, 0x2b2f36, { emissive: 0xff2e88, ei: 0.35 });
  spire.position.set(0, 37, -160);
  group.add(spire);
  const pier = box(30, 1, 6, 0x7a6248);
  pier.position.set(215, 0.4, 20);
  group.add(pier);
  const bridge = box(10, 1.5, 40, 0x8a8a8a);
  bridge.position.set(0, 1.2, 225);
  group.add(bridge);

  // Sky dome + golden-hour sun + hemisphere light.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 16, 12),
    new THREE.MeshBasicMaterial({ color: PALETTE.sky, side: THREE.BackSide, fog: false }),
  );
  group.add(sky);
  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.2);
  sun.position.set(-180, 140, 120);
  group.add(sun);
  group.add(new THREE.HemisphereLight(0xbfd9ff, 0x8a6a4a, 1.1));
  scene.fog = new THREE.Fog(PALETTE.fog, 220, 700);
  scene.add(group);
  return { group, sun };
}

/** Move the sun + sky tint with the in-game clock (golden hour → dusk → night). */
export function updateDaylight(sunRig, dayTime) {
  const t = dayTime % 24;
  const angle = ((t - 6) / 12) * Math.PI; // 06:00 sunrise → 18:00 sunset
  const x = Math.cos(angle) * -220;
  const y = Math.max(18, Math.sin(angle) * 200);
  sunRig.sun.position.set(x, y, 120);
  const dusk = Math.max(0, 1 - Math.abs(t - 18.5) / 2.5);
  sunRig.sun.color.setHex(dusk > 0.4 ? 0xff9a4d : 0xffd27a);
  sunRig.sun.intensity = t > 19.5 || t < 5.5 ? 0.5 : 2.2;
}
