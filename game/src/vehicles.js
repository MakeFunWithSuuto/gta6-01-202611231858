// Every car in Port Solera: the models, arcade driving physics with drift, crashes against
// buildings and other cars, damage, fire and explosions.
import { buildingsNear, clampToWorld } from './city.js';
import { circleRectPush, clamp } from './mathutil.js';
import { emitBurst, addSkid, playSound, explodeAt, shakeCamera } from './effects.js';

export const MODELS = {
  vellora: { name: 'Vellora Sedan', length: 44, width: 21, accel: 270, top: 380, grip: 7, turn: 2.6, hp: 100, colors: ['#e8e4da', '#3a6ea5', '#b23a48', '#2e2e38', '#7fb685', '#c9b27c'] },
  kestrel: { name: 'Kestrel GT', length: 46, width: 21, accel: 400, top: 560, grip: 8, turn: 2.9, hp: 90, colors: ['#ff4f5e', '#ffd23f', '#00b8d9', '#f7f7f7', '#8a4fff'] },
  mako: { name: 'Mako Van', length: 54, width: 25, accel: 200, top: 300, grip: 6, turn: 2.1, hp: 170, colors: ['#f2f2f2', '#d9cba3', '#6c8ead'] },
  saguaro: { name: 'Saguaro Pickup', length: 50, width: 24, accel: 250, top: 400, grip: 6.5, turn: 2.4, hp: 140, colors: ['#9c4a2f', '#33576b', '#5c6b3a', '#d0d0c8'] },
  lumen: { name: 'Lumen Cab', length: 44, width: 21, accel: 260, top: 370, grip: 7, turn: 2.6, hp: 110, colors: ['#ffc93c'] },
  interceptor: { name: 'Solera PD Interceptor', length: 47, width: 22, accel: 350, top: 500, grip: 8, turn: 2.8, hp: 150, colors: ['#f4f6fa'] },
};

const CIVILIAN_MODELS = ['vellora', 'vellora', 'vellora', 'kestrel', 'mako', 'saguaro', 'lumen', 'lumen'];

let nextCarId = 1;

export function createCar(state, modelKey, x, y, angle, role = 'traffic') {
  const rng = state.rng;
  const model = MODELS[modelKey];
  return {
    id: nextCarId++, type: 'car', modelKey, model, x, y, angle, vx: 0, vy: 0,
    color: rng.pick(model.colors), hp: model.hp, driver: role, ai: { state: 'cruise', stuck: 0, reverse: 0, wait: 0 },
    throttle: 0, steer: 0, brake: false, handbrake: false, burning: 0, wrecked: false, siren: role === 'police',
    lightPhase: rng() * 6, damageSeen: 0, tag: null,
  };
}

export function randomCivilianModel(rng) {
  return rng.pick(CIVILIAN_MODELS);
}

export function carSpeed(car) {
  return Math.hypot(car.vx, car.vy);
}

/** Forward speed (negative when reversing). */
export function forwardSpeed(car) {
  return car.vx * Math.cos(car.angle) + car.vy * Math.sin(car.angle);
}

/** The two collision circles of a car (front and rear). */
export function carCircles(car) {
  const c = Math.cos(car.angle), s = Math.sin(car.angle);
  const off = car.model.length * 0.26, r = car.model.width * 0.56;
  return [{ x: car.x + c * off, y: car.y + s * off, r }, { x: car.x - c * off, y: car.y - s * off, r }];
}

/** Apply this frame's throttle, steering and handbrake to a car. */
export function driveCar(state, car, dt) {
  const m = car.model;
  if (car.wrecked) { car.throttle = 0; car.steer = 0; }
  const c = Math.cos(car.angle), s = Math.sin(car.angle);
  let fwd = car.vx * c + car.vy * s;
  let lat = -car.vx * s + car.vy * c;
  const top = car.hp < m.hp * 0.3 ? m.top * 0.7 : m.top;
  if (car.throttle > 0) fwd += car.throttle * m.accel * dt * (1 - Math.max(0, fwd) / top);
  else if (car.throttle < 0) fwd += car.throttle * (fwd > 20 ? m.accel * 2.2 : m.accel * 0.6) * dt * (fwd < -top * 0.35 ? 0 : 1);
  car.brake = car.throttle < 0 && fwd > 20;
  fwd *= Math.pow(car.throttle === 0 ? 0.55 : 0.85, dt);
  if (car.handbrake) fwd *= Math.pow(0.35, dt);
  const grip = car.handbrake ? 1.4 : m.grip;
  const slip = Math.abs(lat);
  lat *= Math.exp(-grip * dt);
  const speedFactor = clamp(Math.abs(fwd) / 120, 0, 1) * (1 - clamp((Math.abs(fwd) - 300) / 900, 0, 0.35));
  car.angle += car.steer * m.turn * speedFactor * Math.sign(fwd || 1) * dt * (car.handbrake ? 1.35 : 1);
  const c2 = Math.cos(car.angle), s2 = Math.sin(car.angle);
  car.vx = c2 * fwd - s2 * lat;
  car.vy = s2 * fwd + c2 * lat;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  clampToWorld(car);
  if (slip > 90 || (car.handbrake && Math.abs(fwd) > 120)) {
    for (const w of [-1, 1]) addSkid(state, car.x - c2 * m.length * 0.32 - s2 * w * m.width * 0.4, car.y - s2 * m.length * 0.32 + c2 * w * m.width * 0.4, car.angle);
    if (car.driver === 'player' && state.frame % 3 === 0) emitBurst(state, 'dust', car.x - c2 * m.length * 0.45, car.y - s2 * m.length * 0.45, 1);
    if (car.driver === 'player') state.tireSqueal = Math.min(1, slip / 260 + (car.handbrake ? 0.5 : 0));
  }
}

