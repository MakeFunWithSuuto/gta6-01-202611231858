// Time of day: a day-night cycle tint over the world, golden hour, and at dusk and night the
// headlights, police strobes and street lamps that light it.
import { BLOCK, GRID_X, GRID_Y, ROAD } from './config.js';
import { visibleRect } from './camera.js';

/** 0 at midday, 1 in deep night, from the clock in minutes. */
export function nightAmount(clock) {
  const h = (clock / 60) % 24;
  if (h >= 7 && h < 18) return 0;
  if (h >= 18 && h < 20.5) return (h - 18) / 2.5;
  if (h >= 5 && h < 7) return 1 - (h - 5) / 2;
  return 1;
}

/** Warm colour cast of the hour as an rgb multiply. */
function tintFor(clock) {
  const h = (clock / 60) % 24;
  const night = nightAmount(clock);
  const golden = h >= 16 && h < 20 ? Math.sin(((h - 16) / 4) * Math.PI) : h >= 5.5 && h < 8 ? Math.sin(((h - 5.5) / 2.5) * Math.PI) * 0.6 : 0;
  const r = 255 - night * 175 + golden * 0;
  const g = 255 - night * 160 - golden * 45;
  const b = 255 - night * 90 - golden * 95;
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

export function clockText(clock) {
  const m = Math.floor(clock) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function glow(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

/** Tint the world for the hour, then add lights back in. Call with the world transform set. */
export function drawLighting(ctx, state) {
  const view = visibleRect(state.camera, 60);
  const night = nightAmount(state.clock);
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = tintFor(state.clock);
  ctx.fillRect(view.x, view.y, view.w, view.h);
  ctx.globalCompositeOperation = 'lighter';
  const t = state.time;
  for (const car of state.cars) {
    if (car.x < view.x || car.x > view.x + view.w || car.y < view.y || car.y > view.y + view.h) continue;
    if (car.siren) {
      const on = Math.floor(t * 8) % 2 === 0;
      glow(ctx, car.x, car.y, 70, on ? 'rgba(255,40,60,0.45)' : 'rgba(40,110,255,0.45)');
    }
    if (night > 0.15 && !car.wrecked && car.driver !== 'parked') {
      const c = Math.cos(car.angle), s = Math.sin(car.angle);
      const fx = car.x + c * car.model.length * 0.5, fy = car.y + s * car.model.length * 0.5;
      const g = ctx.createRadialGradient(fx, fy, 4, fx + c * 70, fy + s * 70, 90);
      g.addColorStop(0, `rgba(255,240,200,${0.5 * night})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(fx, fy); ctx.arc(fx, fy, 150, car.angle - 0.35, car.angle + 0.35); ctx.closePath(); ctx.fill();
      glow(ctx, car.x - c * car.model.length * 0.5, car.y - s * car.model.length * 0.5, 16, `rgba(255,30,30,${0.5 * night})`);
    }
  }
  if (night > 0.1) {
    const x0 = Math.max(0, Math.floor(view.x / BLOCK)), x1 = Math.min(GRID_X, Math.ceil((view.x + view.w) / BLOCK));
    const y0 = Math.max(0, Math.floor(view.y / BLOCK)), y1 = Math.min(GRID_Y, Math.ceil((view.y + view.h) / BLOCK));
    for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) {
      for (const [dx, dy] of [[-1, -1], [1, 1]]) glow(ctx, i * BLOCK + dx * (ROAD / 2 + 4), j * BLOCK + dy * (ROAD / 2 + 4), 110, `rgba(255,190,110,${0.32 * night})`);
    }
    for (const key of Object.keys(state.city.places)) {
      const p = state.city.places[key];
      glow(ctx, p.x, p.y, 60, `rgba(255,120,200,${0.35 * night})`);
    }
  }
  for (const f of state.particles) if (f.kind === 'fire') glow(ctx, f.x, f.y, 26, `rgba(255,140,40,${0.25 * (1 - f.life / f.maxLife)})`);
  ctx.globalCompositeOperation = 'source-over';
}
