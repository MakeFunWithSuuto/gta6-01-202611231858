// The map of Port Solera, drawn once to an offscreen canvas and reused by the radar in the HUD
// corner and by the full-screen map.
import { BLOCK, ROAD, GRID_X, GRID_Y, WORLD_W, WORLD_H } from './config.js';
import { DISTRICTS, BEACH_X, SEA_X } from './city.js';
import { currentTarget } from './missions.js';

export const MAP_SCALE = 0.1;

/** Paint the whole city at map scale. */
export function renderCityMap(city) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(WORLD_W * MAP_SCALE);
  canvas.height = Math.ceil(WORLD_H * MAP_SCALE);
  const g = canvas.getContext('2d');
  g.scale(MAP_SCALE, MAP_SCALE);
  g.fillStyle = '#6fa95a';
  g.fillRect(0, 0, WORLD_W, WORLD_H);
  g.fillStyle = '#2c3038';
  g.fillRect(-ROAD / 2, -ROAD / 2, GRID_X * BLOCK + ROAD, GRID_Y * BLOCK + ROAD);
  for (const b of city.blocks) {
    g.fillStyle = DISTRICTS[b.district].ground;
    g.fillRect(b.x, b.y, b.w, b.h);
  }
  for (const p of city.parks) { g.fillStyle = '#5fae4a'; g.fillRect(p.x, p.y, p.w, p.h); }
  g.fillStyle = '#e9d9a8'; g.fillRect(BEACH_X, 0, SEA_X - BEACH_X, WORLD_H);
  g.fillStyle = '#1d8fc2'; g.fillRect(SEA_X, 0, WORLD_W, WORLD_H);
  for (const b of city.buildings) {
    g.fillStyle = b.height > 150 ? '#7c8a99' : '#a59e92';
    g.fillRect(b.x, b.y, b.w, b.h);
  }
  for (const p of city.pools) { g.fillStyle = '#4fd1e8'; g.fillRect(p.x, p.y, p.w, p.h); }
  return canvas;
}

const BLIP_GLYPHS = { house: 'H', wrench: 'W', spray: 'R', gun: 'A', cross: '+', badge: 'P' };

