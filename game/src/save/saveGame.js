// Save / load / autosave via localStorage: cash, story progress, tapes, races,
// weapons, respect and the player's position. % complete counts story + tapes
// + races so the pause screen can show real progression.
import { SAVE_KEY } from '../config.js';

export function createSave(G) {
  function collect() {
    return {
      version: 1,
      cash: G.player.state.cash,
      respect: G.player.state.respect,
      health: G.player.state.health,
      missionsDone: G.missions.doneIds,
      tapes: G.side.state.tapeMeshes.filter((t) => t.taken).map((t) => `${t.x},${t.z}`),
      racesWon: G.side.state.racesWon,
      weapons: G.combat.state.owned,
      ammo: G.combat.state.ammo,
      mag: G.combat.state.mag,
      pos: { x: G.player.state.pos.x, z: G.player.state.pos.z },
      dayTime: G.time.dayTime,
      savedAt: new Date().toISOString(),
    };
  }

  function apply(data) {
    if (!data || data.version !== 1) return false;
    G.player.state.cash = data.cash;
    G.player.state.respect = data.respect || 0;
    G.player.state.health = data.health || 100;
    G.missions.setDoneIds(data.missionsDone || []);
    G.side.state.racesWon = data.racesWon || [];
    G.combat.state.owned = data.weapons || ['fists', 'pistol'];
    G.combat.state.ammo = { ...G.combat.state.ammo, ...(data.ammo || {}) };
    G.combat.state.mag = { ...G.combat.state.mag, ...(data.mag || {}) };
    const taken = new Set(data.tapes || []);
    for (const t of G.side.state.tapeMeshes) {
      if (taken.has(`${t.x},${t.z}`)) {
        t.taken = true;
        G.scene.remove(t.mesh);
        G.side.state.tapes += 1;
      }
    }
    if (data.pos) G.player.state.pos.set(data.pos.x, 0, data.pos.z);
    if (typeof data.dayTime === 'number') G.time.dayTime = data.dayTime;
    return true;
  }

  return {
    hasSave() {
      try { return !!localStorage.getItem(SAVE_KEY); } catch (_e) { return false; }
    },
    saveGame() {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(collect()));
        return true;
      } catch (_e) { return false; }
    },
    autosave() { this.saveGame(); },
    loadGame() {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return false;
        return apply(JSON.parse(raw));
      } catch (_e) { return false; }
    },
    /** % complete: story 60% + tapes 25% + races 15%. */
    completion() {
      const story = (G.missions.doneIds.length / 8) * 60;
      const tapes = (G.side.state.tapes / 20) * 25;
      const races = (G.side.state.racesWon.length / 3) * 15;
      return Math.round(story + tapes + races);
    },
    stats() {
      return {
        cash: G.player.state.cash,
        respect: G.player.state.respect,
        missions: `${G.missions.doneIds.length}/8`,
        tapes: `${G.side.state.tapes}/20`,
        races: `${G.side.state.racesWon.length}/3`,
        kills: G.combat.state.kills,
        completion: this.completion(),
      };
    },
  };
}
