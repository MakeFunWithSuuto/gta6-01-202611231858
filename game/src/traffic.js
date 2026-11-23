// Civilian traffic: cars that keep to their lane on the street grid, turn at junctions, queue
// behind each other, stop for people, and are spawned and cleared around the player.
import { BLOCK, GRID_X, GRID_Y, LANE, KERB, TRAFFIC_TARGET, SPAWN_MIN, SPAWN_MAX, DESPAWN } from './config.js';
import { createCar, randomCivilianModel, forwardSpeed } from './vehicles.js';
import { angleDiff, clamp, dist2 } from './mathutil.js';
import { playSound } from './effects.js';

export const DIRS = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }];

/** Directions a car may leave junction (i, j) by. */
export function exitsAt(i, j) {
  const out = [];
  if (i < GRID_X) out.push(0);
  if (j < GRID_Y) out.push(1);
  if (i > 0) out.push(2);
  if (j > 0) out.push(3);
  return out;
}

/** The point on the right-hand lane of direction `dir` that passes junction (i, j). */
export function lanePoint(i, j, dir) {
  const d = DIRS[dir];
  return { x: i * BLOCK - d.y * LANE, y: j * BLOCK + d.x * LANE };
}

/** Put a car on a lane heading `dir`, `along` pixels past junction (i, j). */
export function placeOnLane(car, i, j, dir, along) {
  const p = lanePoint(i, j, dir);
  const d = DIRS[dir];
  car.x = p.x + d.x * along;
  car.y = p.y + d.y * along;
  car.angle = Math.atan2(d.y, d.x);
  car.ai.dir = dir;
  car.ai.ti = i + d.x;
  car.ai.tj = j + d.y;
}

/** Make a car look for the next junction from where it stands, heading roughly its way. */
export function joinNearestLane(car) {
  const dir = ((Math.round(car.angle / (Math.PI / 2)) % 4) + 4) % 4;
  const d = DIRS[dir];
  const i = Math.round(car.x / BLOCK), j = Math.round(car.y / BLOCK);
  const along = d.x !== 0 ? (car.x - i * BLOCK) * d.x : (car.y - j * BLOCK) * d.y;
  car.ai.dir = dir;
  car.ai.ti = along > 0 ? i + d.x : i;
  car.ai.tj = along > 0 ? j + d.y : j;
  if (car.ai.ti < 0 || car.ai.ti > GRID_X || car.ai.tj < 0 || car.ai.tj > GRID_Y) { car.ai.ti = i; car.ai.tj = j; }
}

/**
 * Steer a car along its lane toward its target junction; at the junction `chooseDir` picks the
 * way on. Sets throttle and steer for the physics step and returns the distance to the junction.
 */
export function followLanes(car, chooseDir, cruise, dt) {
  const ai = car.ai;
  const d = DIRS[ai.dir];
  const target = lanePoint(ai.ti, ai.tj, ai.dir);
  const toJunction = (target.x - car.x) * d.x + (target.y - car.y) * d.y;
  if (toJunction < 14) {
    const exits = exitsAt(ai.ti, ai.tj).filter((e) => e !== (ai.dir + 2) % 4);
    const next = chooseDir(ai.ti, ai.tj, exits.length ? exits : [(ai.dir + 2) % 4]);
    ai.dir = next;
    const nd = DIRS[next];
    ai.ti += nd.x;
    ai.tj += nd.y;
  }
  const dd = DIRS[ai.dir];
  const lane = lanePoint(ai.ti, ai.tj, ai.dir);
  const along = (car.x - lane.x) * dd.x + (car.y - lane.y) * dd.y;
  const look = Math.min(0, along + 70);
  const aimX = lane.x + dd.x * look, aimY = lane.y + dd.y * look;
  const want = Math.atan2(aimY - car.y, aimX - car.x);
  const diff = angleDiff(car.angle, want);
  car.steer = clamp(diff * 2.4, -1, 1);
  const turning = Math.abs(diff) > 0.35;
  const speed = forwardSpeed(car);
  const goal = turning ? cruise * 0.5 : cruise;
  car.throttle = clamp((goal - speed) / 60, -1, 1);
  car.handbrake = false;
  void dt;
  return -along;
}

/** True when something sits in the road just ahead of a car. */
function blockedAhead(state, car, reach) {
  const c = Math.cos(car.angle), s = Math.sin(car.angle);
  const fx = car.x + c * reach * 0.6, fy = car.y + s * reach * 0.6;
  const r2 = (reach * 0.55) ** 2;
  for (const o of state.cars) {
    if (o === car) continue;
    if (dist2(o.x, o.y, fx, fy) < r2) {
      const ahead = (o.x - car.x) * c + (o.y - car.y) * s;
      if (ahead > 10) return o;
    }
  }
  for (const p of state.peds) if (!p.dead && dist2(p.x, p.y, fx, fy) < r2 * 0.5) return p;
  const pl = state.player;
  if (!pl.car && dist2(pl.x, pl.y, fx, fy) < r2 * 0.5) return pl;
  return null;
}

