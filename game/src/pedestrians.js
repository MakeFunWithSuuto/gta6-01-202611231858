// People on the pavements: civilians who stroll and flee, gang members who fight, and the
// shared on-foot movement, knock-downs and spawning around the player.
import { SIDEWALK, PEDESTRIAN_TARGET, SPAWN_MIN, SPAWN_MAX, DESPAWN, BLOCK, GRID_X, GRID_Y } from './config.js';
import { blockRect, buildingsNear, clampToWorld } from './city.js';
import { circleRectPush, dist2, angleDiff, clamp } from './mathutil.js';
import { emitBurst, playSound } from './effects.js';
import { carSpeed } from './vehicles.js';

const SHIRTS = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#f7fff7', '#ff9f1c', '#2ec4b6', '#e71d36', '#a06cd5', '#5fa8d3', '#f4a261'];
const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];
const PANTS = ['#264653', '#3d405b', '#6d6875', '#2b2d42', '#d6ccc2', '#7f5539'];

let nextPedId = 1;

export function createPed(state, x, y, kind = 'civ') {
  const rng = state.rng;
  return {
    id: nextPedId++, type: 'ped', kind, x, y, angle: rng() * Math.PI * 2, vx: 0, vy: 0, moving: false,
    hp: kind === 'gang' ? 60 : kind === 'cop' ? 70 : 30, dead: false, deadTime: 0,
    shirt: kind === 'cop' ? '#23408e' : kind === 'gang' ? '#7b1e3a' : rng.pick(SHIRTS),
    skin: rng.pick(SKINS), pants: kind === 'cop' ? '#1b2a4a' : rng.pick(PANTS), hat: kind === 'gang' ? '#111' : kind === 'cop' ? '#1b2a4a' : rng.chance(0.25) ? rng.pick(SHIRTS) : null,
    walkPhase: rng() * 6, state: 'walk', path: null, fear: 0, cooldown: rng.range(0.5, 1.5), weapon: kind === 'civ' ? null : 'pistol',
    speed: rng.range(38, 55), pause: 0, tag: null, hostile: kind === 'cop',
  };
}

/** Position on the pavement loop around a block at perimeter distance s. */
function loopPoint(rect, s) {
  const inset = SIDEWALK / 2;
  const x0 = rect.x + inset, y0 = rect.y + inset, w = rect.w - inset * 2, h = rect.h - inset * 2;
  const P = 2 * (w + h);
  s = ((s % P) + P) % P;
  if (s < w) return { x: x0 + s, y: y0 };
  if (s < w + h) return { x: x0 + w, y: y0 + (s - w) };
  if (s < 2 * w + h) return { x: x0 + w - (s - w - h), y: y0 + h };
  return { x: x0, y: y0 + h - (s - 2 * w - h) };
}

/** Attach a ped to the pavement loop of the block it stands nearest. */
export function attachToPavement(ped) {
  const bx = clamp(Math.floor(ped.x / BLOCK), 0, GRID_X - 1), by = clamp(Math.floor(ped.y / BLOCK), 0, GRID_Y - 1);
  const rect = blockRect(bx, by);
  const inset = SIDEWALK / 2;
  const w = rect.w - inset * 2, h = rect.h - inset * 2;
  const lx = clamp(ped.x - rect.x - inset, 0, w), ly = clamp(ped.y - rect.y - inset, 0, h);
  const dTop = ly, dRight = w - lx, dBottom = h - ly, dLeft = lx;
  const m = Math.min(dTop, dRight, dBottom, dLeft);
  const s = m === dTop ? lx : m === dRight ? w + ly : m === dBottom ? w + h + (w - lx) : 2 * w + h + (h - ly);
  ped.path = { rect, s, dir: ped.id % 2 ? 1 : -1 };
  ped.state = 'walk';
}

/** Move a ped toward a heading at a speed, sliding along buildings. */
export function moveOnFoot(state, ped, angle, speed, dt) {
  ped.vx = Math.cos(angle) * speed;
  ped.vy = Math.sin(angle) * speed;
  ped.x += ped.vx * dt;
  ped.y += ped.vy * dt;
  ped.angle = angle;
  ped.moving = speed > 1;
  ped.walkPhase += speed * dt * 0.12;
  pushOutOfBuildings(state, ped, 8);
}

