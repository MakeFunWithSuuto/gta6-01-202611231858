// The heads-up display: radar, wanted stars, cash, health and armour, weapon and ammo, the
// mission objective and arrow, speedometer, subtitles, banners and notices.
import { drawRadar } from './minimap.js';
import { objectiveText, currentTarget } from './missions.js';
import { WEAPONS } from './combat.js';
import { carSpeed } from './vehicles.js';
import { worldToScreen } from './camera.js';
import { clockText } from './lighting.js';
import { districtNameAt } from './city.js';
import { SHOP_ITEMS } from './activities.js';

const FONT = '"Trebuchet MS", "Segoe UI", sans-serif';

function outlined(ctx, text, x, y, fill, size, weight = 'bold', align = 'left', stroke = 'rgba(0,0,0,0.85)') {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(3, size / 6);
  ctx.strokeStyle = stroke;
  ctx.lineJoin = 'round';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

/** Text with ~highlighted~ spans, left-aligned; returns its width. */
function richText(ctx, text, x, y, size, measureOnly = false) {
  ctx.font = `bold ${size}px ${FONT}`;
  const parts = text.split('~');
  let cx = x;
  parts.forEach((part, i) => {
    if (!measureOnly) outlined(ctx, part, cx, y, i % 2 ? '#ffd166' : '#ffffff', size);
    ctx.font = `bold ${size}px ${FONT}`;
    cx += ctx.measureText(part).width;
  });
  return cx - x;
}

function drawStar(ctx, x, y, r, filled, color) {
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? color : 'rgba(0,0,0,0.35)';
  ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = filled ? '#000' : 'rgba(255,255,255,0.5)'; ctx.stroke();
}

function drawBar(ctx, x, y, w, h, value, color, back) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = back; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color; ctx.fillRect(x, y, w * Math.max(0, Math.min(1, value)), h);
}

function drawTopRight(ctx, state, W) {
  const pl = state.player, w = state.wanted;
  const right = W - 26;
  outlined(ctx, clockText(state.clock), right, 30, '#ffffff', 22, 'bold', 'right');
  outlined(ctx, `$${pl.money.toLocaleString('en-US').padStart(7, '0')}`, right, 64, '#7ee081', 34, 'bold', 'right');
  const flashing = w.flash > 0 && Math.floor(w.flash * 8) % 2 === 0;
  for (let k = 0; k < 5; k++) {
    const filled = k < w.level;
    const dim = w.searching && filled && Math.floor(state.time * 3) % 2 === 0;
    drawStar(ctx, right - 14 - (4 - k) * 34, 104, 14, filled && !flashing, dim ? '#a08a3a' : '#ffd23f');
  }
  // Weapon card.
  const weapon = WEAPONS[pl.weapon];
  const cardX = right - 170, cardY = 130;
  ctx.fillStyle = 'rgba(10,14,24,0.6)'; ctx.fillRect(cardX, cardY, 170, 46);
  outlined(ctx, weapon.name.toUpperCase(), cardX + 12, cardY + 16, '#ffffff', 16);
  outlined(ctx, weapon.ammo ? `${pl.ammo[pl.weapon] || 0} rounds` : 'melee', cardX + 12, cardY + 34, '#9fb3c8', 13, 'normal');
  drawWeaponIcon(ctx, pl.weapon, cardX + 140, cardY + 23);
  drawBar(ctx, cardX, cardY + 58, 170, 9, pl.health / 100, pl.hurtFlash > 0 ? '#ff8080' : '#4cd964', '#1f3b26');
  if (pl.armor > 0) drawBar(ctx, cardX, cardY + 74, 170, 6, pl.armor / 100, '#4dabff', '#1a2b40');
}

