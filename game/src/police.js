// The wanted level and Solera PD's response: crimes raise heat, patrol cars hunt the player
// along the streets and ram, officers get out to arrest or shoot, a helicopter joins at three
// stars, and stars fade once the player stays out of sight.
import { POLICE_CARS_BY_STARS, LOSE_STAR_SECONDS, POLICE_SIGHT, BLOCK, GRID_X, GRID_Y } from './config.js';
import { createCar, forwardSpeed, carSpeed } from './vehicles.js';
import { followLanes, placeOnLane, exitsAt, lanePoint, DIRS, joinNearestLane } from './traffic.js';
import { createPed, moveOnFoot, attachToPavement } from './pedestrians.js';
import { angleDiff, clamp, dist2 } from './mathutil.js';
import { playSound } from './effects.js';

/** Raise the heat for a crime; witnesses matter only for the small ones. */
export function reportCrime(state, amount, x, y, needsWitness = true) {
  const w = state.wanted;
  if (needsWitness) {
    const seen = state.peds.some((p) => !p.dead && dist2(p.x, p.y, x, y) < 280 * 280) || policeNear(state, x, y, POLICE_SIGHT);
    if (!seen) return;
  }
  const before = w.level;
  w.heat = Math.min(5.2, w.heat + amount);
  w.level = clamp(Math.ceil(w.heat - 0.05), 0, 5);
  w.unseen = 0;
  if (w.level > before) { w.flash = 1.5; playSound(state, 'wanted'); }
}

export function clearWanted(state) {
  state.wanted.heat = 0;
  state.wanted.level = 0;
  state.wanted.unseen = 0;
}

function policeNear(state, x, y, r) {
  return state.cars.some((c) => c.driver === 'police' && dist2(c.x, c.y, x, y) < r * r) || state.peds.some((p) => p.kind === 'cop' && !p.dead && dist2(p.x, p.y, x, y) < r * r) || (state.heli && dist2(state.heli.x, state.heli.y, x, y) < r * r);
}

/** Greedy route choice: at each junction take the exit that heads most toward the target. */
function towards(tx, ty) {
  return (i, j, exits) => {
    let best = exits[0], bd = Infinity;
    for (const e of exits) {
      const d = DIRS[e];
      const nd = dist2((i + d.x) * BLOCK, (j + d.y) * BLOCK, tx, ty);
      if (nd < bd) { bd = nd; best = e; }
    }
    return best;
  };
}

function spawnPoliceCar(state) {
  const p = state.player, rng = state.rng;
  for (let t = 0; t < 16; t++) {
    const i = clamp(Math.round(p.x / BLOCK) + rng.pick([-2, -1, 1, 2]), 0, GRID_X);
    const j = clamp(Math.round(p.y / BLOCK) + rng.pick([-2, -1, 1, 2]), 0, GRID_Y);
    const dir = rng.pick(exitsAt(i, j));
    const lp = lanePoint(i, j, dir);
    if (dist2(lp.x, lp.y, p.x, p.y) < 520 * 520) continue;
    const car = createCar(state, 'interceptor', 0, 0, 0, 'police');
    placeOnLane(car, i, j, dir, 40);
    state.cars.push(car);
    return car;
  }
  return null;
}

/** Drive one police car for a frame. */
function drivePolice(state, car, dt) {
  const pl = state.player, ai = car.ai, w = state.wanted;
  if (w.level === 0) {
    car.siren = false;
    followLanes(car, (i, j, exits) => state.rng.pick(exits), 140, dt);
    return;
  }
  car.siren = true;
  const target = pl.car || pl;
  const d2 = dist2(car.x, car.y, target.x, target.y);
  if (ai.reverse > 0) {
    ai.reverse -= dt;
    car.throttle = -1;
    car.steer = ai.reverseSteer;
    if (ai.reverse <= 0) joinNearestLane(car);
    return;
  }
  if (d2 > 280 * 280) {
    if (ai.ti === undefined) joinNearestLane(car);
    followLanes(car, towards(target.x, target.y), 380, dt);
  } else {
    const lead = pl.car ? 0.35 : 0;
    const want = Math.atan2(target.y + (target.vy || 0) * lead - car.y, target.x + (target.vx || 0) * lead - car.x);
    car.steer = clamp(angleDiff(car.angle, want) * 3, -1, 1);
    const close = d2 < 90 * 90;
    car.throttle = !pl.car && close ? -1 : 1;
    if (!pl.car && close && Math.abs(forwardSpeed(car)) < 30 && !ai.deployed) deployOfficers(state, car);
  }
  if (car.throttle > 0 && carSpeed(car) < 15) ai.stuck += dt; else ai.stuck = 0;
  if (ai.stuck > 1.1) { ai.stuck = 0; ai.reverse = 0.9; ai.reverseSteer = state.rng.chance(0.5) ? 1 : -1; }
}

