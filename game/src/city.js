// Builds Port Solera from a seed: its districts, street grid, buildings, trees and named places,
// plus the lookups other systems ask of it (what is solid here, where the nearest lane is).
import { BLOCK, ROAD, SIDEWALK, GRID_X, GRID_Y, WORLD_W, WORLD_H } from './config.js';
import { createRng } from './rng.js';

export const DISTRICTS = {
  centro: { name: 'Solera Centro', ground: '#c9c4b8', palette: ['#7fb7c9', '#9cc8d4', '#5f9fb8', '#b7d6dd', '#8aa9c9', '#d8e3e6'] },
  mercado: { name: 'Mercado', ground: '#d6cbb5', palette: ['#f2a48b', '#f6c98f', '#9bd3b8', '#f3e2b3', '#c9a7d8', '#f7b9a8', '#a7cfe8'] },
  vista: { name: 'Vista Alta', ground: '#9ccc7a', palette: ['#f4ead2', '#f7d9c4', '#e9f1f4', '#fbe7a1', '#d6ecd8'] },
  ironwharf: { name: 'Ironwharf', ground: '#a9a59c', palette: ['#8f9aa3', '#b0a48f', '#7e8b84', '#a6886f', '#9aa7b8'] },
  coral: { name: 'Coral Strip', ground: '#e8d9b0', palette: ['#ffffff', '#ffd7c2', '#c2f0ea', '#ffe6a3', '#f5c6d9'] },
  park: { name: 'Palmetto Park', ground: '#7fbf5c', palette: ['#e9dcc0'] },
};

/** Which district a block (column, row) belongs to. */
export function districtOfBlock(bx, by) {
  if ((bx === 6 && by === 6) || (bx === 1 && by === 4)) return 'park';
  if (bx === GRID_X - 1) return 'coral';
  if (bx >= 3 && bx <= 5 && by >= 3 && by <= 5) return 'centro';
  if (by >= 6 && bx <= 3) return 'ironwharf';
  if (by <= 2 && bx <= 2) return 'vista';
  return 'mercado';
}

/** Inner rectangle of a block (inside the roads), pavement included. */
export function blockRect(bx, by) {
  return { x: bx * BLOCK + ROAD / 2, y: by * BLOCK + ROAD / 2, w: BLOCK - ROAD, h: BLOCK - ROAD };
}

const CELL = 260;

function addBuilding(city, rng, b) {
  b.id = city.buildings.length;
  city.buildings.push(b);
  for (let cx = Math.floor(b.x / CELL); cx <= Math.floor((b.x + b.w) / CELL); cx++) {
    for (let cy = Math.floor(b.y / CELL); cy <= Math.floor((b.y + b.h) / CELL); cy++) {
      const key = cx * 1000 + cy;
      if (!city.grid.has(key)) city.grid.set(key, []);
      city.grid.get(key).push(b);
    }
  }
}

function splitLots(rect, cols, rows, gap) {
  const lots = [];
  const w = (rect.w - gap * (cols - 1)) / cols;
  const h = (rect.h - gap * (rows - 1)) / rows;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) lots.push({ x: rect.x + i * (w + gap), y: rect.y + j * (h + gap), w, h });
  return lots;
}

function shrink(r, m) {
  return { x: r.x + m, y: r.y + m, w: r.w - 2 * m, h: r.h - 2 * m };
}

function fillCentro(city, rng, lot, pal) {
  const lots = rng.chance(0.35) ? [lot] : splitLots(lot, 2, rng.chance(0.5) ? 2 : 1, 18);
  lots.forEach((l, i) => {
    if (lots.length > 1 && i === 0 && rng.chance(0.25)) { city.plazas.push(l); return; }
    const big = lots.length === 1;
    addBuilding(city, rng, {
      ...shrink(l, rng.range(4, 14)), height: big ? rng.range(230, 320) : rng.range(140, 260),
      color: rng.pick(pal), roof: big ? rng.pick(['helipad', 'garden', 'flat']) : rng.pick(['flat', 'flat', 'garden', 'pool']), glass: true, district: 'centro',
    });
  });
}

function fillMercado(city, rng, lot, pal) {
  const cols = rng.int(2, 3), rows = rng.int(2, 3);
  for (const l of splitLots(lot, cols, rows, 12)) {
    if (rng.chance(0.1)) { city.plazas.push(l); continue; }
    addBuilding(city, rng, { ...shrink(l, rng.range(2, 8)), height: rng.range(45, 140), color: rng.pick(pal), roof: rng.pick(['flat', 'flat', 'garden', 'tiles']), district: 'mercado' });
  }
}

