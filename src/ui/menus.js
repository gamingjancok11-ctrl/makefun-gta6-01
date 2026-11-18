// Title screen, help overlay and the death / busted flow. The title is the
// game's first impression: big logotype, the city behind it, Start / Continue /
// How to play, and the control list.
import { CONTROLS_TEXT } from '../config.js';

function $(id) { return document.getElementById(id); }

export function createMenus(G) {
  function showTitle() {
    const el = $('title-screen');
    el.style.display = 'flex';
    $('btn-continue').style.display = G.save.hasSave() ? '' : 'none';
    $('btn-start').onclick = () => {
      G.audio.ensure();
      hideTitle();
      G.startGame(false);
    };
    $('btn-continue').onclick = () => {
      G.audio.ensure();
      hideTitle();
      G.startGame(true);
    };
    $('btn-help').onclick = () => {
      const h = $('help-overlay');
      h.style.display = h.style.display === 'none' ? 'block' : 'none';
    };
    const list = $('controls-list');
    list.innerHTML = CONTROLS_TEXT.map(([k, v]) => `<div><b>${k}</b><span>${v}</span></div>`).join('');
  }

  function hideTitle() {
    $('title-screen').style.display = 'none';
    $('help-overlay').style.display = 'none';
  }

  function showDeath() {
    const el = $('death-screen');
    $('death-title').textContent = 'WASTED';
    $('death-sub').textContent = 'The bay claims another one. You wake up at the safehouse, $100 lighter.';
    el.style.display = 'flex';
    setTimeout(() => {
      el.style.display = 'none';
      G.player.state.cash = Math.max(0, G.player.state.cash - 100);
      G.player.respawn({ x: -120, z: -180 });
      G.wanted.clearWanted();
    }, 3200);
  }

  return {
    showTitle,
    hideTitle,
    showDeath,
    toggleHelp() {
      const h = $('help-overlay');
      h.style.display = h.style.display === 'none' ? 'block' : 'none';
    },
  };
}
