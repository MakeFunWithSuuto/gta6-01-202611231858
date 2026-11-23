// Draws everything that moves or can be picked up: cars, people, the police helicopter,
// mission markers, pickups, bullets, particles and flashes.
import { shade, lift } from './render_world.js';
import { visibleRect } from './camera.js';
import { currentTarget } from './missions.js';
import { PARALLAX } from './config.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawCar(ctx, car, time) {
  const m = car.model, L = m.length, W = m.width;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.fillStyle = 'rgba(25,20,50,0.35)';
  ctx.save(); ctx.translate(5, 5); ctx.rotate(car.angle); roundRect(ctx, -L / 2, -W / 2, L, W, 6); ctx.fill(); ctx.restore();
  ctx.rotate(car.angle);
  const body = car.color;
  // Wheels peeking out.
  ctx.fillStyle = '#16161a';
  for (const [wx, wy] of [[L * 0.3, -W / 2], [L * 0.3, W / 2], [-L * 0.3, -W / 2], [-L * 0.3, W / 2]]) ctx.fillRect(wx - 5, wy - 2.5, 10, 5);
  const g = ctx.createLinearGradient(0, -W / 2, 0, W / 2);
  g.addColorStop(0, shade(body, 0.25)); g.addColorStop(0.5, body); g.addColorStop(1, shade(body, -0.3));
  ctx.fillStyle = g;
  roundRect(ctx, -L / 2, -W / 2, L, W, car.modelKey === 'kestrel' ? 8 : 5);
  ctx.fill();
  ctx.strokeStyle = shade(body, -0.45); ctx.lineWidth = 1; ctx.stroke();
  if (car.modelKey === 'mako') {
    ctx.fillStyle = shade(body, 0.1); ctx.fillRect(-L / 2 + 3, -W / 2 + 3, L * 0.62, W - 6);
    ctx.fillStyle = '#28323c'; ctx.fillRect(L * 0.15, -W / 2 + 2, 7, W - 4);
  } else if (car.modelKey === 'saguaro') {
    ctx.fillStyle = shade(body, -0.25); ctx.fillRect(-L / 2 + 3, -W / 2 + 3, L * 0.42, W - 6);
    ctx.fillStyle = '#28323c'; ctx.fillRect(L * 0.02, -W / 2 + 2, 7, W - 4);
    ctx.fillStyle = shade(body, 0.12); ctx.fillRect(L * 0.02 + 7, -W / 2 + 3, 9, W - 6);
  } else {
    const roofLen = car.modelKey === 'kestrel' ? L * 0.3 : L * 0.4;
    ctx.fillStyle = '#26303a'; roundRect(ctx, -roofLen / 2 - 6, -W / 2 + 2.5, roofLen + 16, W - 5, 3); ctx.fill();
    ctx.fillStyle = shade(body, 0.12); roundRect(ctx, -roofLen / 2 - 2, -W / 2 + 3.5, roofLen, W - 7, 2); ctx.fill();
    ctx.fillStyle = 'rgba(160,220,255,0.5)'; ctx.fillRect(roofLen / 2 + 3, -W / 2 + 4, 3, W - 8);
  }
  if (car.modelKey === 'kestrel') { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-L * 0.05, -1.5, L * 0.5, 3); }
  if (car.modelKey === 'lumen') { ctx.fillStyle = '#222'; ctx.fillRect(-4, -4, 8, 8); ctx.fillStyle = '#fff'; ctx.fillRect(-3, -3, 6, 6); }
  if (car.modelKey === 'interceptor') {
    ctx.fillStyle = '#1b2740'; ctx.fillRect(-L / 2, -W / 2, L * 0.28, W); ctx.fillRect(L * 0.3, -W / 2, L * 0.2, W);
    const on = car.siren && Math.floor(time * 8) % 2 === 0;
    ctx.fillStyle = car.siren ? (on ? '#ff2d3d' : '#5c1018') : '#5c1018'; ctx.fillRect(-2, -W / 2 + 2, 5, W / 2 - 2);
    ctx.fillStyle = car.siren ? (!on ? '#2d7bff' : '#0f2350') : '#0f2350'; ctx.fillRect(-2, 0, 5, W / 2 - 2);
  }
  // Lamps.
  ctx.fillStyle = '#fff8d6'; ctx.fillRect(L / 2 - 3, -W / 2 + 2, 3, 4); ctx.fillRect(L / 2 - 3, W / 2 - 6, 3, 4);
  ctx.fillStyle = car.brake ? '#ff3030' : '#9b1c1c'; ctx.fillRect(-L / 2, -W / 2 + 2, 2.5, 4); ctx.fillRect(-L / 2, W / 2 - 6, 2.5, 4);
  if (car.wrecked) { ctx.fillStyle = 'rgba(20,15,10,0.55)'; roundRect(ctx, -L / 2, -W / 2, L, W, 5); ctx.fill(); }
  ctx.restore();
}

