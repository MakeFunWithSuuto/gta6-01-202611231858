// The mission runner: start markers, step-by-step objectives, timers, pass and fail,
// with the story's dialogue played as subtitles.
import { isHeld, wasPressed } from './input.js';
import { createCar } from './vehicles.js';
import { createPed } from './pedestrians.js';
import { reportCrime } from './police.js';
import { playSound } from './effects.js';
import { dist2 } from './mathutil.js';
import { CAST } from './story.js';
import { saveGame } from './save.js';

export function createMissionState(missions, index = 0) {
  return { missions, index, active: null, banner: null, subtitle: null };
}

/** The mission waiting for the player to walk into its marker, if any. */
export function nextMission(state) {
  const m = state.story;
  return m.active ? null : m.missions[m.index] || null;
}

/** Where the HUD arrow and minimap blip should point right now. */
export function currentTarget(state) {
  const a = state.story.active;
  if (!a) {
    const next = nextMission(state);
    return next ? { x: next.start.x, y: next.start.y, kind: 'start', label: next.title } : null;
  }
  const step = a.mission.steps[a.step];
  if (!step) return null;
  if (step.type === 'steal') return a.car ? { x: a.car.x, y: a.car.y, kind: 'car' } : null;
  if ((step.type === 'goto' || step.type === 'hold') && step.needMissionCar && a.car && state.player.car !== a.car) return { x: a.car.x, y: a.car.y, kind: 'car' };
  if (step.type === 'goto' || step.type === 'hold' || step.type === 'pickup') return { x: step.x, y: step.y, r: step.r || 26, kind: step.type };
  if (step.type === 'kill') {
    const alive = a.targets.filter((p) => !p.dead);
    return alive.length ? { x: alive[0].x, y: alive[0].y, kind: 'enemy', all: alive } : null;
  }
  if (step.type === 'lose' && step.needMissionCar && a.car && state.player.car !== a.car) return { x: a.car.x, y: a.car.y, kind: 'car' };
  return null;
}

/** The objective line shown on the HUD (with ~highlighted~ words). */
export function objectiveText(state) {
  const a = state.story.active;
  if (!a) {
    const next = nextMission(state);
    return next ? `Meet ~${CAST[next.giver].name}~ to start "${next.title}"` : 'Port Solera is yours. Free roam.';
  }
  const step = a.mission.steps[a.step];
  if (!step) return '';
  if ((step.type === 'goto' || step.type === 'lose' || step.type === 'hold') && step.needMissionCar && a.car && state.player.car !== a.car) return 'Get back in the ~mission vehicle~';
  if (step.type === 'kill') return `${step.text} (${a.targets.filter((p) => p.dead).length}/${a.targets.length})`;
  if (step.type === 'hold') return `${step.text} — ${Math.ceil(step.seconds - a.held)}s`;
  return step.text || '';
}

function startMission(state, mission) {
  const s = state.story;
  s.active = { mission, step: -1, car: null, targets: [], timer: null, held: 0, lineIndex: 0, lineTime: 0 };
  s.banner = { title: mission.title, sub: 'Mission start', time: 3, color: '#ffd166' };
  playSound(state, 'missionStart');
  advance(state);
}

function cleanup(state) {
  const a = state.story.active;
  for (const p of a.targets) p.tag = null;
  if (a.car) a.car.tag = null;
  state.story.subtitle = null;
}

function failMission(state, reason) {
  const s = state.story;
  if (!s.active) return;
  s.banner = { title: 'Mission failed', sub: reason, time: 4, color: '#ff5a4f' };
  cleanup(state);
  s.active = null;
  playSound(state, 'fail');
}

function passMission(state) {
  const s = state.story, m = s.active.mission, pl = state.player;
  pl.money += m.reward;
  if (m.unlock && !pl.weapons.includes(m.unlock)) { pl.weapons.push(m.unlock); pl.ammo[m.unlock] = (pl.ammo[m.unlock] || 0) + 60; }
  s.banner = { title: 'Mission passed!', sub: `${m.title}   +$${m.reward.toLocaleString('en-US')}`, time: 5, color: '#3dd6a0' };
  cleanup(state);
  s.active = null;
  s.index += 1;
  state.stats.missionsPassed = s.index;
  playSound(state, 'pass');
  saveGame(state, true);
}

