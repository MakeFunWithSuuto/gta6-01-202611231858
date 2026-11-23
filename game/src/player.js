// The player: walking and sprinting with mouse aim, stealing and driving cars, getting out,
// and what happens when they are wasted or busted.
import { PLAYER_FOOT } from './config.js';
import { isHeld, wasPressed } from './input.js';
import { moveOnFoot, createPed, attachToPavement, scarePeds } from './pedestrians.js';
import { carSpeed, forwardSpeed } from './vehicles.js';
import { updatePlayerWeapons, cycleWeapon, WEAPON_ORDER } from './combat.js';
import { reportCrime, clearWanted } from './police.js';
import { playSound } from './effects.js';
import { dist2 } from './mathutil.js';

export function createPlayer(x, y) {
  return {
    type: 'player', x, y, angle: 0, vx: 0, vy: 0, car: null, health: PLAYER_FOOT.health, armor: 0,
    money: 250, weapon: 'fists', weapons: [], ammo: {}, dead: false, fireCooldown: 0, hurtFlash: 0,
    walkPhase: 0, moving: false, muzzle: 0, shirt: '#fdfdfd', pants: '#2d3a4a', skin: '#c68642', hat: '#ff7a59', kind: 'player',
  };
}

/** Pull the driver out (if any) and take the wheel. */
export function enterCar(state, car) {
  const pl = state.player;
  if (car.driver === 'traffic' || car.driver === 'police') {
    const victim = createPed(state, car.x - Math.sin(car.angle) * 24, car.y + Math.cos(car.angle) * 24, car.driver === 'police' ? 'cop' : 'civ');
    if (victim.kind === 'civ') { victim.state = 'flee'; victim.fear = 5; victim.fleeFrom = { x: car.x, y: car.y }; attachToPavement(victim); victim.state = 'flee'; }
    state.peds.push(victim);
    reportCrime(state, car.driver === 'police' ? 2 : 0.7, car.x, car.y);
    state.stats.carsStolen += 1;
    playSound(state, 'door', car.x, car.y);
    scarePeds(state, car.x, car.y, 120);
  } else playSound(state, 'door', car.x, car.y);
  car.driver = 'player';
  pl.car = car;
  state.events.push({ type: 'enteredCar', car });
  state.notify(car.model.name, '#ffffff', 2);
}

export function exitCar(state) {
  const pl = state.player, car = pl.car;
  const s = Math.sin(car.angle), c = Math.cos(car.angle);
  pl.x = car.x - s * -24;
  pl.y = car.y + c * -24;
  car.driver = 'parked';
  car.throttle = 0;
  car.handbrake = true;
  pl.car = null;
  playSound(state, 'door', car.x, car.y);
}

