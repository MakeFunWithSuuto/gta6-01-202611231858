// Saving and loading progress in the browser's localStorage: story progress, money, weapons,
// collected sun tokens, stats and where the player stands.
import { SAVE_KEY } from './config.js';

export function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveGame(state, auto = false) {
  if (state.noSave) return;
  const pl = state.player;
  const data = {
    version: 1, savedAt: Date.now(), missionIndex: state.story.index, money: pl.money, weapons: pl.weapons, ammo: pl.ammo,
    tokens: [...state.tokensTaken], stats: state.stats, clock: state.clock, x: pl.car ? pl.car.x : pl.x, y: pl.car ? pl.car.y : pl.y,
  };
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    state.notify(auto ? 'Autosaved' : 'Game saved', '#3dd6a0', 2);
  } catch {
    state.notify('Could not save in this browser', '#ff5a4f', 2);
  }
}

/** Put a saved game's progress into a fresh state. */
export function applySave(state, data) {
  const pl = state.player;
  state.story.index = data.missionIndex || 0;
  pl.money = data.money ?? pl.money;
  pl.weapons = data.weapons || [];
  pl.ammo = data.ammo || {};
  state.tokensTaken = new Set(data.tokens || []);
  Object.assign(state.stats, data.stats || {});
  state.clock = data.clock ?? state.clock;
  const home = state.city.places.safehouse;
  pl.x = home.x; pl.y = home.y + 10;
}

export function describeSave(data) {
  if (!data) return null;
  const when = new Date(data.savedAt);
  return `Mission ${Math.min(5, (data.missionIndex || 0) + 1)}/5  ·  $${(data.money || 0).toLocaleString('en-US')}  ·  ${when.toLocaleDateString('en-US')}`;
}