export function pushOutOfBuildings(state, body, r) {
  for (const b of buildingsNear(state.city, body.x - 20, body.y - 20, 40, 40)) {
    const hit = circleRectPush(body.x, body.y, r, b);
    if (hit) { body.x += hit.nx * hit.depth; body.y += hit.ny * hit.depth; }
  }
  clampToWorld(body);
}

function walkPavement(state, ped, dt) {
  if (!ped.path) attachToPavement(ped);
  if (ped.pause > 0) { ped.pause -= dt; ped.moving = false; return; }
  if (state.rng.chance(dt * 0.05)) { ped.pause = state.rng.range(1, 3); return; }
  ped.path.s += ped.path.dir * ped.speed * dt;
  const p = loopPoint(ped.path.rect, ped.path.s);
  const angle = Math.atan2(p.y - ped.y, p.x - ped.x);
  const d = Math.hypot(p.x - ped.x, p.y - ped.y);
  if (d > 30) { moveOnFoot(state, ped, angle, ped.speed * 1.5, dt); return; }
  ped.x = p.x; ped.y = p.y;
  if (d > 0.1) ped.angle = angle;
  ped.moving = true;
  ped.walkPhase += ped.speed * dt * 0.12;
}

/** Make civilians near a point run away from it. */
export function scarePeds(state, x, y, radius) {
  for (const p of state.peds) {
    if (p.dead || p.kind !== 'civ') continue;
    if (dist2(p.x, p.y, x, y) < radius * radius) {
      p.state = 'flee';
      p.fear = 4 + state.rng() * 3;
      p.fleeFrom = { x, y };
      if (state.rng.chance(0.15)) playSound(state, 'scream', p.x, p.y, 0.5);
    }
  }
}

export function killPed(state, ped, by, fromX, fromY) {
  if (ped.dead) return;
  ped.dead = true;
  ped.deadTime = 0;
  ped.hp = 0;
  const a = Math.atan2(ped.y - fromY, ped.x - fromX);
  ped.vx = Math.cos(a) * 160;
  ped.vy = Math.sin(a) * 160;
  emitBurst(state, 'hit', ped.x, ped.y, 6);
  state.events.push({ type: 'pedKilled', ped, by });
  if (ped.kind !== 'cop' && state.rng.chance(0.6)) state.pickups.push({ kind: 'cash', amount: state.rng.int(10, 60), x: ped.x, y: ped.y, t: 0 });
  scarePeds(state, ped.x, ped.y, 220);
}

export function hurtPed(state, ped, amount, by, fromX, fromY) {
  if (ped.dead) return;
  ped.hp -= amount;
  emitBurst(state, 'hit', ped.x, ped.y, 3);
  if (ped.kind === 'gang' && by === 'player') ped.hostile = true;
  if (ped.hp <= 0) killPed(state, ped, by, fromX, fromY);
  else if (ped.kind === 'civ') scarePeds(state, ped.x, ped.y, 60);
}

/** Cars moving fast knock people down. */
function checkRunOver(state, ped) {
  for (const car of state.cars) {
    if (Math.abs(car.x - ped.x) > 34 || Math.abs(car.y - ped.y) > 34) continue;
    const sp = carSpeed(car);
    if (sp < 45) continue;
    const dx = ped.x - car.x, dy = ped.y - car.y;
    const c = Math.cos(car.angle), s = Math.sin(car.angle);
    const along = dx * c + dy * s, side = -dx * s + dy * c;
    if (Math.abs(along) < car.model.length / 2 + 6 && Math.abs(side) < car.model.width / 2 + 6) {
      if (sp > 110) killPed(state, ped, car.driver, car.x, car.y);
      else { hurtPed(state, ped, sp * 0.3, car.driver, car.x, car.y); ped.x += Math.sign(side || 1) * -s * 10; ped.y += Math.sign(side || 1) * c * 10; }
      playSound(state, 'thud', ped.x, ped.y, 0.8);
      return;
    }
  }
}