function drawWeaponIcon(ctx, key, x, y) {
  ctx.fillStyle = '#e9ecef';
  if (key === 'fists') { ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#adb5bd'; ctx.fillRect(x - 7, y - 3, 14, 2); return; }
  if (key === 'pistol') { ctx.fillRect(x - 12, y - 6, 22, 6); ctx.fillRect(x - 12, y - 6, 7, 14); return; }
  if (key === 'smg') { ctx.fillRect(x - 16, y - 6, 30, 6); ctx.fillRect(x - 6, y, 5, 10); ctx.fillRect(x - 16, y, 5, 6); return; }
  ctx.fillRect(x - 20, y - 4, 36, 5); ctx.fillRect(x - 20, y, 9, 7);
}

function drawObjective(ctx, state) {
  const text = objectiveText(state);
  const a = state.story.active;
  const title = a ? a.mission.title.toUpperCase() : state.story.index >= state.story.missions.length ? 'FREE ROAM' : 'NEXT JOB';
  const width = Math.max(320, richText(ctx, text, 0, 0, 18, true) + 40);
  ctx.fillStyle = 'rgba(10,14,24,0.62)';
  ctx.fillRect(18, 18, width, a && a.timer !== null ? 92 : 68);
  ctx.fillStyle = '#ffd166'; ctx.fillRect(18, 18, 5, a && a.timer !== null ? 92 : 68);
  outlined(ctx, title, 36, 38, '#ffd166', 15);
  richText(ctx, text, 36, 64, 18);
  if (a && a.timer !== null) {
    const t = Math.max(0, a.timer);
    outlined(ctx, `TIME ${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`, 36, 92, t < 15 ? '#ff5a4f' : '#ffffff', 18);
  }
}

/** Arrow at the screen edge toward an off-screen objective. */
function drawTargetArrow(ctx, state) {
  const target = currentTarget(state);
  if (!target) return;
  const cam = state.camera;
  const p = worldToScreen(cam, target.x, target.y);
  const margin = 60;
  if (p.x > margin && p.x < cam.W - margin && p.y > margin && p.y < cam.H - margin) return;
  const cx = cam.W / 2, cy = cam.H / 2;
  const a = Math.atan2(p.y - cy, p.x - cx);
  const k = Math.min((cam.W / 2 - margin) / Math.abs(Math.cos(a) || 1e-6), (cam.H / 2 - margin) / Math.abs(Math.sin(a) || 1e-6));
  ctx.save();
  ctx.translate(cx + Math.cos(a) * k, cy + Math.sin(a) * k);
  ctx.rotate(a);
  ctx.fillStyle = '#ffd166'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -13); ctx.lineTo(-4, 0); ctx.lineTo(-10, 13); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
  const pl = state.player.car || state.player;
  const meters = Math.round(Math.hypot(target.x - pl.x, target.y - pl.y) / 8);
  outlined(ctx, `${meters} m`, cx + Math.cos(a) * (k - 34), cy + Math.sin(a) * (k - 34), '#ffd166', 14, 'bold', 'center');
}

function drawSpeedo(ctx, state, W, H) {
  const car = state.player.car;
  if (!car) return;
  const kmh = Math.round(carSpeed(car) * 0.42);
  const x = W - 120, y = H - 90;
  ctx.fillStyle = 'rgba(10,14,24,0.6)';
  ctx.beginPath(); ctx.arc(x, y, 62, Math.PI * 0.75, Math.PI * 2.25); ctx.lineTo(x, y); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#ff7a59'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(x, y, 54, Math.PI * 0.75, Math.PI * 0.75 + Math.PI * 1.5 * Math.min(1, kmh / 240)); ctx.stroke();
  outlined(ctx, String(kmh), x, y - 4, '#ffffff', 30, 'bold', 'center');
  outlined(ctx, 'KM/H', x, y + 22, '#9fb3c8', 12, 'bold', 'center');
  outlined(ctx, car.model.name.toUpperCase(), x, y + 52, '#ffffff', 13, 'bold', 'center');
  drawBar(ctx, x - 50, y + 66, 100, 5, car.hp / car.model.hp, car.hp < car.model.hp * 0.35 ? '#ff5a4f' : '#ffd166', '#3a2f1a');
  if (state.radio && state.radio.name) outlined(ctx, `♪ ${state.radio.name}`, W - 26, H - 196, '#c77dff', 15, 'bold', 'right');
}

function drawSubtitle(ctx, state, W, H) {
  const sub = state.story.subtitle;
  if (!sub) return;
  const y = H - 150;
  ctx.font = `bold 21px ${FONT}`;
  const width = ctx.measureText(`${sub.who}: ${sub.text}`).width + 40;
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(W / 2 - width / 2, y - 20, width, 40);
  ctx.font = `bold 21px ${FONT}`;
  const whoW = ctx.measureText(`${sub.who}: `).width;
  const startX = W / 2 - width / 2 + 20;
  outlined(ctx, `${sub.who}:`, startX, y, sub.color, 21);
  outlined(ctx, sub.text, startX + whoW, y, '#ffffff', 21, 'normal');
}

function drawBanner(ctx, state, W, H) {
  const b = state.story.banner;
  if (!b) return;
  const fade = Math.min(1, b.time * 2);
  ctx.globalAlpha = fade;
  const y = H * 0.3;
  const g = ctx.createLinearGradient(0, y - 50, 0, y + 50);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, y - 60, W, 120);
  outlined(ctx, b.title.toUpperCase(), W / 2, y - 10, b.color, 54, '900', 'center');
  outlined(ctx, b.sub, W / 2, y + 36, '#ffffff', 22, 'bold', 'center');
  ctx.globalAlpha = 1;
}

