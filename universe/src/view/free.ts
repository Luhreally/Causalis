// Free roam (Phase 10 M98): a camera that flies — or, among a village's people, walks — the
// way the viewer steers it: ahead, back and aside by where it looks, up and down, faster
// the higher it is (a world is crossed as quickly as a square). Pure: a step from the keys
// held and the stick pushed; the scene keeps it above its ground and out of its walls.

/** Where the free camera is and where it looks (degrees: yaw about up, pitch below level). */
export type FreeState = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  readonly pitch: number;
};

/** What the viewer asks of it now: how hard ahead, aside and up (-1 … 1 each), and whether fast. */
export type FreeInput = {
  readonly ahead: number;
  readonly aside: number;
  readonly up: number;
  readonly fast: boolean;
};

/** How it moves at a scale: its speed (units a second, at `height` above the ground), and how it walks. */
export type FreeRules = {
  /** Speed at the ground; doubled for each `height` risen above it (a flight's reach grows). */
  readonly speed: number;
  readonly height: number;
  /** Walking: kept at the eye's height over the ground, not flying (a village's people). */
  readonly walk?: { readonly eye: number };
  /** The least it keeps above the ground, flying. */
  readonly clearance: number;
  /** In space (a globe, a sky, the stars): ahead is the way it looks, not the level. */
  readonly space?: boolean;
  /** About a globe: up is away from its middle (not the scene's up), so it rises over one spot. */
  readonly round?: boolean;
  /** Its speed where it stands, when the scale knows better (a globe's: by the height above its face). */
  readonly pace?: (s: FreeState) => number;
};

/**
 * One step of free movement: `dt` seconds of the input, over ground whose height at a point
 * is `ground` (null: no ground there, as over the stars). Ahead and aside go by the way it
 * faces, level (a flight does not dive by looking down) — in space, ahead is the way it
 * looks; up goes straight up.
 */
export function freeStep(
  s: FreeState,
  input: FreeInput,
  dt: number,
  rules: FreeRules,
  ground: (x: number, z: number) => number | null,
): FreeState {
  const under = ground(s.x, s.z),
    above = under === null ? rules.height : Math.max(0, s.y - under),
    // (The higher, the faster: twice as fast each `height` risen, to a flight's reach.)
    reach = rules.walk ? 1 : Math.min(64, Math.pow(2, above / rules.height)),
    speed = (rules.pace ? rules.pace(s) : rules.speed * reach) * (input.fast ? 3 : 1) * dt,
    yaw = (s.yaw * Math.PI) / 180,
    // Ahead: the way it faces, on the level (the orbit's convention: at yaw 0 it looks along
    // -z); in space, the way it looks.
    look = rules.space ? freeLook(s.yaw, s.pitch) : { x: -Math.sin(yaw), y: 0, z: -Math.cos(yaw) },
    rx = Math.cos(yaw),
    rz = -Math.sin(yaw);
  // Up: straight up, or about a globe away from its middle.
  const r = Math.hypot(s.x, s.y, s.z) || 1,
    up = rules.walk ? 0 : input.up * speed,
    ux = rules.round ? s.x / r : 0,
    uy = rules.round ? s.y / r : 1,
    uz = rules.round ? s.z / r : 0;
  let x = s.x + (look.x * input.ahead + rx * input.aside) * speed + ux * up,
    z = s.z + (look.z * input.ahead + rz * input.aside) * speed + uz * up,
    y = s.y + uy * up + (rules.walk ? 0 : look.y * input.ahead * speed);
  const floor = ground(x, z);
  if (rules.walk && floor !== null) y = floor + rules.walk.eye;
  else if (floor !== null) y = Math.max(y, floor + rules.clearance);
  return { x, y, z, yaw: s.yaw, pitch: s.pitch };
}

/** Where the camera looks from its yaw and pitch: a unit direction (the orbit's convention). */
export function freeLook(yaw: number, pitch: number): { x: number; y: number; z: number } {
  const a = (yaw * Math.PI) / 180,
    b = (pitch * Math.PI) / 180;
  return { x: -Math.sin(a) * Math.cos(b), y: Math.sin(b), z: -Math.cos(a) * Math.cos(b) };
}

/**
 * The orbit that sees what a free camera sees, for handing back: the point its look falls
 * on (the ground plane at `groundY`, or `far` ahead if it looks above the horizon), and the
 * orbit's turn, tilt and distance to stand where the free camera stands.
 */
export function orbitOf(
  s: FreeState,
  groundY: number,
  far: number,
): { target: { x: number; y: number; z: number }; yaw: number; pitch: number; distance: number } {
  const d = freeLook(s.yaw, s.pitch),
    k = d.y < -1e-3 ? (groundY - s.y) / d.y : far,
    reach = Math.max(1e-3, Math.min(far, k)),
    target = { x: s.x + d.x * reach, y: s.y + d.y * reach, z: s.z + d.z * reach };
  // The orbit's camera stands at the target plus its distance along (sin yaw, -sin pitch, cos yaw).
  return { target, yaw: s.yaw, pitch: s.pitch, distance: reach };
}
