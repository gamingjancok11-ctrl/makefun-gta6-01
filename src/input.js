// Keyboard + mouse input: held keys, edge-triggered presses, mouse look deltas,
// pointer lock with a drag fallback (headless capture never locks the pointer).
export function createInput(canvas) {
  const keys = new Set();
  const pressedQueue = new Set();
  let mouseDX = 0;
  let mouseDY = 0;
  let mouseDown = false;
  let mouseClicked = false;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    pressedQueue.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas) {
      mouseDX += e.movementX;
      mouseDY += e.movementY;
    } else if (dragging) {
      mouseDX += e.clientX - lastX;
      mouseDY += e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
    }
  });
  canvas.addEventListener('mousedown', (e) => {
    mouseDown = true;
    mouseClicked = true;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    if (document.pointerLockElement !== canvas && canvas.requestPointerLock) {
      try { canvas.requestPointerLock(); } catch (_err) { /* headless: no lock */ }
    }
  });
  window.addEventListener('mouseup', () => { mouseDown = false; dragging = false; });
  window.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    get locked() { return document.pointerLockElement === canvas; },
    isDown(code) { return keys.has(code); },
    /** True only on the frame the key went down. */
    wasPressed(code) { return pressedQueue.has(code); },
    get mouseDown() { return mouseDown; },
    get mouseClicked() { return mouseClicked; },
    /** Consume accumulated look deltas for this frame. */
    takeMouseDelta() {
      const d = { x: mouseDX, y: mouseDY };
      mouseDX = 0;
      mouseDY = 0;
      return d;
    },
    /** Call at the end of each frame. */
    endFrame() {
      pressedQueue.clear();
      mouseClicked = false;
    },
    /** Synthetic key press (used by the autopilot in screenshot scenes). */
    press(code) { keys.add(code); pressedQueue.add(code); },
    release(code) { keys.delete(code); },
    releaseAll() { keys.clear(); },
  };
}
