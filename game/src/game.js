// One running game: builds the state, steps every system in order each frame, reacts to the
// events they raise (crimes, kills, explosions), and draws the world layer by layer.
import { STEP, CLOCK_RATE } from './config.js';
import { buildCity } from './city.js';
import { createRng } from './rng.js';
import { createCamera, followPlayer, applyWorldTransform, screenToWorld } from './camera.js';
import { createPlayer, updatePlayer, updateRespawn } from './player.js';
import { updateVehicles } from './vehicles.js';
import { driveTraffic, manageTraffic, seedTraffic, joinNearestLane } from './traffic.js';
import { updatePeds, managePeds, seedPeds, scarePeds } from './pedestrians.js';
import { updatePolice, updateCop, reportCrime } from './police.js';
import { fireWeapon } from './combat.js';
import { updateEffects } from './effects.js';
import { buildStory } from './story.js';
import { createMissionState, updateMissions } from './missions.js';
import { updateActivities, placeTokens } from './activities.js';
import { drawGround, drawGroundDecals, drawShadows, drawRaised, nearbyBuildings } from './render_world.js';
import { drawActors, drawMarkers, drawPickups, drawParticles, drawTracersAndFlashes, drawHelicopter } from './render_actors.js';
import { drawLighting, nightAmount } from './lighting.js';
import { renderCityMap } from './minimap.js';
import { createRadio } from './audio.js';

export const CITY_SEED = 20261124;

/** A fresh game: city, player at the safehouse, traffic and people already on the streets. */
export function createGame(seed = 1, options = {}) {
  const city = buildCity(CITY_SEED);
  const home = city.places.safehouse;
  const state = {
    seed, city, rng: createRng(seed), fxRng: createRng(seed * 31 + 7), frame: 0, time: 0, clock: options.clock ?? 16 * 60 + 40,
    player: createPlayer(home.x, home.y + 14), cars: [], peds: [], particles: [], skids: [], tracers: [], flashes: [], scorches: [],
    pickups: [], tokens: [], tokensTaken: new Set(), sfx: [], events: [], notices: [],
    wanted: { heat: 0, level: 0, unseen: 0, flash: 0, searching: false }, heli: null, bustTimer: 0,
    stats: { carsStolen: 0, carsSold: 0, missionsPassed: 0, kills: 0 },
    ui: { shopOpen: false, hint: null, zoomOut: false }, camera: createCamera(home.x, home.y), noSave: !!options.noSave,
    radio: createRadio(), tireSqueal: 0,
  };
  state.fire = fireWeapon;
  state.notify = (text, color = '#ffffff', time = 3) => {
    state.notices.push({ text, color, time });
    if (state.notices.length > 4) state.notices.shift();
  };
  state.story = createMissionState(buildStory(city));
  placeTokens(state);
  state.mapCanvas = options.headless ? null : renderCityMap(city);
  return state;
}

/** Fill the streets around wherever the player now stands. */
export function populate(state) {
  seedTraffic(state, 26);
  seedPeds(state, 40);
  followPlayer(state, STEP, true);
}

/** React to what happened this frame: crimes, kills, wrecks. */
function handleEvents(state) {
  for (const e of state.events) {
    if (e.type === 'pedKilled' && e.by === 'player') {
      state.stats.kills += 1;
      reportCrime(state, e.ped.kind === 'cop' ? 1.5 : e.ped.kind === 'gang' ? 0.3 : 1, e.ped.x, e.ped.y, e.ped.kind !== 'cop');
    }
    if (e.type === 'carHit' && e.car.driver === 'police') reportCrime(state, 0.6, e.car.x, e.car.y, false);
    if (e.type === 'shotFired') reportCrime(state, 0.15, e.x, e.y);
    if (e.type === 'explosion') {
      scarePeds(state, e.x, e.y, 400);
      for (const p of state.peds) if (!p.dead && Math.hypot(p.x - e.x, p.y - e.y) < 90) { p.hp = 0; p.dead = true; p.deadTime = 0; }
      for (const c of state.cars) if (c !== e.car && Math.hypot(c.x - e.x, c.y - e.y) < 90) { c.hp -= 60; if (c.hp <= 0 && !c.burning && !c.wrecked) c.burning = 1 + state.rng(); const a = Math.atan2(c.y - e.y, c.x - e.x); c.vx += Math.cos(a) * 200; c.vy += Math.sin(a) * 200; }
      const pl = state.player;
      if (!pl.car && Math.hypot(pl.x - e.x, pl.y - e.y) < 100) pl.health -= 50;
      if (e.car.hitByPlayer) reportCrime(state, 1, e.x, e.y);
    }
  }
  state.events = [];
}

/** Advance the whole world by one fixed step. */
export function stepGame(state, input, view, dt = STEP) {
  state.frame += 1;
  state.time += dt;
  state.clock = (state.clock + dt * CLOCK_RATE) % 1440;
  if (input) updatePlayer(state, input, view, dt);
  for (const car of state.cars) {
    if (car.driver === 'traffic') driveTraffic(state, car, dt);
    else if (car.driver === 'parked' || car.wrecked) { car.throttle = 0; car.steer = 0; car.handbrake = true; }
  }
  updatePolice(state, dt);
  updateVehicles(state, dt);
  updatePeds(state, dt, fireWeapon, updateCop);
  handleEvents(state);
  updateMissions(state, input, dt);
  if (input) updateActivities(state, input, dt);
  updateRespawn(state, dt);
  manageTraffic(state);
  managePeds(state);
  updateEffects(state, dt);
  for (const n of state.notices) n.time -= dt;
  state.notices = state.notices.filter((n) => n.time > 0);
  followPlayer(state, dt);
}

/** Draw the world (not the HUD) for the current state. */
export function renderWorld(ctx, state) {
  const cam = state.camera;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#8cc26b';
  ctx.fillRect(0, 0, cam.W, cam.H);
  applyWorldTransform(ctx, cam);
  const near = nearbyBuildings(state);
  drawGround(ctx, state);
  drawGroundDecals(ctx, state);
  drawShadows(ctx, state, near);
  drawMarkers(ctx, state);
  drawPickups(ctx, state);
  drawActors(ctx, state);
  drawParticles(ctx, state, 'low');
  drawTracersAndFlashes(ctx, state);
  drawRaised(ctx, state, near, nightAmount(state.clock));
  drawParticles(ctx, state, 'high');
  drawHelicopter(ctx, state);
  drawLighting(ctx, state);
}

export function makeView(state) {
  return { screenToWorld: (sx, sy) => screenToWorld(state.camera, sx, sy) };
}

export { joinNearestLane };
