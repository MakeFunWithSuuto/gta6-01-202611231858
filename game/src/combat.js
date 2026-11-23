// Weapons and shooting: hitscan bullets against buildings, people and cars, fists, and the
// player's arsenal with ammo.
import { buildingsNear } from './city.js';
import { rayRect, rayCircle } from './mathutil.js';
import { addTracer, emitBurst, playSound, shakeCamera } from './effects.js';
import { hurtPed, scarePeds } from './pedestrians.js';
import { damageCar, carCircles } from './vehicles.js';

export const WEAPONS = {
  fists: { name: 'Fists', damage: 12, range: 26, rate: 0.4, spread: 0, pellets: 1, sound: 'punch', ammo: false },
  pistol: { name: 'Pistol', damage: 22, range: 520, rate: 0.28, spread: 0.04, pellets: 1, sound: 'pistol', ammo: true },
  smg: { name: 'SMG', damage: 14, range: 480, rate: 0.085, spread: 0.09, pellets: 1, sound: 'smg', ammo: true },
  shotgun: { name: 'Shotgun', damage: 16, range: 300, rate: 0.85, spread: 0.32, pellets: 7, sound: 'shotgun', ammo: true },
};

export const WEAPON_ORDER = ['fists', 'pistol', 'smg', 'shotgun'];

/** Trace one bullet from a shooter and apply what it hits. */
function traceBullet(state, shooter, angle, weapon) {
  const dx = Math.cos(angle), dy = Math.sin(angle);
  const ox = shooter.x + dx * 12, oy = shooter.y + dy * 12;
  let best = weapon.range, hit = null;
  const box = { x: Math.min(ox, ox + dx * best) - 10, y: Math.min(oy, oy + dy * best) - 10 };
  for (const b of buildingsNear(state.city, box.x, box.y, Math.abs(dx * best) + 20, Math.abs(dy * best) + 20)) {
    const t = rayRect(ox, oy, dx, dy, b);
    if (t < best) { best = t; hit = { kind: 'wall' }; }
  }
  for (const p of state.peds) {
    if (p.dead || p === shooter) continue;
    const t = rayCircle(ox, oy, dx, dy, p.x, p.y, 9);
    if (t < best) { best = t; hit = { kind: 'ped', target: p }; }
  }
  const pl = state.player;
  if (shooter !== pl && !pl.car && !pl.dead) {
    const t = rayCircle(ox, oy, dx, dy, pl.x, pl.y, 9);
    if (t < best) { best = t; hit = { kind: 'player' }; }
  }
  for (const c of state.cars) {
    if (c === shooter.car) continue;
    for (const circle of carCircles(c)) {
      const t = rayCircle(ox, oy, dx, dy, circle.x, circle.y, circle.r);
      if (t < best) { best = t; hit = { kind: 'car', target: c }; }
    }
  }
  const ex = ox + dx * best, ey = oy + dy * best;
  addTracer(state, ox, oy, ex, ey, shooter === pl ? '#fff3b0' : '#ffb3a0');
  const by = shooter === pl ? 'player' : shooter.kind;
  if (!hit) return;
  if (hit.kind === 'wall') emitBurst(state, 'spark', ex, ey, 3);
  else if (hit.kind === 'ped') hurtPed(state, hit.target, weapon.damage, by, shooter.x, shooter.y);
  else if (hit.kind === 'car') {
    damageCar(state, hit.target, weapon.damage * 0.6, by);
    emitBurst(state, 'spark', ex, ey, 4);
    if (hit.target === pl.car) pl.health -= weapon.damage * 0.25;
  } else if (hit.kind === 'player') {
    const absorbed = Math.min(pl.armor, weapon.damage * 0.6);
    pl.armor -= absorbed;
    pl.health -= weapon.damage - absorbed;
    pl.hurtFlash = 0.3;
    emitBurst(state, 'hit', pl.x, pl.y, 3);
  }
}

/** Fire a weapon from any shooter (player, gang member, officer) along an angle. */
export function fireWeapon(state, shooter, angle, weaponKey) {
  const weapon = WEAPONS[weaponKey];
  if (weaponKey === 'fists') { punch(state, shooter, angle); return; }
  for (let i = 0; i < weapon.pellets; i++) traceBullet(state, shooter, angle + (state.rng() - 0.5) * weapon.spread * 2, weapon);
  state.flashes.push({ x: shooter.x + Math.cos(angle) * 16, y: shooter.y + Math.sin(angle) * 16, r: 40, life: 0.05 });
  shooter.muzzle = 0.06;
  playSound(state, weapon.sound, shooter.x, shooter.y, shooter === state.player ? 1 : 0.7);
  scarePeds(state, shooter.x, shooter.y, 260);
  if (shooter === state.player) {
    shakeCamera(state, weaponKey === 'shotgun' ? 5 : 1.5);
    state.events.push({ type: 'shotFired', x: shooter.x, y: shooter.y });
  }
}

function punch(state, shooter, angle) {
  const reach = WEAPONS.fists.range;
  const hx = shooter.x + Math.cos(angle) * reach, hy = shooter.y + Math.sin(angle) * reach;
  shooter.muzzle = 0.12;
  for (const p of state.peds) {
    if (p.dead || p === shooter) continue;
    if (Math.hypot(p.x - hx, p.y - hy) < 16) {
      hurtPed(state, p, WEAPONS.fists.damage, shooter === state.player ? 'player' : shooter.kind, shooter.x, shooter.y);
      playSound(state, 'punch', p.x, p.y, 0.8);
      return;
    }
  }
}

/** The player's trigger: rate of fire, ammo, weapon switching with keys and wheel. */
export function updatePlayerWeapons(state, input, aimAngle, dt, firing) {
  const pl = state.player;
  pl.fireCooldown = Math.max(0, pl.fireCooldown - dt);
  pl.muzzle = Math.max(0, (pl.muzzle || 0) - dt);
  if (!firing || pl.fireCooldown > 0) return;
  const key = pl.weapon;
  const w = WEAPONS[key];
  if (w.ammo) {
    if ((pl.ammo[key] || 0) <= 0) { playSound(state, 'click'); pl.fireCooldown = 0.3; return; }
    pl.ammo[key] -= 1;
  }
  pl.fireCooldown = w.rate;
  fireWeapon(state, pl, aimAngle, key);
}

/** Next owned weapon in the cycle (step +1 or -1). */
export function cycleWeapon(pl, step) {
  const owned = WEAPON_ORDER.filter((k) => k === 'fists' || pl.weapons.includes(k));
  const i = owned.indexOf(pl.weapon);
  pl.weapon = owned[(i + step + owned.length) % owned.length];
}
