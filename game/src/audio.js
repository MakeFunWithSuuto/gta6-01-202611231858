// All sound is synthesised with Web Audio: gunfire, crashes, explosions, horns, the car engine,
// police sirens, tyre squeal, and three procedural radio stations.

let ac = null, master = null, noiseBuffer = null;
const loops = {};

/** Start audio on the first user gesture (browsers require one). */
export function unlockAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ac = new AC();
  master = ac.createGain();
  master.gain.value = 0.55;
  master.connect(ac.destination);
  noiseBuffer = ac.createBuffer(1, ac.sampleRate * 1.5, ac.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  let seed = 7;
  for (let i = 0; i < data.length; i++) { seed = (seed * 16807) % 2147483647; data[i] = (seed / 2147483647) * 2 - 1; }
  startLoops();
}

function env(gainNode, t, attack, peak, decay) {
  gainNode.gain.setValueAtTime(0.0001, t);
  gainNode.gain.exponentialRampToValueAtTime(peak, t + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function noiseHit(vol, decay, filterFreq, type = 'lowpass') {
  const t = ac.currentTime;
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer;
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = filterFreq;
  const g = ac.createGain(); env(g, t, 0.004, vol, decay);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.5, decay + 0.1);
}

function tone(freq, vol, decay, type = 'sine', slide = 0, when = 0) {
  const t = ac.currentTime + when;
  const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + decay);
  const g = ac.createGain(); env(g, t, 0.01, vol, decay);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + decay + 0.05);
}

const SOUNDS = {
  pistol: (v) => { noiseHit(0.7 * v, 0.18, 2400); tone(160, 0.3 * v, 0.1, 'square', 0.4); },
  smg: (v) => { noiseHit(0.45 * v, 0.09, 3000); tone(200, 0.15 * v, 0.05, 'square', 0.5); },
  shotgun: (v) => { noiseHit(0.9 * v, 0.4, 1400); tone(90, 0.4 * v, 0.2, 'sawtooth', 0.3); },
  punch: (v) => noiseHit(0.4 * v, 0.07, 700),
  crash: (v) => { noiseHit(0.8 * v, 0.35, 900); tone(70, 0.4 * v, 0.25, 'triangle', 0.5); },
  thud: (v) => tone(90, 0.5 * v, 0.15, 'sine', 0.5),
  explosion: (v) => { noiseHit(1.0 * v, 1.4, 500); tone(55, 0.8 * v, 1.0, 'sine', 0.3); },
  horn: (v) => { tone(392, 0.25 * v, 0.45, 'square'); tone(494, 0.2 * v, 0.45, 'square'); },
  door: (v) => { noiseHit(0.3 * v, 0.08, 1200); tone(120, 0.2 * v, 0.08, 'square', 0.6); },
  click: () => tone(1200, 0.1, 0.03, 'square'),
  cash: () => { tone(1318, 0.2, 0.12, 'triangle'); tone(1760, 0.2, 0.2, 'triangle', 1, 0.07); },
  token: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.18, 0.18, 'triangle', 1, i * 0.06)),
  pickup: () => { tone(660, 0.2, 0.1, 'triangle'); tone(990, 0.2, 0.15, 'triangle', 1, 0.08); },
  wanted: () => { tone(880, 0.2, 0.15, 'square'); tone(660, 0.2, 0.2, 'square', 1, 0.15); },
  scream: (v) => tone(900, 0.12 * v, 0.4, 'sawtooth', 0.6),
  spray: () => noiseHit(0.5, 1.2, 5000, 'highpass'),
  missionStart: () => [392, 523, 659].forEach((f, i) => tone(f, 0.22, 0.3, 'sawtooth', 1, i * 0.12)),
  pass: () => [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, 0.22, 0.35, 'square', 1, i * 0.11)),
  fail: () => [392, 311, 233].forEach((f, i) => tone(f, 0.25, 0.4, 'sawtooth', 1, i * 0.2)),
  wasted: () => { tone(220, 0.35, 1.8, 'sawtooth', 0.25); noiseHit(0.4, 1.5, 400); },
  busted: () => [659, 523, 392, 330].forEach((f, i) => tone(f, 0.25, 0.3, 'square', 1, i * 0.15)),
};

/** Play the sounds the game queued this frame, quieter the further they are from the listener. */
export function playQueued(state) {
  const queue = state.sfx;
  state.sfx = [];
  if (!ac || state.muted) return;
  const pl = state.player.car || state.player;
  for (const s of queue.slice(0, 12)) {
    let v = s.volume;
    if (s.x !== null) v *= Math.max(0, 1 - Math.hypot(s.x - pl.x, s.y - pl.y) / 900);
    if (v > 0.02 && SOUNDS[s.name]) SOUNDS[s.name](v);
  }
}

