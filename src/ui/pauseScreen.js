// Pause screen: full-city map (districts, roads, blips, GPS route), story
// progress, stats, % complete and the mission list. The map is the screenshot
// that proves the game's breadth in a single frame.
import { WORLD } from '../config.js';
import { DISTRICTS } from '../city/districts.js';
import { STORY_MISSIONS } from '../missions/storyMissions.js';

function $(id) { return document.getElementById(id); }

export function createPauseScreen(G) {
  const canvas = $('pause-map');
  const ctx = canvas.getContext('2d');
  const W = 640;
  const H = 640;
  canvas.width = W;
  canvas.height = H;

  const resumeBtn = $('btn-resume');
  if (resumeBtn) resumeBtn.onclick = () => { $('pause-screen').style.display = 'none'; G.paused = false; };
  const saveBtn = $('btn-save');
  if (saveBtn) saveBtn.onclick = () => { G.save.saveGame(); G.hud.flash('GAME SAVED', '#7cff00'); };

  function drawMap() {
    const s = W / WORLD.size;
    const toXY = (x, z) => ({ x: (x + WORLD.size / 2) * s, y: (z + WORLD.size / 2) * s });
    ctx.fillStyle = '#1d6f8a';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#6b5d4a';
    ctx.fillRect(0, 0, W, H);
    // District tints + labels.
    for (const d of DISTRICTS) {
      const [x0, z0, x1, z1] = d.bounds;
      const a = toXY(x0, z0);
      const b = toXY(x1, z1);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(d.name.toUpperCase(), (a.x + b.x) / 2, (a.y + b.y) / 2 - 4);
    }
    // Roads.
    ctx.strokeStyle = '#2e2a28';
    ctx.lineWidth = WORLD.roadWidth * s;
    for (const line of WORLD.roadLines) {
      const p = (line + WORLD.size / 2) * s;
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(W, p); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, H); ctx.stroke();
    }
    // Buildings.
    ctx.fillStyle = '#4a4238';
    for (const b of G.city.buildings) {
      const a = toXY(b.x - b.w / 2, b.z - b.d / 2);
      ctx.fillRect(a.x, a.y, b.w * s, b.d * s);
    }
    // GPS route.
    if (G.gps.route) {
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      G.gps.route.forEach((pt, i) => {
        const m = toXY(pt.x, pt.z);
        if (i === 0) ctx.moveTo(m.x, m.y);
        else ctx.lineTo(m.x, m.y);
      });
      ctx.stroke();
    }
    // Mission target.
    if (G.gps.target) {
      const m = toXY(G.gps.target.x, G.gps.target.z);
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.moveTo(m.x, m.y - 10);
      ctx.lineTo(m.x + 8, m.y);
      ctx.lineTo(m.x, m.y + 10);
      ctx.lineTo(m.x - 8, m.y);
      ctx.closePath();
      ctx.fill();
    }
    // Tapes.
    for (const t of G.side.state.tapeMeshes) {
      if (t.taken) continue;
      const m = toXY(t.x, t.z);
      ctx.fillStyle = '#ff2e88';
      ctx.beginPath();
      ctx.arc(m.x, m.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player.
    const p = toXY(G.player.state.pos.x, G.player.state.pos.z);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.stroke();
  }

  function refreshStats() {
    const st = G.save.stats();
    $('stat-cash').textContent = `$${st.cash.toLocaleString()}`;
    $('stat-missions').textContent = st.missions;
    $('stat-tapes').textContent = st.tapes;
    $('stat-races').textContent = st.races;
    $('stat-kills').textContent = String(st.kills);
    $('stat-complete').textContent = `${st.completion}%`;
    $('complete-fill').style.width = `${st.completion}%`;
    const list = $('mission-list');
    list.innerHTML = STORY_MISSIONS.map((m) => {
      const done = G.missions.doneIds.includes(m.id);
      const current = G.missions.current && G.missions.current.id === m.id;
      return `<div class="mission-row ${done ? 'done' : ''} ${current ? 'current' : ''}"><span>${done ? '✓' : current ? '▶' : '○'} ${m.chapter} — ${m.title}</span><span>$${m.payout}</span></div>`;
    }).join('');
  }

  return {
    open() {
      drawMap();
      refreshStats();
      $('pause-screen').style.display = 'flex';
      G.paused = true;
    },
    close() {
      $('pause-screen').style.display = 'none';
      G.paused = false;
    },
    get isOpen() {
      return $('pause-screen').style.display === 'flex';
    },
    drawMap,
    refreshStats,
  };
}