function damageCar(state, car, amount, by = null) {
  if (car.wrecked) return;
  car.hp -= amount;
  if (by === 'player') car.hitByPlayer = true;
  if (car.hp <= 0 && car.burning === 0) car.burning = 3.2;
}

export { damageCar };

/** Bounce a car off the buildings it overlaps. */
function collideWithBuildings(state, car) {
  const near = buildingsNear(state.city, car.x - 40, car.y - 40, 80, 80);
  for (const circle of carCircles(car)) {
    for (const b of near) {
      const hit = circleRectPush(circle.x, circle.y, circle.r, b);
      if (!hit) continue;
      car.x += hit.nx * hit.depth;
      car.y += hit.ny * hit.depth;
      circle.x += hit.nx * hit.depth;
      circle.y += hit.ny * hit.depth;
      const vn = car.vx * hit.nx + car.vy * hit.ny;
      if (vn < 0) {
        car.vx -= 1.35 * vn * hit.nx;
        car.vy -= 1.35 * vn * hit.ny;
        car.vx *= 0.8;
        car.vy *= 0.8;
        if (-vn > 110) {
          damageCar(state, car, (-vn - 90) * 0.12);
          emitBurst(state, 'spark', circle.x - hit.nx * circle.r, circle.y - hit.ny * circle.r, 8);
          playSound(state, 'crash', car.x, car.y, Math.min(1, -vn / 400));
          if (car.driver === 'player') shakeCamera(state, Math.min(10, -vn / 50));
        }
      }
    }
  }
}

/** Separate overlapping cars and trade momentum between them. */
function collideCars(state) {
  const cars = state.cars;
  for (let i = 0; i < cars.length; i++) {
    const a = cars[i];
    for (let j = i + 1; j < cars.length; j++) {
      const b = cars[j];
      if (Math.abs(a.x - b.x) > 60 || Math.abs(a.y - b.y) > 60) continue;
      for (const ca of carCircles(a)) for (const cb of carCircles(b)) {
        const dx = cb.x - ca.x, dy = cb.y - ca.y;
        const d = Math.hypot(dx, dy), min = ca.r + cb.r;
        if (d >= min || d < 0.001) continue;
        const nx = dx / d, ny = dy / d, push = (min - d) / 2;
        a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
        const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rel < 0) {
          const ma = a.model.hp, mb = b.model.hp;
          const imp = (-1.3 * rel) / (1 / ma + 1 / mb);
          a.vx -= (imp / ma) * nx; a.vy -= (imp / ma) * ny;
          b.vx += (imp / mb) * nx; b.vy += (imp / mb) * ny;
          if (-rel > 90) {
            const dmg = (-rel - 70) * 0.09;
            const culprit = a.driver === 'player' || b.driver === 'player' ? 'player' : null;
            damageCar(state, a, dmg, culprit);
            damageCar(state, b, dmg, culprit);
            emitBurst(state, 'spark', (ca.x + cb.x) / 2, (ca.y + cb.y) / 2, 10);
            playSound(state, 'crash', a.x, a.y, Math.min(1, -rel / 350));
            if (culprit) {
              shakeCamera(state, Math.min(9, -rel / 60));
              state.events.push({ type: 'carHit', car: a.driver === 'player' ? b : a });
            }
          }
        }
      }
    }
  }
}

/** Fires burn down and wrecks explode, hurting everything nearby. */
function updateFires(state, car, dt) {
  if (car.wrecked) {
    if (state.frame % 12 === 0) emitBurst(state, 'smoke', car.x, car.y, 1);
    return;
  }
  if (car.hp < car.model.hp * 0.35 && state.frame % 6 === 0) emitBurst(state, 'smoke', car.x + Math.cos(car.angle) * 14, car.y + Math.sin(car.angle) * 14, 1);
  if (car.burning > 0) {
    car.burning -= dt;
    if (state.frame % 2 === 0) emitBurst(state, 'fire', car.x + Math.cos(car.angle) * 12, car.y + Math.sin(car.angle) * 12, 1);
    if (car.burning <= 0) {
      car.wrecked = true;
      car.color = '#2b2522';
      car.siren = false;
      explodeAt(state, car.x, car.y);
      state.events.push({ type: 'explosion', x: car.x, y: car.y, car });
    }
  }
}

/** Step all cars: physics, crashes and fires. Drivers set throttle/steer before this runs. */
export function updateVehicles(state, dt) {
  for (const car of state.cars) {
    driveCar(state, car, dt);
    collideWithBuildings(state, car);
    updateFires(state, car, dt);
    car.lightPhase += dt;
  }
  collideCars(state);
}