function deployOfficers(state, car) {
  car.ai.deployed = true;
  car.driver = 'parked';
  for (const side of [-1, 1]) {
    const c = Math.cos(car.angle), s = Math.sin(car.angle);
    const cop = createPed(state, car.x - s * side * 22, car.y + c * side * 22, 'cop');
    state.peds.push(cop);
  }
  playSound(state, 'door', car.x, car.y);
}

/** One officer on foot: close in to arrest at one star, shoot from two. */
export function updateCop(state, cop, dt) {
  const pl = state.player, w = state.wanted;
  if (w.level === 0 || pl.dead) {
    cop.moving = false;
    if (!cop.path) attachToPavement(cop);
    return;
  }
  const target = pl.car || pl;
  const a = Math.atan2(target.y - cop.y, target.x - cop.x);
  const d2 = dist2(cop.x, cop.y, target.x, target.y);
  const shoots = w.level >= 2;
  if (!shoots || d2 > 210 * 210) moveOnFoot(state, cop, a, 160, dt);
  else { cop.angle = a; cop.moving = false; }
  if (shoots) {
    cop.cooldown -= dt;
    if (cop.cooldown <= 0 && d2 < 330 * 330) {
      cop.cooldown = state.rng.range(0.7, 1.4) - w.level * 0.08;
      state.fire(state, cop, a + state.rng.range(-0.2, 0.2), 'pistol');
    }
  }
  if (!pl.car && d2 < 26 * 26 && w.level <= 2) state.bustTimer += dt;
}

/** The helicopter circles over the player from three stars and sees for the police. */
function updateHelicopter(state, dt) {
  const w = state.wanted, pl = state.player;
  if (w.level < 3) {
    if (state.heli) { state.heli.leave = true; state.heli.y -= 260 * dt; if (dist2(state.heli.x, state.heli.y, pl.x, pl.y) > 1600 * 1600) state.heli = null; }
    return;
  }
  if (!state.heli || state.heli.leave) state.heli = { x: pl.x - 900, y: pl.y - 700, angle: 0, rotor: 0, orbit: 0, cooldown: 2, leave: false };
  const h = state.heli;
  h.orbit += dt * 0.6;
  const tx = pl.x + Math.cos(h.orbit) * 140, ty = pl.y + Math.sin(h.orbit) * 110;
  const dx = tx - h.x, dy = ty - h.y;
  const d = Math.hypot(dx, dy);
  const sp = Math.min(d * 1.6, 420);
  if (d > 1) { h.x += (dx / d) * sp * dt; h.y += (dy / d) * sp * dt; }
  h.angle += angleDiff(h.angle, Math.atan2(pl.y - h.y, pl.x - h.x)) * dt * 2;
  h.rotor += dt * 40;
  if (w.level >= 4) {
    h.cooldown -= dt;
    if (h.cooldown <= 0) { h.cooldown = 0.12; if (state.frame % 40 < 8) state.fire(state, h, Math.atan2(pl.y - h.y, pl.x - h.x) + state.rng.range(-0.25, 0.25), 'smg'); }
  }
}

/** Advance the whole police response for a frame. */
export function updatePolice(state, dt) {
  const w = state.wanted, pl = state.player;
  w.flash = Math.max(0, w.flash - dt);
  const target = pl.car || pl;
  const cars = state.cars.filter((c) => c.driver === 'police');
  if (cars.length < POLICE_CARS_BY_STARS[w.level] && state.frame % 50 === 0) spawnPoliceCar(state);
  for (const car of cars) drivePolice(state, car, dt);
  updateHelicopter(state, dt);
  if (w.level > 0) {
    if (policeNear(state, target.x, target.y, POLICE_SIGHT)) w.unseen = 0;
    else w.unseen += dt;
    w.searching = w.unseen > 1.5;
    if (w.unseen > LOSE_STAR_SECONDS[w.level]) {
      w.level -= 1;
      w.heat = w.level;
      w.unseen = 0;
      if (w.level === 0) state.notify('You lost the police.', '#9be7ff');
    }
  } else w.searching = false;
  // Officers far behind give up.
  state.cars = state.cars.filter((c) => !(c.driver === 'police' && w.level === 0 && dist2(c.x, c.y, pl.x, pl.y) > 1300 * 1300));
  state.peds = state.peds.filter((p) => !(p.kind === 'cop' && w.level === 0 && dist2(p.x, p.y, pl.x, pl.y) > 900 * 900));
}