function randomTurn(rng) {
  return (i, j, exits) => rng.pick(exits);
}

/** Drive one civilian car for a frame. */
export function driveTraffic(state, car, dt) {
  const ai = car.ai;
  if (ai.state === 'panic') {
    followLanes(car, randomTurn(state.rng), 300, dt);
    ai.panic -= dt;
    if (ai.panic <= 0) ai.state = 'cruise';
    return;
  }
  followLanes(car, randomTurn(state.rng), ai.cruise || 150, dt);
  const block = blockedAhead(state, car, 74);
  if (block) {
    car.throttle = forwardSpeed(car) > 5 ? -1 : 0;
    ai.wait += dt;
    if (ai.wait > 2.5 && block === state.player.car) {
      ai.wait = 0;
      playSound(state, 'horn', car.x, car.y, 0.5);
    }
  } else ai.wait = 0;
}

function pickSpawn(state, minD, maxD) {
  const rng = state.rng;
  const p = state.player;
  for (let tries = 0; tries < 20; tries++) {
    const i = Math.round(p.x / BLOCK) + rng.int(-3, 3);
    const j = Math.round(p.y / BLOCK) + rng.int(-3, 3);
    if (i < 0 || i > GRID_X || j < 0 || j > GRID_Y) continue;
    const dir = rng.pick(exitsAt(i, j));
    const along = rng.range(60, BLOCK - 80);
    const lp = lanePoint(i, j, dir);
    const x = lp.x + DIRS[dir].x * along, y = lp.y + DIRS[dir].y * along;
    const d2 = dist2(x, y, p.x, p.y);
    if (d2 < minD * minD || d2 > maxD * maxD) continue;
    if (state.cars.some((c) => dist2(c.x, c.y, x, y) < 90 * 90)) continue;
    return { i, j, dir, along };
  }
  return null;
}

/** Spawn a civilian car on a lane between minD and maxD from the player. */
export function spawnTrafficCar(state, minD = SPAWN_MIN, maxD = SPAWN_MAX) {
  const spot = pickSpawn(state, minD, maxD);
  if (!spot) return null;
  const car = createCar(state, randomCivilianModel(state.rng), 0, 0, 0, 'traffic');
  placeOnLane(car, spot.i, spot.j, spot.dir, spot.along);
  car.ai.cruise = state.rng.range(120, 190);
  const c = Math.cos(car.angle), s = Math.sin(car.angle);
  car.vx = c * car.ai.cruise * 0.8;
  car.vy = s * car.ai.cruise * 0.8;
  state.cars.push(car);
  return car;
}

/** Keep the traffic population steady around the player; drop far, unimportant cars. */
export function manageTraffic(state) {
  const p = state.player;
  state.cars = state.cars.filter((c) => c.tag || c.driver === 'player' || dist2(c.x, c.y, p.x, p.y) < DESPAWN * DESPAWN || c === p.car);
  const civilians = state.cars.filter((c) => c.driver === 'traffic').length;
  if (civilians < TRAFFIC_TARGET && state.frame % 10 === 0) spawnTrafficCar(state);
  const parked = state.cars.filter((c) => c.driver === 'parked' && !c.wrecked).length;
  if (parked < 10 && state.frame % 30 === 15) spawnParkedCar(state, SPAWN_MIN);
}

/** A car standing at the kerb, `along` pixels past junction (i, j) on the side of direction `dir`. */
export function parkAtKerb(state, modelKey, i, j, dir, along) {
  const d = DIRS[dir];
  const car = createCar(state, modelKey, i * BLOCK - d.y * KERB + d.x * along, j * BLOCK + d.x * KERB + d.y * along, Math.atan2(d.y, d.x), 'parked');
  car.handbrake = true;
  state.cars.push(car);
  return car;
}

/** Leave an empty car at a kerb somewhere off screen, ready to be stolen. */
export function spawnParkedCar(state, minD) {
  const spot = pickSpawn(state, minD, SPAWN_MAX);
  if (!spot || spot.along < 110 || spot.along > BLOCK - 130) return null;
  return parkAtKerb(state, randomCivilianModel(state.rng), spot.i, spot.j, spot.dir, spot.along);
}

/** Fill the streets at the start, including those in view. */
export function seedTraffic(state, count) {
  for (let k = 0; k < count; k++) spawnTrafficCar(state, 90, SPAWN_MAX);
  for (let k = 0; k < 10; k++) spawnParkedCar(state, 120);
}
