// Entry point: sizes the canvas, runs the fixed-step loop, and switches between the title
// screen, play, pause, the map and the controls card. ?shot=<scene> stages a screenshot instead.
import { STEP } from './config.js';
import { createInput, endInputFrame, wasPressed } from './input.js';
import { createGame, populate, stepGame, renderWorld, makeView } from './game.js';
import { drawHud } from './hud.js';
import { drawFullMap } from './minimap.js';
import { drawTitle, drawPause, navigateMenu, TITLE_ITEMS, PAUSE_ITEMS } from './menus.js';
import { readSave, applySave, saveGame } from './save.js';
import { unlockAudio, playQueued, updateAudio, nextStation } from './audio.js';
import { stageShot } from './shots.js';
import { followPlayer } from './camera.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(window.location.search);

function resize(state) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  if (state) { state.camera.W = canvas.width; state.camera.H = canvas.height; }
}

function runShot(name) {
  const state = createGame(Number(params.get('seed') || 1), { noSave: true });
  resize(state);
  const scene = stageShot(name, state);
  renderWorld(ctx, state);
  if (scene.screen === 'title') drawTitle(ctx, state, { cursor: 0 }, scene.save, null);
  else if (scene.screen === 'map') drawFullMap(ctx, state);
  else drawHud(ctx, state, scene.mouse);
  document.body.dataset.ready = 'yes';
}

function runGame() {
  const input = createInput(canvas);
  let save = readSave();
  let state = createGame(1);
  resize(state);
  state.player.x += 0;
  populate(state);
  let screen = 'title';
  const titleMenu = { cursor: save ? 0 : 1, showControls: false };
  const pauseMenu = { cursor: 0, showControls: false };
  window.addEventListener('resize', () => resize(state));
  const gesture = () => unlockAudio();
  window.addEventListener('keydown', gesture);
  window.addEventListener('mousedown', gesture);

  function startNew(fromSave) {
    state = createGame((Date.now() % 100000) + 1);
    resize(state);
    if (fromSave) applySave(state, fromSave);
    populate(state);
    screen = 'play';
    if (!fromSave) state.notify('Walk into the yellow marker to meet Nena.', '#ffd166', 6);
    state.notify('Press Esc for the menu, M for the map.', '#ffffff', 6);
  }

  function updateTitle() {
    state.time += STEP;
    state.camera.x += 30 * STEP;
    state.camera.y += 12 * STEP;
    state.clock = 17 * 60 + 50;
    if (titleMenu.showControls) { if (wasPressed(input, 'Escape', 'Enter') || input.clicked) titleMenu.showControls = false; return; }
    const r = navigateMenu(titleMenu, TITLE_ITEMS, input, (i) => i !== 'Continue' || !!save);
    if (r.moved) state.sfx.push({ name: 'click', x: null, y: null, volume: 1 });
    if (r.chosen === 'Continue') startNew(save);
    else if (r.chosen === 'New Game') startNew(null);
    else if (r.chosen === 'Controls') titleMenu.showControls = true;
  }

  function updatePause() {
    if (pauseMenu.showControls) { if (wasPressed(input, 'Escape', 'Enter') || input.clicked) pauseMenu.showControls = false; return; }
    if (wasPressed(input, 'Escape')) { screen = 'play'; state.paused = false; return; }
    const r = navigateMenu(pauseMenu, PAUSE_ITEMS, input);
    if (r.chosen === 'Resume') { screen = 'play'; state.paused = false; }
    else if (r.chosen === 'Map') screen = 'map';
    else if (r.chosen === 'Save Game') { if (state.story.active) state.notify('Finish the mission before saving.', '#ff5a4f'); else { saveGame(state); save = readSave(); } }
    else if (r.chosen === 'Controls') pauseMenu.showControls = true;
    else if (r.chosen === 'Quit to Title') { screen = 'title'; state.paused = false; save = readSave(); titleMenu.cursor = save ? 0 : 1; }
  }

  function updatePlay() {
    if (wasPressed(input, 'Escape', 'KeyP')) { screen = 'pause'; state.paused = true; pauseMenu.cursor = 0; return; }
    if (wasPressed(input, 'KeyM')) { screen = 'map'; return; }
    if (wasPressed(input, 'KeyR') && state.player.car) nextStation(state);
    stepGame(state, input, makeView(state));
  }

  let last = performance.now(), acc = 0;
  function frame(now) {
    acc += Math.min(0.1, (now - last) / 1000);
    last = now;
    while (acc >= STEP) {
      acc -= STEP;
      if (screen === 'title') updateTitle();
      else if (screen === 'pause') updatePause();
      else if (screen === 'map') { if (wasPressed(input, 'KeyM', 'Escape')) screen = 'play'; }
      else updatePlay();
      endInputFrame(input);
    }
    renderWorld(ctx, state);
    if (screen === 'title') drawTitle(ctx, state, titleMenu, save, input);
    else if (screen === 'map') drawFullMap(ctx, state);
    else {
      drawHud(ctx, state, input);
      if (screen === 'pause') drawPause(ctx, state, pauseMenu, input);
    }
    updateAudio(state, screen === 'title');
    playQueued(state);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  void followPlayer;
}

if (params.has('shot')) runShot(params.get('shot'));
else runGame();
