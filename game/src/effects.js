// Visual effects that live in the world: particles, skid marks, bullet tracers, screen shake,
// and the sound requests other systems queue for the audio module.

const MAX_PARTICLES = 700;
const MAX_SKIDS = 500;

/** Queue a sound for the audio mixer; position makes distant sounds quieter. */
export function playSound(state, name, x = null, y = null, volume = 1) {
  state.sfx.push({ name, x, y, volume });
}

export function shakeCamera(state, amount) {
  state.camera.shake = Math.min(18, state.camera.shake + amount);
}

function add(state, p) {
  if (state.particles.length >= MAX_PARTICLES) state.particles.shift();
  state.particles.push(p);
}

/** Burst of particles of one kind: smoke, spark, fire, debris, splash, cash, dust, blood. */
export function emitBurst(state, kind, x, y, count, spread = 1, baseAngle = null) {
  const rng = state.fxRng;
  for (let i = 0; i < count; i++) {
    const a = baseAngle === null ? rng() * Math.PI * 2 : baseAngle + (rng() - 0.5) * spread;
    const speed = { smoke: 30, spark: 260, fire: 70, debris: 180, splash: 90, cash: 60, dust: 40, hit: 120 }[kind] * (0.4 + rng());
    add(state, {
      kind, x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
      life: 0, maxLife: { smoke: 1.6, spark: 0.35, fire: 0.7, debris: 1.1, splash: 0.6, cash: 1.2, dust: 0.7, hit: 0.3 }[kind] * (0.6 + rng() * 0.8),
      size: { smoke: 10, spark: 2, fire: 9, debris: 3, splash: 4, cash: 5, dust: 6, hit: 3 }[kind] * (0.6 + rng() * 0.8),
      spin: rng() * 6,
    });
  }
}

export function addSkid(state, x, y, angle) {
  if (state.skids.length >= MAX_SKIDS) state.skids.shift();
  state.skids.push({ x, y, angle, age: 0 });
}

export function addTracer(state, x1, y1, x2, y2, color = '#fff6c2') {
  state.tracers.push({ x1, y1, x2, y2, life: 0.08, color });
}

export function explodeAt(state, x, y) {
  emitBurst(state, 'fire', x, y, 40);
  emitBurst(state, 'smoke', x, y, 30);
  emitBurst(state, 'debris', x, y, 24);
  emitBurst(state, 'spark', x, y, 30);
  state.flashes.push({ x, y, r: 160, life: 0.35 });
  state.scorches.push({ x, y, r: 42 });
  if (state.scorches.length > 40) state.scorches.shift();
  shakeCamera(state, 14);
  playSound(state, 'explosion', x, y, 1.2);
}

/** Age and move every particle, tracer and flash. */
export function updateEffects(state, dt) {
  for (const p of state.particles) {
    p.life += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const drag = p.kind === 'smoke' ? 0.97 : p.kind === 'fire' ? 0.93 : 0.9;
    p.vx *= drag;
    p.vy *= drag;
    if (p.kind === 'smoke') p.size += dt * 14;
  }
  state.particles = state.particles.filter((p) => p.life < p.maxLife);
  for (const t of state.tracers) t.life -= dt;
  state.tracers = state.tracers.filter((t) => t.life > 0);
  for (const f of state.flashes) f.life -= dt;
  state.flashes = state.flashes.filter((f) => f.life > 0);
  for (const s of state.skids) s.age += dt;
  state.camera.shake *= Math.pow(0.02, dt);
}
