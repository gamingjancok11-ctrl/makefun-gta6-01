// CALDERA BAY — entry point. Boots the game core once the DOM is ready.
import { createGame } from './core/game.js';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => createGame().start());
} else {
  createGame().start();
}