function drawBlip(ctx, x, y, color, glyph, size = 7) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
  if (glyph) {
    ctx.fillStyle = color === '#ffffff' ? '#c00' : '#111';
    ctx.font = `bold ${size + 3}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(glyph, x, y + 0.5);
  }
}

/**
 * Draw the map centred on (cx, cy) world units into a screen circle; `scale` is screen pixels
 * per world unit. Blips beyond the edge are pinned to it.
 */
export function drawRadar(ctx, state, sx, sy, radius, scale) {
  const pl = state.player;
  const body = pl.car || pl;
  ctx.save();
  ctx.beginPath(); ctx.arc(sx, sy, radius, 0, Math.PI * 2); ctx.closePath();
  ctx.fillStyle = 'rgba(10,20,30,0.8)'; ctx.fill();
  ctx.clip();
  const k = scale / MAP_SCALE;
  ctx.globalAlpha = 0.92;
  ctx.drawImage(state.mapCanvas, sx - body.x * scale, sy - body.y * scale, state.mapCanvas.width * k, state.mapCanvas.height * k);
  ctx.globalAlpha = 1;
  const toRadar = (x, y, pin) => {
    let dx = (x - body.x) * scale, dy = (y - body.y) * scale;
    const d = Math.hypot(dx, dy);
    if (pin && d > radius - 9) { dx *= (radius - 9) / d; dy *= (radius - 9) / d; }
    return { x: sx + dx, y: sy + dy, inside: d <= radius - 9 };
  };
  for (const key of Object.keys(state.city.places)) {
    const p = state.city.places[key];
    const r = toRadar(p.x, p.y, false);
    if (r.inside) drawBlip(ctx, r.x, r.y, p.color, BLIP_GLYPHS[p.icon], 6);
  }
  for (const c of state.cars) {
    if (c.driver !== 'police' || !c.siren) continue;
    const r = toRadar(c.x, c.y, false);
    if (r.inside) drawBlip(ctx, r.x, r.y, Math.floor(state.time * 6) % 2 ? '#ff2d3d' : '#2d7bff', null, 4);
  }
  for (const p of state.peds) {
    if (p.dead || !(p.kind === 'cop' || (p.kind === 'gang' && p.tag))) continue;
    const r = toRadar(p.x, p.y, false);
    if (r.inside) drawBlip(ctx, r.x, r.y, p.kind === 'cop' ? '#5aa0ff' : '#ff5a4f', null, 3);
  }
  const target = currentTarget(state);
  if (target) {
    const r = toRadar(target.x, target.y, true);
    drawBlip(ctx, r.x, r.y, target.kind === 'car' ? '#4dabff' : target.kind === 'enemy' ? '#ff5a4f' : '#ffd166', target.kind === 'start' ? '!' : null, 7);
  }
  ctx.restore();
  // The player's arrow.
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(pl.car ? pl.car.angle : pl.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-6, -6); ctx.lineTo(-3, 0); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = state.wanted.level > 0 ? (Math.floor(state.time * 4) % 2 ? '#ff2d3d' : '#2d7bff') : 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(sx, sy, radius, 0, Math.PI * 2); ctx.stroke();
}

/** Full-screen map with district names and a legend. */
export function drawFullMap(ctx, state) {
  const { W, H } = state.camera;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = 'rgba(8,14,24,0.92)';
  ctx.fillRect(0, 0, W, H);
  const map = state.mapCanvas;
  const s = Math.min((W - 360) / map.width, (H - 120) / map.height);
  const ox = 60, oy = (H - map.height * s) / 2;
  ctx.drawImage(map, ox, oy, map.width * s, map.height * s);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.strokeRect(ox, oy, map.width * s, map.height * s);
  const w2s = (x, y) => ({ x: ox + x * MAP_SCALE * s, y: oy + y * MAP_SCALE * s });
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const labels = [['Vista Alta', 1.5, 1.5], ['Solera Centro', 4.5, 4.5], ['Ironwharf', 1.8, 7.5], ['Mercado', 6.5, 1.5], ['Palmetto Park', 6.5, 6.5], ['Coral Strip', 8.5, 4.6], ['Mercado', 6.8, 4.3]];
  ctx.font = 'bold 15px "Trebuchet MS", sans-serif';
  for (const [name, bx, by] of labels) {
    const p = w2s(bx * BLOCK, by * BLOCK);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillText(name.toUpperCase(), p.x + 1, p.y + 1);
    ctx.fillStyle = '#ffffff'; ctx.fillText(name.toUpperCase(), p.x, p.y);
  }
  const sea = w2s(SEA_X + 300, WORLD_H / 2);
  ctx.save(); ctx.translate(sea.x, sea.y); ctx.rotate(-Math.PI / 2); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = 'italic 16px serif'; ctx.fillText('Bahía Solera', 0, 0); ctx.restore();
  for (const key of Object.keys(state.city.places)) {
    const p = state.city.places[key];
    const q = w2s(p.x, p.y);
    drawBlip(ctx, q.x, q.y, p.color, BLIP_GLYPHS[p.icon], 8);
  }
  const target = currentTarget(state);
  if (target) { const q = w2s(target.x, target.y); drawBlip(ctx, q.x, q.y, '#ffd166', '!', 9); }
  const pl = state.player.car || state.player;
  const me = w2s(pl.x, pl.y);
  drawBlip(ctx, me.x, me.y, '#ffffff', null, 6);
  // Legend.
  const lx = W - 270;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd166'; ctx.font = 'bold 30px "Trebuchet MS", sans-serif'; ctx.fillText('PORT SOLERA', lx, 90);
  ctx.font = '15px "Trebuchet MS", sans-serif';
  let y = 140;
  for (const key of Object.keys(state.city.places)) {
    const p = state.city.places[key];
    drawBlip(ctx, lx + 8, y, p.color, BLIP_GLYPHS[p.icon], 8);
    ctx.fillStyle = '#ffffff'; ctx.fillText(p.label, lx + 26, y);
    y += 30;
  }
  drawBlip(ctx, lx + 8, y, '#ffd166', '!', 8); ctx.fillStyle = '#fff'; ctx.fillText('Current objective', lx + 26, y);
  y += 44;
  ctx.fillStyle = '#9fb3c8';
  ctx.fillText(`Sun tokens found: ${state.tokensTaken.size}/20`, lx, y);
  ctx.fillText(`Missions passed: ${state.story.index}/5`, lx, y + 24);
  ctx.fillText(`Cars stolen: ${state.stats.carsStolen}`, lx, y + 48);
  ctx.fillText('M or Esc to close', lx, H - 60);
}