function fillVista(city, rng, lot, pal) {
  for (const l of splitLots(lot, 3, 3, 14)) {
    const house = { x: l.x + rng.range(6, 16), y: l.y + rng.range(6, 14), w: l.w * rng.range(0.55, 0.7), h: l.h * rng.range(0.45, 0.6) };
    addBuilding(city, rng, { ...house, height: rng.range(28, 44), color: rng.pick(pal), roof: 'tiles', district: 'vista' });
    if (rng.chance(0.6)) city.pools.push({ x: l.x + l.w * 0.55, y: l.y + l.h * 0.66, w: l.w * 0.36, h: l.h * 0.24 });
    city.trees.push({ x: l.x + l.w * rng.range(0.1, 0.9), y: l.y + l.h * rng.range(0.7, 0.95), r: rng.range(10, 15), palm: rng.chance(0.6), height: rng.range(40, 70) });
  }
}

function fillIronwharf(city, rng, lot, pal) {
  const halves = splitLots(lot, 1, 2, 24);
  addBuilding(city, rng, { ...shrink(halves[0], 6), height: rng.range(45, 65), color: rng.pick(pal), roof: 'ribbed', district: 'ironwharf' });
  const yard = halves[1];
  const colors = ['#c8553d', '#2f6f8f', '#e2a33c', '#4d8b55', '#7d4e9e'];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
    if (rng.chance(0.3)) continue;
    addBuilding(city, rng, { x: yard.x + 14 + i * 90, y: yard.y + 18 + j * 44, w: 78, h: 30, height: 18 * rng.int(1, 3), color: rng.pick(colors), roof: 'container', district: 'ironwharf' });
  }
}

function fillCoral(city, rng, lot, pal) {
  const lots = splitLots(lot, 1, 2, 30);
  for (const l of lots) {
    const tower = { x: l.x + 8, y: l.y + 8, w: l.w * 0.55, h: l.h - 16 };
    addBuilding(city, rng, { ...tower, height: rng.range(140, 240), color: rng.pick(pal), roof: 'pool', district: 'coral' });
    city.pools.push({ x: l.x + l.w * 0.66, y: l.y + 24, w: l.w * 0.28, h: l.h * 0.5 });
    for (let k = 0; k < 3; k++) city.trees.push({ x: l.x + l.w * 0.66 + k * 30, y: l.y + l.h - 14, r: 12, palm: true, height: 70 });
  }
}

function fillPark(city, rng, lot) {
  city.parks.push(lot);
  for (let i = 0; i < 26; i++) {
    const x = lot.x + rng.range(10, lot.w - 10), y = lot.y + rng.range(10, lot.h - 10);
    const cx = lot.x + lot.w / 2, cy = lot.y + lot.h / 2;
    if (Math.abs(x - cx) < 40 || Math.abs(y - cy) < 40) continue;
    city.trees.push({ x, y, r: rng.range(12, 20), palm: rng.chance(0.5), height: rng.range(40, 80) });
  }
  city.fountains.push({ x: lot.x + lot.w / 2, y: lot.y + lot.h / 2, r: 34 });
}

/** Named places: shops, safehouse, contacts. Each sits on a pavement where a player can walk in. */
function placeLandmarks(city) {
  const front = (bx, by, side = 'top') => {
    const r = blockRect(bx, by);
    if (side === 'top') return { x: r.x + r.w / 2, y: r.y + SIDEWALK / 2 };
    if (side === 'left') return { x: r.x + SIDEWALK / 2, y: r.y + r.h / 2 };
    if (side === 'bottom') return { x: r.x + r.w / 2, y: r.y + r.h - SIDEWALK / 2 };
    return { x: r.x + r.w - SIDEWALK / 2, y: r.y + r.h / 2 };
  };
  city.places = {
    safehouse: { ...front(1, 1, 'bottom'), label: 'Safehouse', icon: 'house', color: '#3dd6a0' },
    chopshop: { ...front(2, 7, 'top'), label: 'Wrench & Rust Chop Shop', icon: 'wrench', color: '#f5a623' },
    respray: { ...front(6, 2, 'left'), label: 'Sunshine Respray', icon: 'spray', color: '#ff6fb5' },
    arms: { ...front(2, 4, 'right'), label: 'Sunline Arms', icon: 'gun', color: '#ff5a4f' },
    hospital: { ...front(4, 1, 'top'), label: 'St. Amaro Hospital', icon: 'cross', color: '#ffffff' },
    precinct: { ...front(5, 7, 'top'), label: 'Solera PD Precinct', icon: 'badge', color: '#5aa0ff' },
  };
}

