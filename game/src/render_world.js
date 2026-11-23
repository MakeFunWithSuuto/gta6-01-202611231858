// Draws the city itself: ground and districts, streets and their markings, the beach and sea,
// ground shadows, and buildings and palms raised in fake perspective around the view centre.
import { BLOCK, ROAD, SIDEWALK, GRID_X, GRID_Y, PARALLAX, SUN } from './config.js';
import { DISTRICTS, BEACH_X, SEA_X, buildingsNear } from './city.js';
import { visibleRect } from './camera.js';

/** Lighten (amount > 0) or darken (amount < 0) a #rrggbb colour. */
export function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount))));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function drawSeaAndBeach(ctx, view, time) {
  if (view.x + view.w < BEACH_X) return;
  const top = view.y, h = view.h;
  const sand = ctx.createLinearGradient(BEACH_X, 0, SEA_X, 0);
  sand.addColorStop(0, '#efdfb4');
  sand.addColorStop(1, '#f6e8c3');
  ctx.fillStyle = sand;
  ctx.fillRect(BEACH_X, top, SEA_X - BEACH_X, h);
  const sea = ctx.createLinearGradient(SEA_X, 0, SEA_X + 900, 0);
  sea.addColorStop(0, '#4fd1c5');
  sea.addColorStop(0.25, '#1fa2c8');
  sea.addColorStop(1, '#0b5f9e');
  ctx.fillStyle = sea;
  ctx.fillRect(SEA_X - 10, top, 3000, h);
  // Surf and swell lines.
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  for (let y = Math.floor(top / 20) * 20; y < top + h + 20; y += 20) {
    const x = SEA_X - 6 + Math.sin(y * 0.02 + time * 1.4) * 8;
    if (y === Math.floor(top / 20) * 20) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  for (let k = 1; k < 9; k++) {
    ctx.beginPath();
    for (let y = Math.floor(top / 30) * 30; y < top + h + 30; y += 30) {
      const x = SEA_X + k * 70 + Math.sin(y * 0.013 + time * 0.8 + k) * 14;
      if (y === Math.floor(top / 30) * 30) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function drawStreetMarkings(ctx, view) {
  const x0 = Math.max(0, Math.floor(view.x / BLOCK)), x1 = Math.min(GRID_X, Math.ceil((view.x + view.w) / BLOCK));
  const y0 = Math.max(0, Math.floor(view.y / BLOCK)), y1 = Math.min(GRID_Y, Math.ceil((view.y + view.h) / BLOCK));
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#f2c94c';
  ctx.setLineDash([]);
  ctx.beginPath();
  for (let i = x0; i <= x1; i++) for (let j = y0; j < y1; j++) {
    const ax = i * BLOCK, ay = j * BLOCK + ROAD / 2, by = (j + 1) * BLOCK - ROAD / 2;
    ctx.moveTo(ax - 2, ay); ctx.lineTo(ax - 2, by); ctx.moveTo(ax + 2, ay); ctx.lineTo(ax + 2, by);
  }
  for (let j = y0; j <= y1; j++) for (let i = x0; i < x1; i++) {
    const ay = j * BLOCK, ax = i * BLOCK + ROAD / 2, bx = (i + 1) * BLOCK - ROAD / 2;
    ctx.moveTo(ax, ay - 2); ctx.lineTo(bx, ay - 2); ctx.moveTo(ax, ay + 2); ctx.lineTo(bx, ay + 2);
  }
  ctx.stroke();
  // Crossings at every junction.
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) {
    const cx = i * BLOCK, cy = j * BLOCK;
    for (let k = -ROAD / 2 + 6; k < ROAD / 2 - 6; k += 10) {
      ctx.fillRect(cx + k, cy - ROAD / 2 - 14, 6, 12);
      ctx.fillRect(cx + k, cy + ROAD / 2 + 2, 6, 12);
      ctx.fillRect(cx - ROAD / 2 - 14, cy + k, 12, 6);
      ctx.fillRect(cx + ROAD / 2 + 2, cy + k, 12, 6);
    }
  }
}

function drawParks(ctx, city, view, time) {
  for (const p of city.parks) {
    if (!overlaps(p, view)) continue;
    ctx.fillStyle = '#7cc35a';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = '#e8dcbc';
    ctx.fillRect(p.x + p.w / 2 - 14, p.y, 28, p.h);
    ctx.fillRect(p.x, p.y + p.h / 2 - 14, p.w, 28);
  }
  for (const f of city.fountains) {
    if (Math.abs(f.x - view.x - view.w / 2) > view.w || Math.abs(f.y - view.y - view.h / 2) > view.h) continue;
    ctx.fillStyle = '#d9cfb6';
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r + 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#41b8d5';
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(f.x, f.y, ((time * 14 + k * 10) % 30) + 4, 0, Math.PI * 2); ctx.stroke(); }
  }
}

function drawPoolsAndPlazas(ctx, city, view) {
  for (const p of city.plazas) {
    if (!overlaps(p, view)) continue;
    ctx.fillStyle = '#e9e0cf';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.strokeStyle = 'rgba(150,130,100,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = p.x; x < p.x + p.w; x += 16) { ctx.moveTo(x, p.y); ctx.lineTo(x, p.y + p.h); }
    for (let y = p.y; y < p.y + p.h; y += 16) { ctx.moveTo(p.x, y); ctx.lineTo(p.x + p.w, y); }
    ctx.stroke();
  }
  for (const p of city.pools) {
    if (!overlaps(p, view)) continue;
    ctx.fillStyle = '#f4f1ea';
    ctx.fillRect(p.x - 4, p.y - 4, p.w + 8, p.h + 8);
    const g = ctx.createLinearGradient(p.x, p.y, p.x + p.w, p.y + p.h);
    g.addColorStop(0, '#5ee0f0'); g.addColorStop(1, '#1e9fd0');
    ctx.fillStyle = g;
    ctx.fillRect(p.x, p.y, p.w, p.h);
  }
}

/** Everything flat: districts, pavements, streets, beach and sea. */
export function drawGround(ctx, state) {
  const view = visibleRect(state.camera, 40);
  ctx.fillStyle = '#8cc26b';
  ctx.fillRect(view.x, view.y, view.w, view.h);
  // Asphalt everywhere inside the street grid; blocks are painted over it.
  ctx.fillStyle = '#41454d';
  ctx.fillRect(-ROAD / 2, -ROAD / 2, GRID_X * BLOCK + ROAD, GRID_Y * BLOCK + ROAD);
  for (const b of state.city.blocks) {
    if (!overlaps(b, view)) continue;
    ctx.fillStyle = '#9c978d';
    ctx.fillRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
    ctx.fillStyle = '#d8d1c3';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = DISTRICTS[b.district].ground;
    ctx.fillRect(b.x + SIDEWALK, b.y + SIDEWALK, b.w - SIDEWALK * 2, b.h - SIDEWALK * 2);
  }
  drawStreetMarkings(ctx, view);
  drawSeaAndBeach(ctx, view, state.time);
  drawParks(ctx, state.city, view, state.time);
  drawPoolsAndPlazas(ctx, state.city, view);
}

/** Tyre marks and scorch marks on the asphalt. */
export function drawGroundDecals(ctx, state) {
  ctx.fillStyle = 'rgba(20,20,24,0.35)';
  for (const s of state.skids) {
    const a = Math.max(0, 0.35 - s.age * 0.012);
    if (a <= 0) continue;
    ctx.globalAlpha = a / 0.35;
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.angle); ctx.fillRect(-4, -2, 8, 4); ctx.restore();
  }
  ctx.globalAlpha = 1;
  for (const s of state.scorches) {
    const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
    g.addColorStop(0, 'rgba(15,10,8,0.7)'); g.addColorStop(1, 'rgba(15,10,8,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
  }
}

/** Long afternoon shadows of buildings and trees, cast away from the sun. */
export function drawShadows(ctx, state, nearBuildings) {
  ctx.fillStyle = 'rgba(30,25,60,0.28)';
  ctx.beginPath();
  for (const b of nearBuildings) {
    const sx = b.height * SUN.x, sy = b.height * SUN.y;
    ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + b.w, b.y); ctx.lineTo(b.x + b.w + sx, b.y + sy);
    ctx.lineTo(b.x + b.w + sx, b.y + b.h + sy); ctx.lineTo(b.x + sx, b.y + b.h + sy); ctx.lineTo(b.x, b.y + b.h); ctx.closePath();
  }
  ctx.fill();
  const view = visibleRect(state.camera, 120);
  ctx.beginPath();
  for (const t of state.city.trees) {
    if (t.x < view.x || t.x > view.x + view.w || t.y < view.y || t.y > view.y + view.h) continue;
    ctx.moveTo(t.x + t.height * SUN.x * 0.6 + t.r, t.y + t.height * SUN.y * 0.6);
    ctx.arc(t.x + t.height * SUN.x * 0.6, t.y + t.height * SUN.y * 0.6, t.r, 0, Math.PI * 2);
  }
  ctx.fill();
}

/** Lift a world point to a given height above the ground (fake perspective about the camera). */
function lift(cam, x, y, h) {
  const s = 1 + h * PARALLAX;
  return { x: cam.x + (x - cam.x) * s, y: cam.y + (y - cam.y) * s };
}

function drawWall(ctx, cam, ax, ay, bx, by, h, fill, b, night) {
  const ra = lift(cam, ax, ay, h), rb = lift(cam, bx, by, h);
  ctx.fillStyle = fill;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(rb.x, rb.y); ctx.lineTo(ra.x, ra.y); ctx.closePath(); ctx.fill();
  // Floors and window mullions.
  const floor = b.district === 'vista' ? 99 : 13;
  ctx.strokeStyle = night > 0.3 ? `rgba(255,214,140,${0.25 + night * 0.5})` : b.glass ? 'rgba(220,245,255,0.35)' : 'rgba(60,40,30,0.18)';
  ctx.lineWidth = b.glass ? 2.2 : 1.6;
  ctx.beginPath();
  for (let f = floor; f < h - 4; f += floor) {
    const p = lift(cam, ax, ay, f), q = lift(cam, bx, by, f);
    ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
  }
  if (b.glass) {
    const len = Math.hypot(bx - ax, by - ay);
    for (let d = 12; d < len; d += 12) {
      const t = d / len, px = ax + (bx - ax) * t, py = ay + (by - ay) * t;
      const top = lift(cam, px, py, h);
      ctx.moveTo(px, py); ctx.lineTo(top.x, top.y);
    }
  }
  ctx.stroke();
}

function hash(n) {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function drawRoofDetails(ctx, b, x, y, w, h, s) {
  const id = b.id;
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 2 * s;
  ctx.strokeRect(x + 3 * s, y + 3 * s, w - 6 * s, h - 6 * s);
  if (b.roof === 'helipad') {
    const r = Math.min(w, h) * 0.2;
    ctx.fillStyle = '#4a5560';
    ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3 * s;
    ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, r * 0.8, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(r * 0.9)}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('H', x + w / 2, y + h / 2 + 1);
  } else if (b.roof === 'pool') {
    ctx.fillStyle = '#e8e2d6'; ctx.fillRect(x + w * 0.15, y + h * 0.2, w * 0.7, h * 0.6);
    ctx.fillStyle = '#3ccfe6'; ctx.fillRect(x + w * 0.22, y + h * 0.28, w * 0.56, h * 0.3);
    ctx.fillStyle = '#ff7a59';
    for (let k = 0; k < 4; k++) ctx.fillRect(x + w * (0.22 + k * 0.14), y + h * 0.66, 8 * s, 14 * s);
  } else if (b.roof === 'garden') {
    ctx.fillStyle = '#7dbb5a'; ctx.fillRect(x + w * 0.12, y + h * 0.12, w * 0.76, h * 0.76);
    ctx.fillStyle = '#4f9a45';
    for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.arc(x + w * (0.2 + hash(id + k) * 0.6), y + h * (0.2 + hash(id * 3 + k) * 0.6), 6 * s, 0, Math.PI * 2); ctx.fill(); }
  } else if (b.roof === 'tiles') {
    ctx.fillStyle = '#c8684a'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#a8523a';
    if (w > h) { ctx.fillRect(x, y + h / 2, w, h / 2); } else { ctx.fillRect(x + w / 2, y, w / 2, h); }
    ctx.strokeStyle = 'rgba(80,30,20,0.35)'; ctx.lineWidth = 1 * s;
    ctx.beginPath();
    for (let k = 4 * s; k < (w > h ? w : h); k += 6 * s) {
      if (w > h) { ctx.moveTo(x + k, y); ctx.lineTo(x + k, y + h); } else { ctx.moveTo(x, y + k); ctx.lineTo(x + w, y + k); }
    }
    ctx.stroke();
  } else if (b.roof === 'ribbed' || b.roof === 'container') {
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    for (let k = 5 * s; k < w; k += 7 * s) { ctx.moveTo(x + k, y); ctx.lineTo(x + k, y + h); }
    ctx.stroke();
  } else {
    ctx.fillStyle = 'rgba(90,95,100,0.55)';
    const n = 2 + Math.floor(hash(id) * 4);
    for (let k = 0; k < n; k++) ctx.fillRect(x + w * (0.12 + hash(id + k * 7) * 0.6), y + h * (0.12 + hash(id * 5 + k) * 0.6), 14 * s, 10 * s);
  }
}

