// On-foot combat: hitscan weapons with tracers, muzzle flash, reload, enemy
// gang members who shoot back, and the weapon bar state. Shooting is a crime;
// killing a cop is a bigger one.
import * as THREE from 'three';
import { WEAPONS, WEAPON_ORDER } from '../config.js';
import { buildHumanoid } from '../player/playerController.js';

export function createCombat(G) {
  const state = {
    owned: ['fists', 'pistol'],
    current: 'pistol',
    ammo: { pistol: 48, smg: 0, shotgun: 0, rifle: 0 },
    mag: { pistol: 12, smg: 0, shotgun: 0, rifle: 0 },
    cooldown: 0,
    reloading: 0,
    kills: 0,
  };
  const enemies = []; // { mesh, pos, health, maxHealth, shootCooldown, alive, name }

  const raycaster = new THREE.Raycaster();

  function muzzleWorldPos() {
    const p = G.player.state.pos;
    return new THREE.Vector3(p.x + Math.sin(G.player.state.heading) * 0.8, 1.5, p.z + Math.cos(G.player.state.heading) * 0.8);
  }

  function aimTarget() {
    // Shoot from the camera's view direction toward the crosshair point.
    const dir = new THREE.Vector3();
    G.camera.getWorldDirection(dir);
    const origin = G.camera.position.clone();
    raycaster.set(origin, dir);
    raycaster.far = 120;
    const hits = raycaster.intersectObjects(G.scene.children, true);
    if (hits.length > 0) return hits[0].point;
    return origin.addScaledVector(dir, 80);
  }

  function fire() {
    const id = state.current;
    const def = WEAPONS[id];
    if (state.cooldown > 0 || state.reloading > 0) return;
    if (id === 'fists') {
      state.cooldown = 1 / def.fireRate;
      // Melee: hurt the nearest enemy within range.
      for (const e of enemies) {
        if (!e.alive) continue;
        if (e.pos.distanceTo(G.player.state.pos) < def.range) damageEnemy(e, def.damage);
      }
      G.audio.stinger('punch');
      return;
    }
    if (state.mag[id] <= 0) {
      reload();
      return;
    }
    state.cooldown = 1 / def.fireRate;
    state.mag[id] -= 1;
    const from = muzzleWorldPos();
    const pellets = def.pellets || 1;
    for (let i = 0; i < pellets; i += 1) {
      const target = aimTarget();
      target.x += (Math.random() - 0.5) * def.spread * 60;
      target.y += (Math.random() - 0.5) * def.spread * 40;
      G.effects.tracer(from.clone(), target);
      // Hit test against enemies near the shot line.
      for (const e of enemies) {
        if (!e.alive) continue;
        const toE = e.pos.clone().setY(1.2).sub(from);
        const toT = target.clone().sub(from);
        const proj = toE.dot(toT.normalize());
        if (proj < 0 || proj > def.range) continue;
        const closest = from.clone().addScaledVector(toT, proj);
        if (closest.distanceTo(e.pos.clone().setY(1.2)) < 1.4) {
          damageEnemy(e, def.damage);
          G.effects.impactSpark(e.pos.clone().setY(1.4));
        }
      }
    }
    G.effects.muzzleFlash(from);
    G.audio.stinger('shot');
    G.cameraRig.addShake(0.06);
    G.peds.scare(G.player.state.pos.x, G.player.state.pos.z, 45);
    G.wanted.commitCrime('shoot', G.player.state.pos);
  }

  function damageEnemy(e, amount) {
    e.health -= amount;
    if (e.health <= 0 && e.alive) {
      e.alive = false;
      e.mesh.rotation.x = Math.PI / 2;
      e.mesh.position.y = 0.3;
      state.kills += 1;
      G.missions.onEnemyKilled(e);
      G.hud.flash(`${e.name} DOWN`, '#ffcc00');
    }
  }

  function reload() {
    const id = state.current;
    if (id === 'fists' || state.reloading > 0) return;
    const def = WEAPONS[id];
    const need = def.mag - state.mag[id];
    const have = state.ammo[id];
    if (need <= 0 || have <= 0) return;
    state.reloading = 1.1;
    const take = Math.min(need, have);
    state.mag[id] += take;
    state.ammo[id] -= take;
    G.audio.stinger('reload');
  }

  function spawnEnemy(x, z, name, health = 60) {
    const mesh = buildHumanoid({ shirt: 0x8e44ad, pants: 0x1a1a1a, skin: 0x8d5524, hair: 0x000000 });
    mesh.position.set(x, 0, z);
    G.scene.add(mesh);
    const e = { mesh, pos: mesh.position, health, maxHealth: health, shootCooldown: 1 + Math.random(), alive: true, name: name || 'Rival' };
    enemies.push(e);
    return e;
  }

  function clearEnemies() {
    for (const e of enemies) G.scene.remove(e.mesh);
    enemies.length = 0;
  }

  return {
    state,
    enemies,
    fire,
    reload,
    spawnEnemy,
    clearEnemies,
    damageEnemy,
    buyWeapon(id) {
      const def = WEAPONS[id];
      if (!def || state.owned.includes(id)) return false;
      if (G.player.state.cash < def.price) return false;
      G.player.state.cash -= def.price;
      state.owned.push(id);
      state.ammo[id] = (state.ammo[id] || 0) + def.mag * 2;
      state.mag[id] = def.mag;
      return true;
    },
    buyAmmo(id) {
      const def = WEAPONS[id];
      if (!def || id === 'fists') return false;
      if (G.player.state.cash < 60) return false;
      G.player.state.cash -= 60;
      state.ammo[id] = (state.ammo[id] || 0) + def.mag * 2;
      return true;
    },
    switchWeapon(id) {
      if (state.owned.includes(id)) {
        state.current = id;
        state.reloading = 0;
      }
    },
    cycleWeapon(dir) {
      const owned = WEAPON_ORDER.filter((w) => state.owned.includes(w));
      const i = owned.indexOf(state.current);
      state.current = owned[(i + dir + owned.length) % owned.length];
    },
    update(dt) {
      state.cooldown = Math.max(0, state.cooldown - dt);
      state.reloading = Math.max(0, state.reloading - dt);
      const def = WEAPONS[state.current];
      if (G.player.state.onFoot && !G.paused) {
        if (def.auto ? G.input.mouseDown : G.input.mouseClicked) fire();
        if (G.input.wasPressed('KeyR')) reload();
        for (let i = 0; i < WEAPON_ORDER.length; i += 1) {
          if (G.input.wasPressed(`Digit${i + 1}`)) this.switchWeapon(WEAPON_ORDER[i]);
        }
      }
      // Enemy AI: face the player, shoot when in range and line of sight.
      for (const e of enemies) {
        if (!e.alive) continue;
        const p = G.player.state.pos;
        const dist = e.pos.distanceTo(p);
        e.mesh.lookAt(p.x, 0, p.z);
        e.shootCooldown -= dt;
        if (dist < 45 && e.shootCooldown <= 0 && G.player.state.onFoot) {
          e.shootCooldown = 1.1 + Math.random() * 0.8;
          const from = e.pos.clone().setY(1.5);
          const to = p.clone().setY(1.2);
          to.x += (Math.random() - 0.5) * 4;
          to.z += (Math.random() - 0.5) * 4;
          G.effects.tracer(from, to);
          G.audio.stinger('shot');
          if (Math.random() < 0.4) G.player.damage(8 + Math.random() * 8);
        } else if (dist > 25 && dist < 60) {
          // Advance toward the player.
          const dir = new THREE.Vector3(p.x - e.pos.x, 0, p.z - e.pos.z).normalize();
          e.pos.addScaledVector(dir, 3.2 * dt);
        }
      }
    },
  };
}
