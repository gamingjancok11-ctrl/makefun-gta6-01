// Cheap transient effects: tracers, muzzle flashes, tyre smoke, skid marks,
// sparks, explosion puffs, floating mission beacons. All pooled, no allocation
// in the hot loop beyond a few small arrays.
import * as THREE from 'three';

export function createEffects(scene) {
  const tracers = []; // { line, life }
  const puffs = []; // { mesh, life, maxLife, vel }
  const skids = []; // { mesh, life }
  const beacons = []; // { mesh, ring }
  const puffGeo = new THREE.SphereGeometry(0.5, 6, 5);
  const puffMat = new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.7 });
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.9 });

  function spawnPuff(pos, color, scale, life, vel) {
    const m = new THREE.Mesh(puffGeo, puffMat.clone());
    m.material.color.setHex(color);
    m.position.copy(pos);
    m.scale.setScalar(scale);
    scene.add(m);
    puffs.push({ mesh: m, life, maxLife: life, vel: vel || new THREE.Vector3(0, 1, 0) });
  }

  return {
    tracer(from, to) {
      const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
      const line = new THREE.Line(geo, tracerMat.clone());
      scene.add(line);
      tracers.push({ line, life: 0.09 });
    },
    muzzleFlash(pos) {
      spawnPuff(pos, 0xffcc33, 0.7, 0.08, new THREE.Vector3());
    },
    tyreSmoke(pos) {
      spawnPuff(pos, 0xbbbbbb, 0.9, 0.7, new THREE.Vector3(0, 0.8, 0));
    },
    impactSpark(pos) {
      spawnPuff(pos, 0xffdd55, 0.5, 0.25, new THREE.Vector3(0, 2, 0));
    },
    explosion(pos) {
      for (let i = 0; i < 8; i += 1) {
        spawnPuff(
          pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, Math.random(), (Math.random() - 0.5) * 2)),
          i % 2 ? 0xff7b00 : 0x444444,
          1.6 + Math.random(),
          0.9,
          new THREE.Vector3((Math.random() - 0.5) * 3, 2 + Math.random() * 2, (Math.random() - 0.5) * 3),
        );
      }
    },
    skidMark(pos, heading) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 2.2),
        new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.55 }),
      );
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = heading;
      m.position.set(pos.x, 0.05, pos.z);
      scene.add(m);
      skids.push({ mesh: m, life: 6 });
    },
    /** Tall glowing mission beacon + ground ring at (x, z). Returns a remover. */
    beacon(x, z, color) {
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(1.1, 1.1, 60, 10, 1, true),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
      );
      beam.position.set(x, 30, z);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(2.4, 3.1, 24),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.08, z);
      scene.add(beam, ring);
      const entry = { beam, ring };
      beacons.push(entry);
      return () => {
        scene.remove(beam, ring);
        const i = beacons.indexOf(entry);
        if (i >= 0) beacons.splice(i, 1);
      };
    },
    update(dt) {
      for (let i = tracers.length - 1; i >= 0; i -= 1) {
        tracers[i].life -= dt;
        if (tracers[i].life <= 0) {
          scene.remove(tracers[i].line);
          tracers[i].line.geometry.dispose();
          tracers.splice(i, 1);
        }
      }
      for (let i = puffs.length - 1; i >= 0; i -= 1) {
        const p = puffs[i];
        p.life -= dt;
        p.mesh.position.addScaledVector(p.vel, dt);
        p.mesh.material.opacity = 0.7 * Math.max(0, p.life / p.maxLife);
        p.mesh.scale.multiplyScalar(1 + dt * 1.5);
        if (p.life <= 0) {
          scene.remove(p.mesh);
          puffs.splice(i, 1);
        }
      }
      for (let i = skids.length - 1; i >= 0; i -= 1) {
        skids[i].life -= dt;
        if (skids[i].life <= 0) {
          scene.remove(skids[i].mesh);
          skids.splice(i, 1);
        }
      }
      for (const b of beacons) b.ring.rotation.z += dt * 0.8;
    },
  };
}