function drawBuilding(ctx, cam, b, night) {
  const h = b.height;
  const cx = cam.x, cy = cam.y;
  const base = b.color;
  const lit = shade(base, -0.08), dark = shade(base, -0.32);
  if (cy < b.y) drawWall(ctx, cam, b.x, b.y, b.x + b.w, b.y, h, lit, b, night);
  if (cy > b.y + b.h) drawWall(ctx, cam, b.x, b.y + b.h, b.x + b.w, b.y + b.h, h, dark, b, night);
  if (cx < b.x) drawWall(ctx, cam, b.x, b.y, b.x, b.y + b.h, h, shade(base, -0.14), b, night);
  if (cx > b.x + b.w) drawWall(ctx, cam, b.x + b.w, b.y, b.x + b.w, b.y + b.h, h, shade(base, -0.4), b, night);
  const s = 1 + h * PARALLAX;
  const rx = cx + (b.x - cx) * s, ry = cy + (b.y - cy) * s;
  const rw = b.w * s, rh = b.h * s;
  ctx.fillStyle = shade(base, 0.18);
  ctx.fillRect(rx, ry, rw, rh);
  drawRoofDetails(ctx, b, rx, ry, rw, rh, s);
}

function drawTree(ctx, cam, t, time) {
  const top = lift(cam, t.x, t.y, t.height);
  if (t.palm) {
    ctx.strokeStyle = '#8a6a48';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(top.x, top.y); ctx.stroke();
    const sway = Math.sin(time * 1.3 + t.x * 0.01) * 0.08;
    const s = 1 + t.height * PARALLAX;
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + sway + t.x;
      ctx.strokeStyle = k % 2 ? '#2f8f4e' : '#3fae5c';
      ctx.lineWidth = 5 * s;
      ctx.beginPath();
      ctx.moveTo(top.x, top.y);
      ctx.quadraticCurveTo(top.x + Math.cos(a) * t.r * s, top.y + Math.sin(a) * t.r * s - 4, top.x + Math.cos(a) * t.r * 1.9 * s, top.y + Math.sin(a) * t.r * 1.9 * s);
      ctx.stroke();
    }
  } else {
    const s = 1 + t.height * PARALLAX;
    ctx.fillStyle = '#3e8e41';
    ctx.beginPath(); ctx.arc(top.x, top.y, t.r * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5cb85c';
    ctx.beginPath(); ctx.arc(top.x - t.r * 0.3 * s, top.y - t.r * 0.3 * s, t.r * 0.6 * s, 0, Math.PI * 2); ctx.fill();
  }
}