/** Move on to the next step and set it up. */
function advance(state) {
  const a = state.story.active;
  a.step += 1;
  a.timer = null;
  a.held = 0;
  const step = a.mission.steps[a.step];
  if (!step) { passMission(state); return; }
  if (step.time) a.timer = step.time;
  if (step.type === 'talk') { a.lineIndex = 0; a.lineTime = 0; }
  if (step.type === 'steal') {
    const car = createCar(state, step.model, step.at.x, step.at.y, step.at.angle, 'parked');
    car.handbrake = true;
    car.tag = 'mission';
    state.cars.push(car);
    a.car = car;
  }
  if (step.type === 'kill') {
    a.targets = step.at.map(([x, y]) => {
      const p = createPed(state, x, y, 'gang');
      p.tag = 'mission';
      p.weapon = state.rng.chance(0.4) ? 'smg' : 'pistol';
      state.peds.push(p);
      return p;
    });
  }
  if (step.type === 'wanted') { reportCrime(state, step.level - state.wanted.heat, state.player.x, state.player.y, false); advance(state); return; }
  if (step.type === 'give') {
    const pl = state.player;
    if (!pl.weapons.includes(step.weapon)) pl.weapons.push(step.weapon);
    pl.ammo[step.weapon] = (pl.ammo[step.weapon] || 0) + step.ammo;
    pl.weapon = step.weapon;
    state.notify(`Got a pistol (${step.ammo} rounds). Q / E to switch.`, '#ffd166', 4);
    advance(state);
  }
}

function updateTalk(state, step, input, dt) {
  const a = state.story.active;
  a.lineTime += dt;
  const line = step.lines[a.lineIndex];
  state.story.subtitle = { who: CAST[line[0]].name, color: CAST[line[0]].color, text: line[1] };
  const skip = input && wasPressed(input, 'Space', 'Enter');
  if (a.lineTime > 1.6 + line[1].length * 0.045 || (skip && a.lineTime > 0.25)) {
    a.lineIndex += 1;
    a.lineTime = 0;
    if (a.lineIndex >= step.lines.length) { state.story.subtitle = null; advance(state); }
  }
}

function spawnHoldGulls(state, step) {
  const a = state.story.active;
  if (a.spawned) return;
  a.spawned = true;
  for (let k = 0; k < 4; k++) {
    const ang = (k / 4) * Math.PI * 2 + 0.4;
    const p = createPed(state, step.x + Math.cos(ang) * 260, step.y + Math.sin(ang) * 200, 'gang');
    p.hostile = true;
    p.tag = 'mission';
    a.targets.push(p);
    state.peds.push(p);
  }
}

/** Step the active mission (or start one when the player walks into its marker). */
export function updateMissions(state, input, dt) {
  const s = state.story, pl = state.player;
  if (s.banner) { s.banner.time -= dt; if (s.banner.time <= 0) s.banner = null; }
  if (!s.active) {
    const next = nextMission(state);
    if (next && !pl.dead && !pl.car && state.wanted.level === 0 && dist2(pl.x, pl.y, next.start.x, next.start.y) < 26 * 26) startMission(state, next);
    return;
  }
  const a = s.active;
  const step = a.mission.steps[a.step];
  if (!step) return;
  if (pl.dead) { failMission(state, pl.failKind === 'wasted' ? 'You were wasted.' : 'You were busted.'); return; }
  if (a.car && a.car.wrecked) { failMission(state, 'The mission vehicle was destroyed.'); return; }
  if (a.timer !== null) {
    a.timer -= dt;
    if (a.timer <= 0) { failMission(state, 'Out of time.'); return; }
  }
  const inMissionCar = !a.car || pl.car === a.car;
  switch (step.type) {
    case 'talk': updateTalk(state, step, input, dt); break;
    case 'steal': if (pl.car === a.car) advance(state); break;
    case 'goto':
      if ((!step.needMissionCar || inMissionCar) && dist2(pl.x, pl.y, step.x, step.y) < step.r * step.r) advance(state);
      break;
    case 'kill': if (a.targets.every((p) => p.dead)) advance(state); else for (const p of a.targets) if (dist2(p.x, p.y, pl.x, pl.y) < 380 * 380) p.hostile = true; break;
    case 'pickup':
      if (dist2(pl.x, pl.y, step.x, step.y) < 30 * 30) { playSound(state, 'pickup'); state.notify(`Picked up the ${step.item}.`, '#ffd166'); advance(state); }
      break;
    case 'lose': if (state.wanted.level === 0 && inMissionCar) advance(state); break;
    case 'hold':
      if (step.spawnGulls) spawnHoldGulls(state, step);
      if (dist2(pl.x, pl.y, step.x, step.y) < step.r * step.r) a.held += dt;
      if (a.held >= step.seconds) advance(state);
      break;
    default: advance(state);
  }
  void isHeld;
}

/** Jump straight to a step of a mission (used to stage screenshot scenes). */
export function stageMission(state, missionIndex, stepIndex) {
  const s = state.story;
  s.index = missionIndex;
  startMission(state, s.missions[missionIndex]);
  while (s.active && s.active.step < stepIndex) advance(state);
  s.banner = null;
}