/** Generate the whole city from a seed. */
export function buildCity(seed) {
  const rng = createRng(seed);
  const city = { buildings: [], grid: new Map(), trees: [], pools: [], parks: [], plazas: [], fountains: [], blocks: [], places: {} };
  for (let bx = 0; bx < GRID_X; bx++) {
    for (let by = 0; by < GRID_Y; by++) {
      const district = districtOfBlock(bx, by);
      const rect = blockRect(bx, by);
      city.blocks.push({ bx, by, district, ...rect });
      const lot = shrink(rect, SIDEWALK + 6);
      const pal = DISTRICTS[district].palette;
      if (district === 'park') fillPark(city, rng, lot);
      else if (district === 'centro') fillCentro(city, rng, lot, pal);
      else if (district === 'vista') fillVista(city, rng, lot, pal);
      else if (district === 'ironwharf') fillIronwharf(city, rng, lot, pal);
      else if (district === 'coral') fillCoral(city, rng, lot, pal);
      else fillMercado(city, rng, lot, pal);
      // Street trees on the pavement corners.
      if (district !== 'ironwharf') for (const [fx, fy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        if (rng.chance(0.55)) city.trees.push({ x: rect.x + 10 + fx * (rect.w - 20), y: rect.y + 10 + fy * (rect.h - 20), r: 11, palm: true, height: rng.range(55, 80) });
      }
    }
  }
  // The beach east of the coast road.
  const beachX = GRID_X * BLOCK + ROAD / 2;
  for (let y = 60; y < WORLD_H - 60; y += 120) {
    city.trees.push({ x: beachX + 40 + rng.range(-10, 10), y: y + rng.range(-20, 20), r: 12, palm: true, height: rng.range(70, 95) });
    city.umbrellas = city.umbrellas || [];
    city.umbrellas.push({ x: beachX + rng.range(120, 230), y: y + rng.range(0, 80), color: rng.pick(['#ff5a4f', '#ffd166', '#06d6a0', '#118ab2', '#ef476f']) });
  }
  placeLandmarks(city);
  return city;
}

/** Buildings whose rectangles may touch the given box. */
export function buildingsNear(city, x, y, w, h) {
  const seen = new Set();
  const out = [];
  for (let cx = Math.floor(x / CELL); cx <= Math.floor((x + w) / CELL); cx++) {
    for (let cy = Math.floor(y / CELL); cy <= Math.floor((y + h) / CELL); cy++) {
      const list = city.grid.get(cx * 1000 + cy);
      if (!list) continue;
      for (const b of list) if (!seen.has(b.id)) { seen.add(b.id); out.push(b); }
    }
  }
  return out;
}

export const BEACH_X = GRID_X * BLOCK + ROAD / 2;
export const SEA_X = BEACH_X + 300;

/** The district name for a world point (roads take the block to their south-east). */
export function districtNameAt(x, y) {
  if (x > BEACH_X) return 'Coral Beach';
  const bx = Math.max(0, Math.min(GRID_X - 1, Math.floor(x / BLOCK)));
  const by = Math.max(0, Math.min(GRID_Y - 1, Math.floor(y / BLOCK)));
  return DISTRICTS[districtOfBlock(bx, by)].name;
}

/** True when a point lies on asphalt. */
export function onRoad(x, y) {
  const rx = ((x % BLOCK) + BLOCK) % BLOCK, ry = ((y % BLOCK) + BLOCK) % BLOCK;
  const nearX = rx < ROAD / 2 || rx > BLOCK - ROAD / 2;
  const nearY = ry < ROAD / 2 || ry > BLOCK - ROAD / 2;
  return (nearX || nearY) && x > -ROAD / 2 && x < GRID_X * BLOCK + ROAD / 2 && y > -ROAD / 2 && y < GRID_Y * BLOCK + ROAD / 2;
}

/** Keep a point inside the playable world (the sea and the map edges are walls). */
export function clampToWorld(p) {
  p.x = Math.max(-ROAD / 2 + 8, Math.min(SEA_X + 40, p.x));
  p.y = Math.max(-ROAD / 2 + 8, Math.min(GRID_Y * BLOCK + ROAD / 2 - 8, p.y));
}

export { WORLD_W, WORLD_H };
