// Things to do between missions: sell stolen cars at the chop shop, lose heat at the respray,
// buy guns and armour at Sunline Arms, save at the safehouse, and hunt sun tokens and cash.
import { wasPressed } from './input.js';
import { clearWanted } from './police.js';
import { playSound, emitBurst } from './effects.js';
import { dist2 } from './mathutil.js';
import { saveGame } from './save.js';
import { blockRect } from './city.js';
import { GRID_X, GRID_Y } from './config.js';

export const SHOP_ITEMS = [
  { key: 'pistol', label: 'Pistol + 48 rounds', price: 300, weapon: 'pistol', ammo: 48 },
  { key: 'smg', label: 'SMG + 120 rounds', price: 900, weapon: 'smg', ammo: 120 },
  { key: 'shotgun', label: 'Shotgun + 24 shells', price: 1400, weapon: 'shotgun', ammo: 24 },
  { key: 'armor', label: 'Body armour', price: 250 },
  { key: 'ammo', label: 'Refill owned ammo', price: 150 },
];

const CAR_VALUE = { vellora: 450, kestrel: 1400, mako: 600, saguaro: 700, lumen: 380, interceptor: 1800 };
const PLACE_RADIUS = 34;

/** Twenty hidden sun tokens, one per chosen block corner, the same for every seed of the city. */
export function placeTokens(state) {
  const rng = state.rng;
  state.tokens = [];
  for (let k = 0; k < 20; k++) {
    const r = blockRect(rng.int(0, GRID_X - 1), rng.int(0, GRID_Y - 1));
    state.tokens.push({ id: k, x: r.x + 10 + rng.pick([0, 1]) * (r.w - 20), y: r.y + 30 + rng() * (r.h - 60) });
  }
}

function sellCar(state) {
  const pl = state.player, car = pl.car;
  if (!car || car.tag === 'mission' || car.modelKey === 'interceptor' && state.wanted.level > 0) return;
  const value = Math.round((CAR_VALUE[car.modelKey] || 400) * Math.max(0.2, car.hp / car.model.hp) / 10) * 10;
  pl.money += value;
  pl.x = car.x; pl.y = car.y + 30;
  pl.car = null;
  state.cars = state.cars.filter((c) => c !== car);
  state.stats.carsSold += 1;
  state.notify(`Nena paid $${value} for the ${car.model.name}`, '#f5a623', 3);
  playSound(state, 'cash');
}

function respray(state) {
  const pl = state.player, car = pl.car;
  if (!car || state.wanted.level === 0) return;
  if (pl.money < 100) { state.notify('A respray costs $100', '#ff5a4f', 2); return; }
  pl.money -= 100;
  car.color = state.rng.pick(car.model.colors.concat(['#14213d', '#e63946', '#2a9d8f', '#f1faee']));
  car.hp = car.model.hp;
  clearWanted(state);
  state.notify('Fresh paint. The police lost your description.', '#ff6fb5', 3);
  playSound(state, 'spray');
}

/** Buy an item from Sunline Arms; returns true when bought. */
export function buyItem(state, item) {
  const pl = state.player;
  if (pl.money < item.price) { state.notify('Not enough cash', '#ff5a4f', 2); playSound(state, 'click'); return false; }
  pl.money -= item.price;
  if (item.weapon) {
    if (!pl.weapons.includes(item.weapon)) pl.weapons.push(item.weapon);
    pl.ammo[item.weapon] = (pl.ammo[item.weapon] || 0) + item.ammo;
    pl.weapon = item.weapon;
  } else if (item.key === 'armor') pl.armor = 100;
  else for (const w of pl.weapons) pl.ammo[w] = (pl.ammo[w] || 0) + 60;
  playSound(state, 'cash');
  return true;
}

function updateShop(state, input) {
  const ui = state.ui;
  if (!ui.shopOpen) return;
  SHOP_ITEMS.forEach((item, i) => { if (wasPressed(input, `Digit${i + 1}`)) buyItem(state, item); });
}

/** Cash, health and armour lying in the street, and sun tokens. */
function updatePickups(state, dt) {
  const pl = state.player;
  for (const p of state.pickups) {
    p.t += dt;
    if (pl.dead || dist2(p.x, p.y, pl.x, pl.y) > 22 * 22) continue;
    p.taken = true;
    if (p.kind === 'cash') { pl.money += p.amount; playSound(state, 'cash'); }
    if (p.kind === 'health') { pl.health = 100; playSound(state, 'pickup'); }
    if (p.kind === 'armor') { pl.armor = 100; playSound(state, 'pickup'); }
    emitBurst(state, 'cash', p.x, p.y, 6);
  }
  state.pickups = state.pickups.filter((p) => !p.taken && p.t < 60);
  for (const t of state.tokens) {
    if (state.tokensTaken.has(t.id) || dist2(t.x, t.y, pl.x, pl.y) > 24 * 24) continue;
    state.tokensTaken.add(t.id);
    pl.money += 100;
    emitBurst(state, 'cash', t.x, t.y, 14);
    playSound(state, 'token');
    state.notify(`Sun token ${state.tokensTaken.size}/20  +$100`, '#ffd166', 3);
  }
}

/** Places react when the player stops in them: shop, respray, chop shop, safehouse. */
export function updateActivities(state, input, dt) {
  const pl = state.player, places = state.city.places;
  updatePickups(state, dt);
  const near = (p, r = PLACE_RADIUS) => dist2(p.x, p.y, pl.x, pl.y) < r * r;
  state.ui.shopOpen = !pl.car && !pl.dead && near(places.arms);
  updateShop(state, input);
  if (pl.dead) return;
  if (pl.car && near(places.respray, 60) && state.wanted.level > 0 && !state.story.active) respray(state);
  if (pl.car && near(places.chopshop, 70) && pl.car.tag !== 'mission' && wasPressed(input, 'KeyG')) sellCar(state);
  state.ui.hint = null;
  if (pl.car && near(places.chopshop, 70) && pl.car.tag !== 'mission') state.ui.hint = 'Press G to sell this car to Nena';
  if (!pl.car && near(places.safehouse)) {
    state.ui.hint = 'Press G to save your game';
    if (wasPressed(input, 'KeyG')) { saveGame(state); pl.health = 100; }
  }
  if (!pl.car && near(places.hospital) && pl.health < 100) { pl.health = 100; state.notify('Patched up for free. Lucky you.', '#ffffff', 2); }
}