function drawUmbrellas(ctx, state, view) {
  for (const u of state.city.umbrellas || []) {
    if (u.y < view.y || u.y > view.y + view.h || u.x < view.x || u.x > view.x + view.w) continue;
    ctx.fillStyle = 'rgba(30,25,60,0.2)';
    ctx.beginPath(); ctx.arc(u.x + 8, u.y + 6, 16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(u.x - 18, u.y + 10, 12, 22); ctx.fillRect(u.x + 6, u.y + 10, 12, 22);
    for (let k = 0; k < 8; k++) {
      ctx.fillStyle = k % 2 ? u.color : '#ffffff';
      ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.arc(u.x, u.y, 16, (k / 8) * Math.PI * 2, ((k + 1) / 8) * Math.PI * 2); ctx.closePath(); ctx.fill();
    }
  }
}

/** Buildings in or near view, sorted far-from-centre first so nearer roofs overlap correctly. */
export function nearbyBuildings(state) {
  const view = visibleRect(state.camera, 260);
  const list = buildingsNear(state.city, view.x, view.y, view.w, view.h);
  const cam = state.camera;
  const d = (b) => Math.max(Math.abs(b.x + b.w / 2 - cam.x) - b.w / 2, Math.abs(b.y + b.h / 2 - cam.y) - b.h / 2);
  return list.sort((a, b) => d(b) - d(a));
}

/** Raised layer: buildings, palms and beach umbrellas. */
export function drawRaised(ctx, state, nearBuildings, night) {
  const view = visibleRect(state.camera, 150);
  drawUmbrellas(ctx, state, view);
  for (const b of nearBuildings) drawBuilding(ctx, state.camera, b, night);
  for (const t of state.city.trees) {
    if (t.x < view.x || t.x > view.x + view.w || t.y < view.y || t.y > view.y + view.h) continue;
    drawTree(ctx, state.camera, t, state.time);
  }
}

export { lift };
