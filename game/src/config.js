// Shared tuning numbers for Port Solera: city layout, physics, police and the clock.

/** Distance between two parallel road centre lines. */
export const BLOCK = 520;
/** Asphalt width of every street. */
export const ROAD = 92;
/** Width of the pavement ring around each block. */
export const SIDEWALK = 20;
/** Land blocks across and down; the sea lies east of the last column. */
export const GRID_X = 9;
export const GRID_Y = 9;
export const WORLD_W = BLOCK * (GRID_X + 2);
export const WORLD_H = BLOCK * GRID_Y;
/** Lane centre distance from the road centre line (right-hand traffic). */
export const LANE = 21;
/** Distance from the road centre line to a car parked at the kerb. */
export const KERB = 43;

/** Fixed simulation step in seconds. */
export const STEP = 1 / 60;

/** How strongly a height lifts a roof away from the view centre (fake perspective). */
export const PARALLAX = 0.0011;
/** Sun direction used for ground shadows, per unit of building height. */
export const SUN = { x: 0.32, y: 0.22 };

export const PLAYER_FOOT = { walk: 120, sprint: 210, radius: 9, health: 100 };

/** Real seconds per in-game minute. */
export const CLOCK_RATE = 1;

/** Police cars allowed on the street for each wanted level. */
export const POLICE_CARS_BY_STARS = [0, 1, 2, 3, 5, 6];
/** Seconds out of sight before one star fades, per star level. */
export const LOSE_STAR_SECONDS = [0, 7, 9, 11, 13, 15];
export const POLICE_SIGHT = 620;

/** Population kept alive around the player. */
export const TRAFFIC_TARGET = 34;
export const PEDESTRIAN_TARGET = 46;
export const SPAWN_MIN = 700;
export const SPAWN_MAX = 1150;
export const DESPAWN = 1500;

export const SAVE_KEY = 'port-solera.save.v1';
