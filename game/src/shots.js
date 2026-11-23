// Screenshot scenes behind ?shot=<name>. Each one stages a real moment of the game with the
// game's own systems (story steps, police, traffic, combat) and plays it forward a few seconds
// with an autopilot, so the same seed always gives the same frame.
import { STEP, BLOCK } from './config.js';
import { populate, stepGame } from './game.js';
import { stageMission } from './missions.js';
import { createCar } from './vehicles.js';
import { placeOnLane, followLanes, DIRS } from './traffic.js';
import { reportCrime } from './police.js';
import { fireWeapon } from './combat.js';
import { followPlayer, worldToScreen } from './camera.js';
import { nearestPed } from './pedestrians.js';
import { clamp } from './mathutil.js';

function seatPlayer(state, car) {
  car.driver = 'player';
  state.player.car = car;
  state.player.x = car.x; state.player.y = car.y;
}

/** Drive the player's car along the lanes toward a point, as a player would. */
function autodrive(state, tx, ty, cruise) {
  const car = state.player.car;
  followLanes(car, (i, j, exits) => {
    let best = exits[0], bd = Infinity;
    for (const e of exits) { const d = DIRS[e]; const nd = Math.hypot((i + d.x) * BLOCK - tx, (j + d.y) * BLOCK - ty); if (nd < bd) { bd = nd; best = e; } }
    return best;
  }, cruise, STEP);
  state.player.x = car.x; state.player.y = car.y;
}

function run(state, seconds, each) {
  for (let t = 0; t < seconds; t += STEP) {
    if (each) each();
    stepGame(state, null, null);
  }
}

/** Cover: the Coral Job getaway, four stars, patrol cars and the helicopter on the van's tail. */
function chaseScene(state) {
  state.clock = 17 * 60 + 35;
  stageMission(state, 4, 6);
  const van = state.story.active.car;
  placeOnLane(van, 3, 4, 0, 120);
  seatPlayer(state, van);
  van.vx = 330; van.color = '#f2f2f2';
  populate(state);
  reportCrime(state, 4, van.x, van.y, false);
  state.player.weapons = ['pistol']; state.player.ammo = { pistol: 36 }; state.player.weapon = 'pistol';
  for (const [i, along] of [[3, 20], [2, 380], [2, 300]]) {
    const cop = createCar(state, 'interceptor', 0, 0, 0, 'police');
    placeOnLane(cop, i, 4, 0, along);
    cop.vx = 360;
    state.cars.push(cop);
  }
  run(state, 2.6, () => autodrive(state, 7 * BLOCK, 4 * BLOCK, 360));
  van.hp = van.model.hp * 0.6;
  followPlayer(state, STEP, true);
  state.camera.x -= 60;
  state.camera.zoom *= 0.82;
  state.wanted.flash = 0;
  return { screen: 'play' };
}

/** Title screen over Coral Strip at sunset. */
function titleScene(state) {
  state.clock = 18 * 60 + 20;
  const p = state.player;
  p.x = 8 * BLOCK + 240; p.y = 3 * BLOCK + 60;
  populate(state);
  run(state, 2);
  state.camera.x = 9 * BLOCK - 60; state.camera.y = 3 * BLOCK + 220; state.camera.zoom = 0.85;
  return { screen: 'title', save: { savedAt: Date.UTC(2026, 10, 23), missionIndex: 2, money: 3420 } };
}

/** Gull Season: an SMG fight among the Ironwharf containers. */
function shootoutScene(state) {
  state.clock = 13 * 60 + 10;
  const pl = state.player;
  pl.weapons = ['pistol', 'smg']; pl.ammo = { pistol: 40, smg: 174 }; pl.weapon = 'smg'; pl.money = 2350; pl.health = 72; pl.armor = 40;
  stageMission(state, 2, 2);
  const targets = state.story.active.targets;
  pl.x = targets[2].x + 40; pl.y = targets[2].y + 52;
  populate(state);
  const wreck = createCar(state, 'saguaro', pl.x + 150, pl.y + 80, 0.4, 'parked');
  wreck.hp = 5; wreck.burning = 0.9;
  state.cars.push(wreck);
  for (const t of targets) t.hostile = true;
  let aimAt = null;
  run(state, 2.2, () => {
    const target = nearestPed(state, pl.x, pl.y, 500, (q) => q.kind === 'gang');
    if (!target) return;
    aimAt = target;
    pl.angle = Math.atan2(target.y - pl.y, target.x - pl.x);
    pl.fireCooldown = Math.max(0, pl.fireCooldown - STEP);
    if (pl.fireCooldown <= 0) { pl.fireCooldown = 0.09; pl.ammo.smg -= 1; fireWeapon(state, pl, pl.angle, 'smg'); }
    pl.muzzle = Math.max(0, pl.muzzle - STEP);
  });
  state.wanted.heat = 2; state.wanted.level = 2;
  pl.health = 72; pl.hurtFlash = 0;
  state.wanted.flash = 0;
  followPlayer(state, STEP, true);
  state.camera.x = (pl.x + targets[2].x) / 2; state.camera.y = (pl.y + targets[2].y) / 2 - 40;
  const aim = aimAt ? worldToScreen(state.camera, aimAt.x, aimAt.y) : { x: 700, y: 400 };
  return { screen: 'play', mouse: { mouseX: clamp(aim.x, 0, state.camera.W), mouseY: aim.y } };
}

/** Express Delivery: a timed night run down the coast in a Kestrel GT. */
function nightScene(state) {
  state.clock = 21 * 60 + 40;
  const pl = state.player;
  pl.money = 4780;
  pl.weapons = ['pistol']; pl.ammo = { pistol: 31 }; pl.weapon = 'pistol';
  stageMission(state, 3, 2);
  state.story.active.timer = 47;
  const car = createCar(state, 'kestrel', 0, 0, 0, 'player');
  car.color = '#ff4f5e';
  placeOnLane(car, 9, 7, 3, 60);
  car.vy = -420;
  state.cars.push(car);
  seatPlayer(state, car);
  populate(state);
  run(state, 2.4, () => autodrive(state, 9 * BLOCK, 2 * BLOCK, 470));
  state.notify('Radio: Solera Wave 98.1', '#c77dff', 2);
  followPlayer(state, STEP, true);
  return { screen: 'play' };
}

/** Stage the named scene into `state`; returns what to draw over the world. */
export function stageShot(name, state) {
  if (name === 'title') return titleScene(state);
  if (name === 'shootout') return shootoutScene(state);
  if (name === 'night') return nightScene(state);
  if (name === 'map') { populate(state); return { screen: 'map' }; }
  return chaseScene(state);
}