function startLoops() {
  const engine = ac.createOscillator(); engine.type = 'sawtooth';
  const engine2 = ac.createOscillator(); engine2.type = 'square';
  const ef = ac.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 500;
  const eg = ac.createGain(); eg.gain.value = 0;
  engine.connect(ef); engine2.connect(ef); ef.connect(eg).connect(master);
  engine.start(); engine2.start();
  loops.engine = { engine, engine2, gain: eg, filter: ef };
  const siren = ac.createOscillator(); siren.type = 'square';
  const sg = ac.createGain(); sg.gain.value = 0;
  const sf = ac.createBiquadFilter(); sf.type = 'bandpass'; sf.frequency.value = 1000;
  siren.connect(sf).connect(sg).connect(master); siren.start();
  loops.siren = { osc: siren, gain: sg };
  const sq = ac.createBufferSource(); sq.buffer = noiseBuffer; sq.loop = true;
  const qf = ac.createBiquadFilter(); qf.type = 'bandpass'; qf.frequency.value = 2200; qf.Q.value = 8;
  const qg = ac.createGain(); qg.gain.value = 0;
  sq.connect(qf).connect(qg).connect(master); sq.start();
  loops.squeal = { gain: qg };
}

// Radio: each station is a chord loop, a bass line and a lead pattern.
const STATIONS = [
  { name: 'Solera Wave 98.1', bpm: 104, chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], lead: [0, 2, 4, 7, 4, 2, 9, 7], wave: 'sawtooth' },
  { name: 'Palm Static FM', bpm: 88, chords: [[50, 53, 57], [55, 58, 62], [48, 52, 55], [53, 57, 60]], lead: [7, 5, 3, 0, 3, 5, 10, 7], wave: 'triangle' },
  { name: 'Radio Off', bpm: 0 },
];

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

function scheduleRadio(state) {
  const r = state.radio;
  const st = STATIONS[r.station];
  if (!st.bpm) return;
  const beat = 60 / st.bpm / 2;
  if (r.nextTime < ac.currentTime) r.nextTime = ac.currentTime + 0.05;
  while (r.nextTime < ac.currentTime + 0.25) {
    const step = r.step % 32;
    const chord = st.chords[Math.floor(step / 8) % st.chords.length];
    const t = r.nextTime - ac.currentTime;
    if (step % 8 === 0) chord.forEach((n) => tone(midi(n), 0.045, beat * 7, st.wave, 1, t));
    if (step % 2 === 0) tone(midi(chord[0] - 24), 0.12, beat * 1.6, 'triangle', 1, t);
    if (step % 4 === 2) noiseHit(0.06, 0.05, 8000, 'highpass');
    if (step % 8 === 4) noiseHit(0.12, 0.12, 1800);
    if (step % 2 === 1 || step % 3 === 0) tone(midi(chord[0] + 12 + st.lead[step % 8]), 0.05, beat * 0.9, 'square', 1, t);
    r.step += 1;
    r.nextTime += beat;
  }
}

/** Keep the engine, siren, squeal and radio in step with the game. */
export function updateAudio(state, onTitle) {
  if (!ac) return;
  const pl = state.player;
  const car = pl.car;
  const muted = state.muted || state.paused;
  const now = ac.currentTime;
  const { engine, engine2, gain, filter } = loops.engine;
  if (car && !muted) {
    const sp = Math.hypot(car.vx, car.vy);
    const gearRev = (sp % 140) / 140;
    const f = 45 + sp * 0.12 + gearRev * 40 + (car.throttle > 0 ? 12 : 0);
    engine.frequency.setTargetAtTime(f, now, 0.05);
    engine2.frequency.setTargetAtTime(f * 0.5, now, 0.05);
    filter.frequency.setTargetAtTime(300 + sp * 2, now, 0.1);
    gain.gain.setTargetAtTime(0.11, now, 0.1);
  } else gain.gain.setTargetAtTime(0, now, 0.1);
  let sirenVol = 0;
  for (const c of state.cars) if (c.siren) sirenVol = Math.max(sirenVol, 1 - Math.hypot(c.x - pl.x, c.y - pl.y) / 900);
  loops.siren.osc.frequency.setTargetAtTime(Math.sin(now * 5) > 0 ? 960 : 720, now, 0.04);
  loops.siren.gain.gain.setTargetAtTime(muted ? 0 : Math.max(0, sirenVol) * 0.07, now, 0.1);
  loops.squeal.gain.gain.setTargetAtTime(muted ? 0 : (state.tireSqueal || 0) * 0.12, now, 0.05);
  state.tireSqueal = Math.max(0, (state.tireSqueal || 0) - 0.08);
  if (!muted && (car || onTitle)) scheduleRadio(state);
}

export function nextStation(state) {
  state.radio.station = (state.radio.station + 1) % STATIONS.length;
  state.radio.name = STATIONS[state.radio.station].name;
  state.notify(`Radio: ${state.radio.name}`, '#c77dff', 2);
}

export function createRadio() {
  return { station: 0, name: STATIONS[0].name, step: 0, nextTime: 0 };
}