function updateCivilian(state, ped, dt) {
  if (ped.state === 'flee') {
    ped.fear -= dt;
    const a = Math.atan2(ped.y - ped.fleeFrom.y, ped.x - ped.fleeFrom.x) + Math.sin(ped.walkPhase * 0.2) * 0.4;
    moveOnFoot(state, ped, a, 150, dt);
    if (ped.fear <= 0) attachToPavement(ped);
  } else walkPavement(state, ped, dt);
}

/** Gang members stand their ground and shoot once provoked. */
function updateGang(state, ped, dt, fire) {
  const pl = state.player;
  const d2p = dist2(ped.x, ped.y, pl.x, pl.y);
  if (!ped.hostile || pl.dead || d2p > 520 * 520) { ped.moving = false; ped.angle += Math.sin(state.time + ped.id) * dt * 0.5; return; }
  const a = Math.atan2(pl.y - ped.y, pl.x - ped.x);
  if (d2p > 170 * 170) moveOnFoot(state, ped, a, 95, dt);
  else { ped.angle = a; ped.moving = false; }
  ped.cooldown -= dt;
  if (ped.cooldown <= 0 && d2p < 360 * 360) {
    ped.cooldown = state.rng.range(0.6, 1.3);
    fire(state, ped, a + state.rng.range(-0.18, 0.18), ped.weapon);
  }
}

/** Update every ped. `fire` is the combat module's shooter, passed in to keep modules one-way. */
export function updatePeds(state, dt, fire, updateCop) {
  for (const ped of state.peds) {
    if (ped.dead) {
      ped.deadTime += dt;
      ped.x += ped.vx * dt; ped.y += ped.vy * dt;
      ped.vx *= Math.pow(0.02, dt); ped.vy *= Math.pow(0.02, dt);
      continue;
    }
    if (ped.kind === 'civ') updateCivilian(state, ped, dt);
    else if (ped.kind === 'gang') updateGang(state, ped, dt, fire);
    else updateCop(state, ped, dt);
    checkRunOver(state, ped);
  }
}

function pickPavementSpot(state, minD, maxD) {
  const rng = state.rng, p = state.player;
  for (let t = 0; t < 12; t++) {
    const bx = clamp(Math.floor(p.x / BLOCK) + rng.int(-2, 2), 0, GRID_X - 1), by = clamp(Math.floor(p.y / BLOCK) + rng.int(-2, 2), 0, GRID_Y - 1);
    const rect = blockRect(bx, by);
    const pt = loopPoint(rect, rng.range(0, 4 * rect.w));
    const d2 = dist2(pt.x, pt.y, p.x, p.y);
    if (d2 > minD * minD && d2 < maxD * maxD) return pt;
  }
  return null;
}

/** Keep the pavements busy around the player and clear the far ones and old bodies. */
export function managePeds(state, minD = SPAWN_MIN) {
  const p = state.player;
  state.peds = state.peds.filter((q) => q.tag || (dist2(q.x, q.y, p.x, p.y) < DESPAWN * DESPAWN && !(q.dead && q.deadTime > 40)));
  const living = state.peds.filter((q) => q.kind === 'civ' && !q.dead).length;
  if (living < PEDESTRIAN_TARGET && (state.frame % 8 === 0 || minD < SPAWN_MIN)) {
    const spot = pickPavementSpot(state, minD, SPAWN_MAX);
    if (spot) {
      const ped = createPed(state, spot.x, spot.y, 'civ');
      attachToPavement(ped);
      state.peds.push(ped);
    }
  }
}

export function seedPeds(state, count) {
  for (let i = 0; i < count; i++) managePeds(state, 60);
}

/** Living ped nearest to a point within a radius, filtered. */
export function nearestPed(state, x, y, radius, filter = () => true) {
  let best = null, bd = radius * radius;
  for (const q of state.peds) {
    if (q.dead || !filter(q)) continue;
    const d = dist2(q.x, q.y, x, y);
    if (d < bd) { bd = d; best = q; }
  }
  return best;
}

export { angleDiff };
