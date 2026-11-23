// The chase camera: follows the player with a look-ahead, pulls back with speed, shakes on
// impacts, and converts between screen pixels and world positions.
import { carSpeed } from './vehicles.js';
import { clamp, lerp } from './mathutil.js';

export function createCamera(x, y) {
  return { x, y, zoom: 1.1, shake: 0, shakeX: 0, shakeY: 0, W: 1280, H: 720 };
}

/** Ease the camera toward where the player is heading. */
export function followPlayer(state, dt, snap = false) {
  const cam = state.camera, pl = state.player;
  const body = pl.car || pl;
  const speed = pl.car ? carSpeed(pl.car) : 0;
  const lead = pl.car ? 0.55 : 0.18;
  const tx = body.x + (body.vx || 0) * lead, ty = body.y + (body.vy || 0) * lead;
  const scale = Math.min(cam.W / 1280, cam.H / 720);
  const tz = (pl.car ? clamp(1.0 - speed / 1100, 0.62, 1.0) : 1.18) * scale * (state.ui.zoomOut ? 0.6 : 1);
  const k = snap ? 1 : 1 - Math.pow(0.02, dt);
  cam.x = lerp(cam.x, tx, k);
  cam.y = lerp(cam.y, ty, k);
  cam.zoom = lerp(cam.zoom, tz, snap ? 1 : 1 - Math.pow(0.25, dt));
  const r = state.fxRng;
  cam.shakeX = (r() - 0.5) * cam.shake * 2;
  cam.shakeY = (r() - 0.5) * cam.shake * 2;
}

/** Set the canvas transform so drawing happens in world units. */
export function applyWorldTransform(ctx, cam) {
  ctx.setTransform(cam.zoom, 0, 0, cam.zoom, cam.W / 2 - cam.x * cam.zoom + cam.shakeX, cam.H / 2 - cam.y * cam.zoom + cam.shakeY);
}

export function screenToWorld(cam, sx, sy) {
  return { x: (sx - cam.W / 2 - cam.shakeX) / cam.zoom + cam.x, y: (sy - cam.H / 2 - cam.shakeY) / cam.zoom + cam.y };
}

export function worldToScreen(cam, wx, wy) {
  return { x: (wx - cam.x) * cam.zoom + cam.W / 2, y: (wy - cam.y) * cam.zoom + cam.H / 2 };
}

/** The world rectangle the screen shows, with a margin. */
export function visibleRect(cam, margin = 0) {
  const w = cam.W / cam.zoom, h = cam.H / cam.zoom;
  return { x: cam.x - w / 2 - margin, y: cam.y - h / 2 - margin, w: w + margin * 2, h: h + margin * 2 };
}
