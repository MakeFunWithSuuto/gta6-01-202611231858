// Title screen and pause menu: the logo over a slowly drifting city, Continue / New Game /
// Controls, and a pause menu with save, map and quit.
import { wasPressed } from './input.js';
import { outlined, FONT } from './hud.js';
import { describeSave } from './save.js';

export const TITLE_ITEMS = ['Continue', 'New Game', 'Controls'];
export const PAUSE_ITEMS = ['Resume', 'Map', 'Save Game', 'Controls', 'Quit to Title'];

const CONTROLS = [
  ['W A S D', 'Walk / drive'], ['Mouse', 'Aim'], ['Left click', 'Shoot / punch'], ['F or Enter', 'Steal a car / get out'],
  ['Shift', 'Sprint'], ['Space', 'Handbrake (drift)'], ['Q / E, wheel, 1-4', 'Switch weapon'], ['H', 'Horn'], ['R', 'Change radio station'],
  ['G', 'Save at safehouse / sell car'], ['M', 'Map'], ['Esc', 'Pause'],
];

/** Move a menu cursor and report the chosen item, if any. */
export function navigateMenu(menu, items, input, enabled = () => true) {
  if (wasPressed(input, 'Enter', 'Space') && enabled(items[menu.cursor])) return { chosen: items[menu.cursor] };
  if (input.clicked && menu.hover !== null && menu.hover !== undefined && enabled(items[menu.hover])) return { chosen: items[menu.hover] };
  const step = wasPressed(input, 'ArrowDown', 'KeyS') ? 1 : wasPressed(input, 'ArrowUp', 'KeyW') ? -1 : 0;
  if (!step) return {};
  do menu.cursor = (menu.cursor + step + items.length) % items.length; while (!enabled(items[menu.cursor]));
  return { moved: true };
}

function drawLogo(ctx, W, y) {
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `900 112px ${FONT}`;
  const g = ctx.createLinearGradient(0, y - 60, 0, y + 50);
  g.addColorStop(0, '#ffe29a'); g.addColorStop(0.45, '#ff9a5a'); g.addColorStop(1, '#ff4f8b');
  ctx.lineWidth = 12; ctx.strokeStyle = '#1b1035'; ctx.lineJoin = 'round';
  ctx.strokeText('SUNBURN', W / 2, y);
  ctx.fillStyle = g; ctx.fillText('SUNBURN', W / 2, y);
  ctx.font = `bold 26px ${FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('P O R T   S O L E R A', W / 2, y + 70);
  ctx.restore();
}

function drawMenuList(ctx, menu, items, x, y, enabled, input) {
  menu.hover = null;
  items.forEach((item, i) => {
    const iy = y + i * 50;
    const on = enabled(item);
    if (input && Math.abs(input.mouseY - iy) < 22 && Math.abs(input.mouseX - x) < 160) { menu.hover = i; if (on) menu.cursor = i; }
    const sel = menu.cursor === i;
    if (sel) {
      ctx.fillStyle = 'rgba(255,122,89,0.9)';
      ctx.fillRect(x - 150, iy - 21, 300, 42);
    }
    outlined(ctx, item.toUpperCase(), x, iy, on ? '#ffffff' : 'rgba(255,255,255,0.35)', 26, '900', 'center');
  });
}

export function drawControls(ctx, W, H) {
  ctx.fillStyle = 'rgba(8,12,22,0.9)';
  ctx.fillRect(W / 2 - 300, H / 2 - 250, 600, 500);
  outlined(ctx, 'CONTROLS', W / 2, H / 2 - 215, '#ffd166', 30, '900', 'center');
  CONTROLS.forEach(([key, what], i) => {
    const y = H / 2 - 165 + i * 33;
    outlined(ctx, key, W / 2 - 30, y, '#ffd166', 18, 'bold', 'right');
    outlined(ctx, what, W / 2 + 0, y, '#ffffff', 18, 'normal', 'left');
  });
  outlined(ctx, 'Esc or Enter to go back', W / 2, H / 2 + 228, '#9fb3c8', 14, 'normal', 'center');
}

/** The title screen, drawn over the live city render. */
export function drawTitle(ctx, state, menu, save, input) {
  const { W, H } = state.camera;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(40,10,60,0.55)'); g.addColorStop(0.5, 'rgba(255,120,80,0.15)'); g.addColorStop(1, 'rgba(10,10,30,0.75)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  drawLogo(ctx, W, H * 0.27);
  const enabled = (item) => item !== 'Continue' || !!save;
  drawMenuList(ctx, menu, TITLE_ITEMS, W / 2, H * 0.55, enabled, input);
  if (save) outlined(ctx, describeSave(save), W / 2, H * 0.55 + 23, '#ffe29a', 14, 'bold', 'center');
  outlined(ctx, 'A story of fast cars, old friends and one very bad idea.', W / 2, H - 70, '#ffffff', 17, 'italic', 'center');
  outlined(ctx, 'Arrow keys / mouse to choose · Enter to start', W / 2, H - 40, '#9fb3c8', 14, 'normal', 'center');
  if (menu.showControls) drawControls(ctx, W, H);
}

export function drawPause(ctx, state, menu, input) {
  const { W, H } = state.camera;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = 'rgba(8,12,22,0.6)'; ctx.fillRect(0, 0, W, H);
  outlined(ctx, 'PAUSED', W / 2, H * 0.24, '#ffd166', 64, '900', 'center');
  drawMenuList(ctx, menu, PAUSE_ITEMS, W / 2, H * 0.4, () => true, input);
  const s = state.stats;
  outlined(ctx, `Missions ${state.story.index}/5   ·   Cars stolen ${s.carsStolen}   ·   Cars sold ${s.carsSold}   ·   Sun tokens ${state.tokensTaken.size}/20`, W / 2, H - 50, '#ffffff', 16, 'bold', 'center');
  if (menu.showControls) drawControls(ctx, W, H);
}