function drawNotices(ctx, state, W) {
  let y = 230;
  for (const n of state.notices) {
    ctx.globalAlpha = Math.min(1, n.time);
    ctx.font = `bold 17px ${FONT}`;
    const w = ctx.measureText(n.text).width + 28;
    ctx.fillStyle = 'rgba(10,14,24,0.7)'; ctx.fillRect(W - 26 - w, y - 16, w, 32);
    ctx.fillStyle = n.color; ctx.fillRect(W - 26 - w, y - 16, 4, 32);
    outlined(ctx, n.text, W - 40, y, n.color, 17, 'bold', 'right');
    y += 40;
  }
  ctx.globalAlpha = 1;
}

function drawFailScreen(ctx, state, W, H) {
  const pl = state.player;
  if (!pl.dead) return;
  const k = Math.min(1, (3.2 - pl.failTimer) / 1.2);
  ctx.fillStyle = pl.failKind === 'wasted' ? `rgba(60,0,0,${0.5 * k})` : `rgba(0,20,60,${0.5 * k})`;
  ctx.fillRect(0, 0, W, H);
  outlined(ctx, pl.failKind === 'wasted' ? 'WASTED' : 'BUSTED', W / 2, H / 2, pl.failKind === 'wasted' ? '#ff3b3b' : '#5aa0ff', 96 * (0.8 + 0.2 * k), '900', 'center');
}

function drawShop(ctx, state, W, H) {
  if (!state.ui.shopOpen) return;
  const x = W / 2 - 230, y = H / 2 - 150;
  ctx.fillStyle = 'rgba(10,14,24,0.88)'; ctx.fillRect(x, y, 460, 300);
  ctx.fillStyle = '#ff5a4f'; ctx.fillRect(x, y, 460, 50);
  outlined(ctx, 'SUNLINE ARMS', x + 20, y + 26, '#ffffff', 26, '900');
  outlined(ctx, `$${state.player.money}`, x + 440, y + 26, '#7ee081', 22, 'bold', 'right');
  SHOP_ITEMS.forEach((item, i) => {
    const iy = y + 82 + i * 40;
    outlined(ctx, `${i + 1}`, x + 30, iy, '#ffd166', 20);
    outlined(ctx, item.label, x + 60, iy, '#ffffff', 19, 'normal');
    outlined(ctx, `$${item.price}`, x + 440, iy, state.player.money >= item.price ? '#7ee081' : '#ff8080', 19, 'bold', 'right');
  });
  outlined(ctx, 'Press a number to buy. Walk away to leave.', W / 2, y + 286, '#9fb3c8', 14, 'normal', 'center');
}

function drawCrosshair(ctx, state, input) {
  const pl = state.player;
  if (pl.car || pl.dead || !input || pl.weapon === 'fists') return;
  const x = input.mouseX, y = input.mouseY;
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.moveTo(x - 15, y); ctx.lineTo(x - 5, y); ctx.moveTo(x + 5, y); ctx.lineTo(x + 15, y);
  ctx.moveTo(x, y - 15); ctx.lineTo(x, y - 5); ctx.moveTo(x, y + 5); ctx.lineTo(x, y + 15); ctx.stroke();
}

/** Draw the whole HUD in screen space. */
export function drawHud(ctx, state, input) {
  const { W, H } = state.camera;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (state.player.hurtFlash > 0) {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8);
    g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, `rgba(200,0,0,${state.player.hurtFlash})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  drawTargetArrow(ctx, state);
  drawRadar(ctx, state, 120, H - 120, 98, 0.16);
  const body = state.player.car || state.player;
  outlined(ctx, districtNameAt(body.x, body.y).toUpperCase(), 120, H - 236, '#ffffff', 16, 'bold', 'center');
  drawTopRight(ctx, state, W);
  drawObjective(ctx, state);
  drawSpeedo(ctx, state, W, H);
  if (state.ui.hint) outlined(ctx, state.ui.hint, W / 2, H - 60, '#ffffff', 19, 'bold', 'center');
  drawSubtitle(ctx, state, W, H);
  drawNotices(ctx, state, W);
  drawBanner(ctx, state, W, H);
  drawShop(ctx, state, W, H);
  drawCrosshair(ctx, state, input);
  drawFailScreen(ctx, state, W, H);
}

export { outlined, FONT };
