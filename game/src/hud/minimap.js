// Circular minimap: a pre-rendered static layer (roads, blocks, water, district
// tints) plus live blips — player arrow, police, mission target, GPS route,
// enemies, races, shops, tapes. North-up, player-centred, zoomed to the
// neighbourhood so the frame stays readable.
import { WORLD } from '../config.js';

const SIZE = 190;
const VIEW = 220; // world units across the minimap

export function createMinimap(G, canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = SIZE;
  canvas.height = SIZE;
  // Static layer, rendered once at full-city scale.
  const staticLayer = document.createElement('canvas');
  staticLayer.width = SIZE;
  staticLayer.height = SIZE;
  {
    const c = staticLayer.getContext('2d');
    const s = SIZE / WORLD.size;
    c.fillStyle = '#241f1c';
    c.fillRect(0, 0, SIZE, SIZE);
    c.fillStyle = '#1d6f8a';
    c.beginPath();
    c.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#6b5d4a';
    c.fillRect(0, 0, SIZE, SIZE);
    // Blocks.
    c.fillStyle = '#4a4238';
    const lines = WORLD.roadLines;
    for (let ix = 0; ix < lines.length - 1; ix += 1) {
      for (let iz = 0; iz < lines.length - 1; iz += 1) {
        const x0 = (lines[ix] + WORLD.size / 2) * s;
        const z0 = (lines[iz] + WORLD.size / 2) * s;
        c.fillRect(x0 + 2, z0 + 2, (lines[ix + 1] - lines[ix]) * s - 4, (lines[iz + 1] - lines[iz]) * s - 4);
      }
    }
    // Roads.
    c.strokeStyle = '#2e2a28';
    c.lineWidth = WORLD.roadWidth * s;
    for (const line of lines) {
      const p = (line + WORLD.size / 2) * s;
      c.beginPath(); c.moveTo(0, p); c.lineTo(SIZE, p); c.stroke();
      c.beginPath(); c.moveTo(p, 0); c.lineTo(p, SIZE); c.stroke();
    }
  }

  function toMap(x, z, px, pz) {
    const s = SIZE / VIEW;
    return { x: SIZE / 2 + (x - px) * s, y: SIZE / 2 + (z - pz) * s };
  }

  function blip(x, y, color, size, shape = 'circle') {
    ctx.fillStyle = color;
    if (shape === 'circle') {
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    } else if (shape === 'diamond') {
      ctx.beginPath();
      ctx.moveTo(x, y - size);
      ctx.lineTo(x + size, y);
      ctx.lineTo(x, y + size);
      ctx.lineTo(x - size, y);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(x - size, y - size, size * 2, size * 2);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  return {
    update() {
      const p = G.player.state.pos;
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.save();
      ctx.beginPath();
      ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 2, 0, Math.PI * 2);
      ctx.clip();
      // Static layer, zoomed + centred on the player.
      const full = SIZE / WORLD.size;
      const zoom = VIEW / WORLD.size;
      const sx = (p.x + WORLD.size / 2) * full - (SIZE * zoom) / 2;
      const sy = (p.z + WORLD.size / 2) * full - (SIZE * zoom) / 2;
      ctx.drawImage(staticLayer, sx, sy, SIZE * zoom, SIZE * zoom, 0, 0, SIZE, SIZE);
      // GPS route.
      if (G.gps.route) {
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        G.gps.route.forEach((pt, i) => {
          const m = toMap(pt.x, pt.z, p.x, p.z);
          if (i === 0) ctx.moveTo(m.x, m.y);
          else ctx.lineTo(m.x, m.y);
        });
        ctx.stroke();
      }
      // Mission target.
      if (G.gps.target) {
        const m = toMap(G.gps.target.x, G.gps.target.z, p.x, p.z);
        blip(m.x, m.y, '#ffd700', 6, 'diamond');
      }
      // Enemies.
      for (const e of G.combat.enemies) {
        if (!e.alive) continue;
        const m = toMap(e.pos.x, e.pos.z, p.x, p.z);
        blip(m.x, m.y, '#ff2222', 3.5);
      }
      // Police.
      for (const u of G.police.units) {
        const m = toMap(u.vehicle.pos.x, u.vehicle.pos.z, p.x, p.z);
        blip(m.x, m.y, '#4488ff', 4);
      }
      if (G.police.heli) {
        const m = toMap(G.police.heli.mesh.position.x, G.police.heli.mesh.position.z, p.x, p.z);
        blip(m.x, m.y, '#4488ff', 5, 'diamond');
      }
      // Tapes.
      for (const t of G.side.state.tapeMeshes) {
        if (t.taken) continue;
        const m = toMap(t.x, t.z, p.x, p.z);
        blip(m.x, m.y, '#ff2e88', 2.5);
      }
      // Shops / race starts / safehouse (static markers).
      const pois = [
        { x: -180, z: 40, c: '#00ff88', s: 'square' },
        { x: 160, z: 160, c: '#ff8800', s: 'square' },
        { x: -120, z: -180, c: '#ffffff', s: 'square' },
      ];
      for (const poi of pois) {
        const m = toMap(poi.x, poi.z, p.x, p.z);
        blip(m.x, m.y, poi.c, 3.5, poi.s);
      }
      // Player arrow (rotates with heading).
      ctx.save();
      ctx.translate(SIZE / 2, SIZE / 2);
      ctx.rotate(G.player.state.vehicle ? G.player.state.vehicle.heading : G.player.state.heading);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(6, 7);
      ctx.lineTo(-6, 7);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.stroke();
      ctx.restore();
      ctx.restore();
      // Ring.
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 2, 0, Math.PI * 2);
      ctx.stroke();
    },
  };
}