function nearestEnterableCar(state) {
  const pl = state.player;
  let best = null, bd = 56 * 56;
  for (const car of state.cars) {
    if (car.wrecked) continue;
    const d = dist2(car.x, car.y, pl.x, pl.y);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

function controlOnFoot(state, input, view, dt) {
  const pl = state.player;
  let mx = 0, my = 0;
  if (isHeld(input, 'KeyW', 'ArrowUp')) my -= 1;
  if (isHeld(input, 'KeyS', 'ArrowDown')) my += 1;
  if (isHeld(input, 'KeyA', 'ArrowLeft')) mx -= 1;
  if (isHeld(input, 'KeyD', 'ArrowRight')) mx += 1;
  const aim = view.screenToWorld(input.mouseX, input.mouseY);
  const aimAngle = Math.atan2(aim.y - pl.y, aim.x - pl.x);
  const sprint = isHeld(input, 'ShiftLeft', 'ShiftRight');
  if (mx || my) {
    moveOnFoot(state, pl, Math.atan2(my, mx), sprint ? PLAYER_FOOT.sprint : PLAYER_FOOT.walk, dt);
  } else { pl.moving = false; pl.vx = 0; pl.vy = 0; }
  pl.angle = aimAngle;
  pl.aim = aim;
  if (wasPressed(input, 'KeyQ') || input.wheel < 0) cycleWeapon(pl, -1);
  if (wasPressed(input, 'KeyE') || input.wheel > 0) cycleWeapon(pl, 1);
  WEAPON_ORDER.forEach((k, i) => { if (wasPressed(input, `Digit${i + 1}`) && (k === 'fists' || pl.weapons.includes(k))) pl.weapon = k; });
  updatePlayerWeapons(state, input, aimAngle, dt, input.mouseDown);
  if (wasPressed(input, 'KeyF', 'Enter')) {
    const car = nearestEnterableCar(state);
    if (car) enterCar(state, car);
  }
}

function controlInCar(state, input) {
  const pl = state.player, car = pl.car;
  let throttle = 0, steer = 0;
  if (isHeld(input, 'KeyW', 'ArrowUp')) throttle += 1;
  if (isHeld(input, 'KeyS', 'ArrowDown')) throttle -= 1;
  if (isHeld(input, 'KeyA', 'ArrowLeft')) steer -= 1;
  if (isHeld(input, 'KeyD', 'ArrowRight')) steer += 1;
  car.throttle = throttle;
  car.steer += (steer - car.steer) * 0.25;
  car.handbrake = isHeld(input, 'Space');
  if (wasPressed(input, 'KeyH')) playSound(state, 'horn', car.x, car.y);
  if (wasPressed(input, 'KeyF', 'Enter') && carSpeed(car) < 90) exitCar(state);
  pl.x = car.x; pl.y = car.y; pl.vx = car.vx; pl.vy = car.vy; pl.angle = car.angle;
}

/** Read the controls and move the player for a frame. */
export function updatePlayer(state, input, view, dt) {
  const pl = state.player;
  pl.hurtFlash = Math.max(0, pl.hurtFlash - dt);
  if (pl.dead) return;
  if (pl.car) {
    if (pl.car.wrecked || pl.car.burning > 0 && pl.car.burning < 1.2) { if (pl.car.burning > 0) exitCar(state); else if (pl.car.wrecked) { pl.health -= 60; exitCar(state); } }
    if (pl.car) controlInCar(state, input);
  } else controlOnFoot(state, input, view, dt);
  if (pl.car && pl.car.burning > 0 && state.frame % 30 === 0) pl.health -= 4;
  if (pl.health <= 0) failPlayer(state, 'wasted');
  if (state.bustTimer > 1.3 || (pl.car && state.wanted.level > 0 && state.wanted.level <= 2 && carSpeed(pl.car) < 8 && state.peds.some((p) => p.kind === 'cop' && !p.dead && dist2(p.x, p.y, pl.x, pl.y) < 40 * 40))) failPlayer(state, 'busted');
  state.bustTimer = Math.max(0, state.bustTimer - dt * 0.5);
  void forwardSpeed;
}

/** Wasted or busted: show the banner, then wake at the hospital or precinct for a fee. */
export function failPlayer(state, how) {
  const pl = state.player;
  if (pl.dead) return;
  pl.dead = true;
  pl.failKind = how;
  pl.failTimer = 3.2;
  if (pl.car) { pl.car.driver = 'parked'; pl.car = null; }
  playSound(state, how === 'wasted' ? 'wasted' : 'busted');
  state.events.push({ type: 'playerFailed', how });
}

export function updateRespawn(state, dt) {
  const pl = state.player;
  if (!pl.dead) return;
  pl.failTimer -= dt;
  if (pl.failTimer > 0) return;
  const place = pl.failKind === 'wasted' ? state.city.places.hospital : state.city.places.precinct;
  const fee = pl.failKind === 'wasted' ? Math.min(pl.money, 100 + Math.floor(pl.money * 0.05)) : Math.min(pl.money, 150);
  pl.money -= fee;
  if (pl.failKind === 'busted') { pl.weapons = []; pl.ammo = {}; pl.weapon = 'fists'; }
  pl.x = place.x; pl.y = place.y - 30;
  pl.health = 100; pl.armor = 0; pl.dead = false;
  state.bustTimer = 0;
  clearWanted(state);
  state.notify(pl.failKind === 'wasted' ? `Hospital bill: -$${fee}` : `Bail and confiscated weapons: -$${fee}`, '#ffd166', 4);
}
