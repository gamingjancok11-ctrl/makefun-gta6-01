// The HUD: mission panel, wanted stars, cash/clock, health, speedo, weapon bar,
// radio, dialogue, police list, district banner, flashes, chapter cards, race
// standings and the gun-shop overlay. All DOM; updated from the game state.
import { WEAPONS, WEAPON_ORDER } from '../config.js';
import { districtAt } from '../city/districts.js';

function $(id) {
  return document.getElementById(id);
}

export function createHud(G) {
  let flashTimer = 0;
  let dialogueQueue = [];
  let dialogueTimer = 0;
  let chapterTimer = 0;
  let jobTimer = 0;
  let lastDistrict = '';
  let districtTimer = 0;

  function show(el) { if (el) el.style.display = 'block'; }
  function hide(el) { if (el) el.style.display = 'none'; }

  const closeBtn = $('shop-close');
  if (closeBtn) closeBtn.onclick = () => { hide($('shop-overlay')); G.shopOpen = false; };

  const api = {
    flash(text, color) {
      // No centre-screen flashes in screenshot mode: a wanted-level flash
      // fired mid-settle sits over the frame at capture ("5★ WANTED" dead
      // centre of the fight shot). The stars in the corner still show.
      if (G.shot) return;
      const el = $('flash');
      el.textContent = text;
      el.style.color = color || '#ffffff';
      el.style.opacity = '1';
      flashTimer = 2.2;
    },
    /** Hide any flash already on screen (one fired while staging a shot, before G.shot was set). */
    clearFlash() {
      flashTimer = 0;
      const el = $('flash');
      if (el) el.style.opacity = '0';
    },
    setMission(mission, stageIndex, progress) {
      const panel = $('mission-panel');
      if (!mission) { hide(panel); return; }
      show(panel);
      const stage = mission.stages[stageIndex];
      $('mission-chapter').textContent = mission.chapter;
      $('mission-title').textContent = mission.title;
      let text = stage.text;
      if (stage.count && typeof progress === 'number') {
        text = text.replace(/\(\d+\/\d+\)/, `(${progress}/${stage.count})`);
      }
      $('mission-objective').textContent = text;
      $('mission-stage').textContent = `STAGE ${stageIndex + 1}/${mission.stages.length}`;
      $('mission-timer').textContent = stage.timer ? '' : '';
    },
    setTimer(seconds) {
      const el = $('mission-timer');
      if (seconds > 0) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        el.textContent = `⏱ ${m}:${String(s).padStart(2, '0')}`;
        el.style.color = seconds < 20 ? '#ff4444' : '#ffd700';
      } else {
        el.textContent = '';
      }
    },
    showObjective(text) {
      const el = $('objective-toast');
      el.textContent = text;
      el.style.opacity = '1';
      setTimeout(() => { el.style.opacity = '0'; }, 3500);
    },
    chapterCard(mission) {
      $('chapter-title').textContent = mission.chapter;
      $('chapter-name').textContent = mission.title;
      const el = $('chapter-card');
      el.style.opacity = '1';
      chapterTimer = 3.2;
    },
    jobComplete(mission) {
      $('job-title').textContent = `${mission.title} — COMPLETE`;
      $('job-payout').textContent = `+$${mission.payout}   ·   +10 RESPECT`;
      const el = $('job-complete');
      el.style.opacity = '1';
      jobTimer = 4;
    },
    showDialogue(lines) {
      dialogueQueue = [...lines];
      dialogueTimer = 0;
      nextDialogue();
    },
    racePanel(def, position, lap) {
      const el = $('race-panel');
      if (!def) { hide(el); return; }
      show(el);
      $('race-name').textContent = def.name.toUpperCase();
      $('race-position').textContent = `${position}/4`;
      $('race-lap').textContent = `LAP ${lap}/${def.laps}`;
    },
    showShop() {
      const overlay = $('shop-overlay');
      const list = $('shop-items');
      list.innerHTML = '';
      for (const id of WEAPON_ORDER.slice(1)) {
        const w = WEAPONS[id];
        const owned = G.combat.state.owned.includes(id);
        const row = document.createElement('div');
        row.className = 'shop-row';
        row.innerHTML = `<span><b>${w.name}</b> · DMG ${w.damage} · ${w.mag} rounds</span>`;
        const btn = document.createElement('button');
        if (!owned) {
          btn.textContent = `BUY $${w.price}`;
          btn.onclick = () => {
            if (G.combat.buyWeapon(id)) { api.flash(`${w.name} PURCHASED`, '#7cff00'); api.showShop(); }
            else api.flash('NOT ENOUGH CASH', '#ff4444');
          };
        } else {
          btn.textContent = 'AMMO $60';
          btn.onclick = () => {
            if (G.combat.buyAmmo(id)) api.flash('AMMO RESTOCKED', '#7cff00');
            else api.flash('NOT ENOUGH CASH', '#ff4444');
          };
        }
        row.appendChild(btn);
        list.appendChild(row);
      }
      show(overlay);
      G.shopOpen = true;
    },
    hideShop() {
      hide($('shop-overlay'));
      G.shopOpen = false;
    },
    update(dt) {
      // Flash + cards fade.
      if (flashTimer > 0) {
        flashTimer -= dt;
        if (flashTimer <= 0) $('flash').style.opacity = '0';
      }
      if (chapterTimer > 0) {
        chapterTimer -= dt;
        if (chapterTimer <= 0) $('chapter-card').style.opacity = '0';
      }
      if (jobTimer > 0) {
        jobTimer -= dt;
        if (jobTimer <= 0) $('job-complete').style.opacity = '0';
      }
      // Dialogue advance.
      if (dialogueQueue.length > 0) {
        dialogueTimer -= dt;
        if (dialogueTimer <= 0 || G.input.mouseClicked) nextDialogue();
      }
      // District banner.
      const d = districtAt(G.player.state.pos.x, G.player.state.pos.z);
      if (d.name !== lastDistrict) {
        lastDistrict = d.name;
        $('district-name').textContent = d.name.toUpperCase();
        $('district-blurb').textContent = d.blurb;
        $('district-banner').style.opacity = '1';
        districtTimer = 3;
      }
      if (districtTimer > 0) {
        districtTimer -= dt;
        if (districtTimer <= 0) $('district-banner').style.opacity = '0';
      }
      // Wanted stars.
      const stars = G.wanted.state.stars;
      let starHtml = '';
      for (let i = 0; i < 5; i += 1) starHtml += `<span class="${i < stars ? 'star on' : 'star'}">★</span>`;
      $('wanted-stars').innerHTML = starHtml;
      $('wanted-label').textContent = stars > 0 ? (G.wanted.state.inSight ? 'IN SIGHT' : 'EVADING…') : '';
      // Cash / clock / tapes / respect.
      $('cash').textContent = `$${G.player.state.cash.toLocaleString()}`;
      const t = G.time.dayTime;
      const hh = Math.floor(t);
      const mm = Math.floor((t - hh) * 60);
      $('clock').textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      $('tape-count').textContent = `TAPES ${G.side.state.tapes}/20`;
      $('respect-fill').style.width = `${Math.min(100, G.player.state.respect)}%`;
      // Health.
      $('health-fill').style.width = `${G.player.state.health}%`;
      $('health-fill').style.background = G.player.state.health > 50 ? '#7cff00' : G.player.state.health > 25 ? '#ffcc00' : '#ff4444';
      $('damage-vignette').style.opacity = G.player.state.health < 40 ? String(0.5 - G.player.state.health / 100) : '0';
      // Speedo + vehicle health.
      const v = G.player.state.vehicle;
      if (v) {
        $('speedo').textContent = String(Math.round(Math.abs(v.speed) * 3.6));
        $('speed-unit').textContent = 'KM/H';
        $('car-health').style.display = '';
        $('car-health-fill').style.width = `${v.health}%`;
      } else {
        $('speedo').textContent = String(Math.round(G.player.state.speed * 3.6));
        $('speed-unit').textContent = 'KM/H';
        $('car-health').style.display = 'none';
      }
      // Weapon bar.
      const bar = $('weapon-bar');
      let html = '';
      for (const id of WEAPON_ORDER) {
        if (!G.combat.state.owned.includes(id)) continue;
        const w = WEAPONS[id];
        const cur = G.combat.state.current === id;
        const mag = id === 'fists' ? '∞' : `${G.combat.state.mag[id]} / ${G.combat.state.ammo[id]}`;
        html += `<div class="weapon-slot ${cur ? 'current' : ''}"><b>${w.name}</b><span>${mag}</span></div>`;
      }
      bar.innerHTML = html;
      // Radio.
      const st = G.audio.currentStation();
      $('radio-track').textContent = G.audio.radioOn ? `${st.name} — ${G.audio.currentTrack()}` : 'RADIO OFF (Q)';
      // Police list.
      const list = G.police.listUnits();
      const pl = $('police-list');
      if (stars > 0 && list.length > 0) {
        show(pl);
        pl.innerHTML = '<div class="police-title">CBPD RESPONSE</div>' + list.map((u) => (
          `<div class="police-unit"><span>${u.callsign}</span><span>${u.dist}m</span><span>${u.state}</span></div>`
        )).join('');
      } else {
        hide(pl);
      }
      // Crosshair visibility.
      $('crosshair').style.display = G.player.state.onFoot && G.combat.state.current !== 'fists' ? '' : 'none';
    },
  };

  function nextDialogue() {
    const box = $('dialogue-box');
    const line = dialogueQueue.shift();
    if (!line) { hide(box); return; }
    show(box);
    $('dialogue-speaker').textContent = line.speaker.toUpperCase();
    $('dialogue-speaker').style.color = line.color || '#fff';
    $('dialogue-text').textContent = line.text;
    $('dialogue-portrait').textContent = line.speaker.slice(0, 2).toUpperCase();
    $('dialogue-portrait').style.background = line.color || '#888';
    dialogueTimer = 5;
  }

  return api;
}
