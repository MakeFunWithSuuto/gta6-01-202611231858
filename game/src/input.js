// Keyboard and mouse state: held keys, one-shot presses, and the mouse in screen pixels.

export function createInput(canvas) {
  const input = { keys: new Set(), pressed: new Set(), mouseX: 0, mouseY: 0, mouseDown: false, clicked: false, wheel: 0 };
  window.addEventListener('keydown', (e) => {
    if (!input.keys.has(e.code)) input.pressed.add(e.code);
    input.keys.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.code));
  window.addEventListener('blur', () => input.keys.clear());
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouseX = (e.clientX - r.left) * (canvas.width / r.width);
    input.mouseY = (e.clientY - r.top) * (canvas.height / r.height);
  });
  canvas.addEventListener('mousedown', (e) => { if (e.button === 0) { input.mouseDown = true; input.clicked = true; } });
  window.addEventListener('mouseup', () => { input.mouseDown = false; });
  canvas.addEventListener('wheel', (e) => { input.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  return input;
}

/** True once per physical key press. */
export function wasPressed(input, ...codes) {
  return codes.some((c) => input.pressed.has(c));
}

export function isHeld(input, ...codes) {
  return codes.some((c) => input.keys.has(c));
}

/** Forget this frame's one-shot events. */
export function endInputFrame(input) {
  input.pressed.clear();
  input.clicked = false;
  input.wheel = 0;
}
