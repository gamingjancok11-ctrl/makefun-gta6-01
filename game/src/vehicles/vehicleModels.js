// Low-poly vehicle meshes built from primitives: civilian cars (sedan, taxi,
// pickup, sports), police cruisers with a flashing light bar, and the police
// helicopter with a searchlight cone. One builder per body type.
import * as THREE from 'three';

function box(w, h, d, color, opts = {}) {
  return new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color, emissive: opts.emissive || 0x000000, emissiveIntensity: opts.ei || 1 }),
  );
}

function makeWheels(scale = 1) {
  const geo = new THREE.CylinderGeometry(0.42 * scale, 0.42 * scale, 0.3, 10);
  geo.rotateZ(Math.PI / 2);
  const mat = new THREE.MeshLambertMaterial({ color: 0x151515 });
  const wheels = [];
  for (const [x, z] of [[-0.85, 1.25], [0.85, 1.25], [-0.85, -1.25], [0.85, -1.25]]) {
    const w = new THREE.Mesh(geo, mat);
    w.position.set(x * scale, 0.42 * scale, z * scale);
    wheels.push(w);
  }
  return wheels;
}

/** A civilian car. `kind`: sedan | taxi | pickup | sports. */
export function buildCar({ color = 0xc0392b, kind = 'sedan' } = {}) {
  const g = new THREE.Group();
  const isPickup = kind === 'pickup';
  const isSports = kind === 'sports';
  const body = box(1.9, 0.62, isPickup ? 4.6 : 4.2, color);
  body.position.y = 0.62;
  const cabin = box(1.7, 0.55, isPickup ? 1.6 : 2.1, 0x1a2530);
  cabin.position.set(0, 1.18, isPickup ? 0.7 : -0.15);
  const stripe = box(1.92, 0.1, 4.22, 0x222222);
  stripe.position.y = 0.9;
  g.add(body, cabin, stripe);
  if (kind === 'taxi') {
    const sign = box(0.7, 0.25, 0.4, 0xf1c40f, { emissive: 0xf1c40f, ei: 0.8 });
    sign.position.set(0, 1.6, -0.15);
    g.add(sign);
  }
  if (isSports) {
    const spoiler = box(1.8, 0.08, 0.4, 0x111111);
    spoiler.position.set(0, 1.05, -2.0);
    g.add(spoiler);
  }
  // Headlights + taillights.
  for (const x of [-0.65, 0.65]) {
    const hl = box(0.32, 0.18, 0.08, 0xfff6c9, { emissive: 0xfff6c9, ei: 1.4 });
    hl.position.set(x, 0.68, 2.12);
    const tl = box(0.32, 0.16, 0.08, 0xff2222, { emissive: 0xff2222, ei: 1.2 });
    tl.position.set(x, 0.68, -2.12);
    g.add(hl, tl);
  }
  const wheels = makeWheels(isSports ? 0.95 : 1);
  wheels.forEach((w) => g.add(w));
  g.userData = { wheels, kind, color };
  return g;
}

/** A CBPD police cruiser: white body, black doors, flashing light bar. */
export function buildPoliceCar() {
  const g = buildCar({ color: 0xf2f2f2, kind: 'sedan' });
  const doorL = box(0.06, 0.5, 2.0, 0x141414);
  doorL.position.set(-0.96, 0.66, 0);
  const doorR = doorL.clone();
  doorR.position.x = 0.96;
  const barBase = box(1.5, 0.14, 0.4, 0x222222);
  barBase.position.set(0, 1.52, -0.15);
  const red = box(0.65, 0.2, 0.36, 0xff0000, { emissive: 0xff0000, ei: 2 });
  red.position.set(-0.38, 1.64, -0.15);
  const blue = box(0.65, 0.2, 0.36, 0x0044ff, { emissive: 0x0044ff, ei: 2 });
  blue.position.set(0.38, 1.64, -0.15);
  g.add(doorL, doorR, barBase, red, blue);
  g.userData.police = true;
  g.userData.lightRed = red;
  g.userData.lightBlue = blue;
  return g;
}

/** The CBPD helicopter: body, tail, spinning rotor, searchlight cone. */
export function buildHelicopter() {
  const g = new THREE.Group();
  const body = box(2.2, 1.6, 4.6, 0x1a3a5c);
  body.position.y = 0;
  const glass = box(1.9, 0.9, 1.4, 0x9fd8ef);
  glass.position.set(0, 0.3, 1.8);
  const tail = box(0.5, 0.5, 4.5, 0x1a3a5c);
  tail.position.set(0, 0.3, -4.2);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.9, 6), new THREE.MeshLambertMaterial({ color: 0x333333 }));
  mast.position.y = 1.1;
  const rotor = new THREE.Group();
  const bladeGeo = new THREE.BoxGeometry(9.5, 0.06, 0.35);
  const bladeMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const b1 = new THREE.Mesh(bladeGeo, bladeMat);
  const b2 = new THREE.Mesh(bladeGeo, bladeMat);
  b2.rotation.y = Math.PI / 2;
  rotor.add(b1, b2);
  rotor.position.y = 1.6;
  const light = new THREE.Mesh(
    new THREE.ConeGeometry(4.5, 26, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  );
  light.position.set(0, -13, 0);
  light.rotation.x = Math.PI;
  const skids = box(2.4, 0.12, 3.4, 0x222222);
  skids.position.y = -1.1;
  g.add(body, glass, tail, mast, rotor, light, skids);
  g.userData = { rotor, light, police: true };
  return g;
}