export function drawPerson(ctx, p, time) {
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.dead) {
    ctx.rotate(p.angle + Math.PI / 2);
    ctx.fillStyle = 'rgba(120,20,20,0.35)';
    ctx.beginPath(); ctx.ellipse(2, 3, 12, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.pants; ctx.fillRect(-3, 2, 6, 12);
    ctx.fillStyle = p.shirt; ctx.fillRect(-7, -7, 14, 10);
    ctx.fillStyle = p.skin; ctx.beginPath(); ctx.arc(0, -10, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  ctx.fillStyle = 'rgba(25,20,50,0.3)';
  ctx.beginPath(); ctx.ellipse(3, 4, 9, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(p.angle);
  const swing = p.moving ? Math.sin(p.walkPhase) * 5 : 0;
  ctx.fillStyle = p.pants;
  ctx.fillRect(-2 + swing, -6, 7, 4);
  ctx.fillRect(-2 - swing, 2, 7, 4);
  ctx.fillStyle = p.shirt;
  ctx.beginPath(); ctx.ellipse(0, 0, 6, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; ctx.stroke();
  if (p.weapon && p.weapon !== 'fists') {
    ctx.fillStyle = '#1c1c1c'; ctx.fillRect(4, 3, p.weapon === 'pistol' ? 10 : 15, 3);
    ctx.fillStyle = p.skin; ctx.beginPath(); ctx.arc(5, 4.5, 2.6, 0, Math.PI * 2); ctx.fill();
    if (p.muzzle > 0) {
      ctx.fillStyle = '#fff2a8';
      ctx.beginPath(); ctx.moveTo(18, 4.5); ctx.lineTo(28, 1); ctx.lineTo(26, 4.5); ctx.lineTo(28, 8); ctx.closePath(); ctx.fill();
    }
  } else if (p.muzzle > 0) {
    ctx.fillStyle = p.skin; ctx.beginPath(); ctx.arc(11, 3, 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = p.skin;
  ctx.beginPath(); ctx.arc(1, 0, 4.6, 0, Math.PI * 2); ctx.fill();
  if (p.hat) { ctx.fillStyle = p.hat; ctx.beginPath(); ctx.arc(0, 0, 4.6, Math.PI * 0.5, Math.PI * 1.5); ctx.fill(); }
  if (p.kind === 'gang') { ctx.fillStyle = '#e63946'; ctx.fillRect(-1, -5, 3, 10); }
  ctx.restore();
  void time;
}

export function drawHelicopter(ctx, state) {
  const h = state.heli;
  if (!h) return;
  const cam = state.camera;
  // Searchlight on the ground.
  const pl = state.player;
  const g = ctx.createRadialGradient(pl.x, pl.y, 0, pl.x, pl.y, 90);
  g.addColorStop(0, 'rgba(255,255,220,0.35)'); g.addColorStop(1, 'rgba(255,255,220,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(pl.x + (h.x - pl.x) * 0.15, pl.y + (h.y - pl.y) * 0.15, 90, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(20,15,40,0.3)';
  ctx.beginPath(); ctx.ellipse(h.x + 70, h.y + 50, 26, 12, h.angle, 0, Math.PI * 2); ctx.fill();
  const top = lift(cam, h.x, h.y, 230);
  const s = 1 + 230 * PARALLAX;
  ctx.save();
  ctx.translate(top.x, top.y);
  ctx.scale(s, s);
  ctx.rotate(h.angle);
  ctx.fillStyle = '#1d2b4a'; ctx.fillRect(-38, -3, 30, 6);
  ctx.fillStyle = '#f4f6fa'; ctx.beginPath(); ctx.ellipse(0, 0, 20, 11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1d2b4a'; ctx.beginPath(); ctx.ellipse(-4, 0, 12, 11, 0, Math.PI * 0.5, Math.PI * 1.5); ctx.fill();
  ctx.fillStyle = 'rgba(120,200,255,0.8)'; ctx.beginPath(); ctx.ellipse(10, 0, 7, 7, 0, -Math.PI / 2, Math.PI / 2); ctx.fill();
  ctx.fillStyle = Math.floor(state.time * 6) % 2 ? '#ff2d3d' : '#2d7bff'; ctx.fillRect(-4, -2, 4, 4);
  ctx.rotate(h.rotor);
  ctx.fillStyle = 'rgba(40,40,40,0.55)';
  ctx.fillRect(-34, -2, 68, 4); ctx.fillRect(-2, -34, 4, 68);
  ctx.restore();
}

const PLACE_ICONS = { house: '⌂', wrench: '✦', spray: '✸', gun: '⌖', cross: '✚', badge: '★' };

/** Glowing rings on the ground for shops, the safehouse and mission goals. */
export function drawMarkers(ctx, state) {
  const t = state.time;
  for (const key of Object.keys(state.city.places)) {
    const p = state.city.places[key];
    ctx.fillStyle = p.color;
    ctx.globalAlpha = 0.35 + Math.sin(t * 3) * 0.1;
    ctx.beginPath(); ctx.arc(p.x, p.y, 18, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(PLACE_ICONS[p.icon], p.x, p.y + 1);
  }
  const target = currentTarget(state);
  if (target && (target.kind === 'start' || target.kind === 'goto' || target.kind === 'hold' || target.kind === 'pickup')) {
    const r = target.kind === 'start' ? 22 : Math.max(24, target.r || 24);
    const pulse = 1 + Math.sin(t * 4) * 0.08;
    const g = ctx.createRadialGradient(target.x, target.y, 0, target.x, target.y, r * pulse);
    g.addColorStop(0, 'rgba(255,209,102,0.05)'); g.addColorStop(0.8, 'rgba(255,209,102,0.45)'); g.addColorStop(1, 'rgba(255,209,102,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(target.x, target.y, r * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(target.x, target.y, r * 0.85 * pulse, 0, Math.PI * 2); ctx.stroke();
    if (target.kind === 'pickup') { ctx.fillStyle = '#8b5a2b'; ctx.fillRect(target.x - 8, target.y - 6, 16, 12); ctx.fillStyle = '#ffd166'; ctx.fillRect(target.x - 2, target.y - 6, 4, 12); }
  }
  if (target && (target.kind === 'car' || target.kind === 'enemy')) {
    const list = target.all || [target];
    for (const e of list) {
      const bob = Math.sin(t * 5) * 4;
      ctx.fillStyle = target.kind === 'car' ? '#4dabff' : '#ff5a4f';
      ctx.beginPath(); ctx.moveTo(e.x, e.y - 22 + bob); ctx.lineTo(e.x - 8, e.y - 36 + bob); ctx.lineTo(e.x + 8, e.y - 36 + bob); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();
    }
  }
}

export function drawPickups(ctx, state) {
  const t = state.time;
  for (const p of state.pickups) {
    const bob = Math.sin(t * 4 + p.x) * 2;
    if (p.kind === 'cash') { ctx.fillStyle = '#2f9e44'; ctx.fillRect(p.x - 7, p.y - 4 + bob, 14, 8); ctx.fillStyle = '#b2f2bb'; ctx.fillRect(p.x - 2, p.y - 2 + bob, 4, 4); }
    else if (p.kind === 'health') { ctx.fillStyle = '#ff4d6d'; ctx.fillRect(p.x - 7, p.y - 2 + bob, 14, 4); ctx.fillRect(p.x - 2, p.y - 7 + bob, 4, 14); }
    else { ctx.fillStyle = '#4dabff'; ctx.beginPath(); ctx.arc(p.x, p.y + bob, 7, 0, Math.PI * 2); ctx.fill(); }
  }
  for (const tok of state.tokens) {
    if (state.tokensTaken.has(tok.id)) continue;
    const bob = Math.sin(t * 3 + tok.id) * 3;
    ctx.save(); ctx.translate(tok.x, tok.y + bob); ctx.rotate(t * 1.5);
    ctx.fillStyle = '#ffb703';
    for (let k = 0; k < 8; k++) { ctx.rotate(Math.PI / 4); ctx.fillRect(-2, -12, 4, 6); }
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fillStyle = '#ffd60a'; ctx.fill();
    ctx.restore();
  }
}

export function drawParticles(ctx, state, layer) {
  for (const p of state.particles) {
    const high = p.kind === 'smoke' || p.kind === 'fire';
    if ((layer === 'high') !== high) continue;
    const k = 1 - p.life / p.maxLife;
    if (p.kind === 'smoke') ctx.fillStyle = `rgba(70,70,75,${0.35 * k})`;
    else if (p.kind === 'fire') ctx.fillStyle = `rgba(255,${120 + Math.floor(120 * k)},40,${0.85 * k})`;
    else if (p.kind === 'spark') ctx.fillStyle = `rgba(255,230,140,${k})`;
    else if (p.kind === 'debris') ctx.fillStyle = `rgba(50,45,40,${k})`;
    else if (p.kind === 'cash') ctx.fillStyle = `rgba(255,214,10,${k})`;
    else if (p.kind === 'dust') ctx.fillStyle = `rgba(200,200,200,${0.35 * k})`;
    else if (p.kind === 'hit') ctx.fillStyle = `rgba(180,30,40,${k})`;
    else ctx.fillStyle = `rgba(255,255,255,${k})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
  }
}

export function drawTracersAndFlashes(ctx, state) {
  ctx.lineCap = 'round';
  for (const t of state.tracers) {
    ctx.strokeStyle = t.color; ctx.globalAlpha = Math.min(1, t.life / 0.08); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(t.x1, t.y1); ctx.lineTo(t.x2, t.y2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'lighter';
  for (const f of state.flashes) {
    const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
    g.addColorStop(0, `rgba(255,220,150,${Math.min(1, f.life * 4)})`); g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

/** All cars and people in view. */
export function drawActors(ctx, state) {
  const view = visibleRect(state.camera, 80);
  const inView = (o) => o.x > view.x && o.x < view.x + view.w && o.y > view.y && o.y < view.y + view.h;
  for (const p of state.peds) if (p.dead && inView(p)) drawPerson(ctx, p, state.time);
  for (const p of state.peds) if (!p.dead && inView(p)) drawPerson(ctx, p, state.time);
  const pl = state.player;
  if (!pl.car && !pl.dead) drawPerson(ctx, pl, state.time);
  else if (!pl.car && pl.dead) drawPerson(ctx, { ...pl, dead: true }, state.time);
  for (const c of state.cars) if (inView(c)) drawCar(ctx, c, state.time);
}
