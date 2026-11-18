// The wanted system: 0–5 stars. Crimes add stars; hiding out of police sight
// drains them; a respray clears them for cash. Star thresholds drive the
// dispatch: 1★ patrol cars, 2★ pursuit, 3★ roadblocks, 4★ helicopter, 5★ all-out.
import { ECONOMY } from '../config.js';

const CRIME_STARS = {
  carTheft: 1,
  shoot: 1,
  pedDown: 1,
  copDown: 2,
  copCarRam: 1,
  missionHeat: 2,
};

export function createWanted(G) {
  const state = {
    stars: 0,
    heat: 0, // 0–100 within the current star level
    evadeTimer: 0, // seconds hidden from all police
    lastCrimeAt: 0,
    inSight: false,
  };

  function setStars(n, silent) {
    const before = state.stars;
    state.stars = Math.max(0, Math.min(5, n));
    if (state.stars !== before) {
      G.audio.stinger(state.stars > before ? 'siren' : 'clear');
      if (!silent && state.stars > before) G.hud.flash(`${state.stars}★ WANTED`, '#ffcc00');
      if (state.stars === 0 && before > 0) G.hud.flash('HEAT OFF — YOU LOST THEM', '#7cff00');
      G.police.onWantedChange(state.stars, before);
    }
  }

  return {
    state,
    commitCrime(kind, pos) {
      const add = CRIME_STARS[kind] || 1;
      state.lastCrimeAt = G.time.elapsed;
      state.evadeTimer = 0;
      if (state.stars === 0) setStars(add);
      else {
        state.heat += add * 34;
        if (state.heat >= 100) {
          state.heat = 0;
          setStars(state.stars + 1);
        }
      }
      G.police.onCrime(kind, pos);
    },
    setStars,
    clearWanted() {
      state.stars = 0;
      state.heat = 0;
      state.evadeTimer = 0;
      G.police.onWantedChange(0, 99);
    },
    /** Pay-and-spray: clear the heat for cash at Caldera Customs. */
    respray() {
      if (state.stars === 0) return false;
      if (G.player.state.cash < ECONOMY.resprayCost) {
        G.hud.flash(`RESPRAY NEEDS $${ECONOMY.resprayCost}`, '#ff4444');
        return false;
      }
      G.player.state.cash -= ECONOMY.resprayCost;
      this.clearWanted();
      G.hud.flash('RESPRAYED — CLEAN SLATE', '#7cff00');
      G.audio.stinger('cash');
      return true;
    },
    update(dt) {
      if (state.stars === 0) return;
      // In sight of any police unit? Then the evade timer resets.
      state.inSight = G.police.anyUnitSeesPlayer();
      if (state.inSight) {
        state.evadeTimer = 0;
      } else {
        state.evadeTimer += dt;
        const need = 6 + state.stars * 4;
        if (state.evadeTimer > need) {
          state.evadeTimer = 0;
          setStars(state.stars - 1);
        }
      }
    },
  };
}
