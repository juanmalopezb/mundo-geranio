/**
 * Mundo de juego en coordenadas lógicas 800x600. Este es el borde superior
 * transitable que se ve en fondo_geranio.jfif; la superficie continúa hasta
 * el borde inferior del lienzo. Se comparte para que servidor y cliente
 * apliquen exactamente la misma geometría.
 */
export const WORLD_WIDTH = 800;
export const WORLD_HEIGHT = 600;

const LEAF_CONTOUR: ReadonlyArray<readonly [number, number]> = [
  [0, 315], [80, 296], [160, 273], [240, 242], [320, 203],
  [400, 196], [480, 200], [560, 208], [640, 218], [720, 234],
  [800, 252], [800, WORLD_HEIGHT], [0, WORLD_HEIGHT],
];

export interface MotionBody {
  x: number;
  y: number;
  jumpHeight: number;
}

export interface MovementInput {
  x: number;
  y: number;
}

export interface MotionState extends MotionBody {
  vx: number;
  vy: number;
  jumpVelocity: number;
}

const PLAYER_RADIUS = 12;
const MAX_SPEED = 180;
const ACCELERATION = 900;
const FRICTION = 7;
const GRAVITY = 1050;

function insideLeaf(x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = LEAF_CONTOUR.length - 1; i < LEAF_CONTOUR.length; j = i++) {
    const [xi, yi] = LEAF_CONTOUR[i]!;
    const [xj, yj] = LEAF_CONTOUR[j]!;
    const crosses = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function canStandAt(x: number, y: number): boolean {
  return (
    insideLeaf(x, y) &&
    insideLeaf(x - PLAYER_RADIUS, y) &&
    insideLeaf(x + PLAYER_RADIUS, y) &&
    insideLeaf(x, y - PLAYER_RADIUS) &&
    insideLeaf(x, y + PLAYER_RADIUS)
  );
}

export function isWalkable(x: number, y: number): boolean {
  return canStandAt(x, y);
}

/** Server authoritative walk + jump step, shared logical units and seconds. */
export function stepMotion(
  state: MotionState,
  input: MovementInput,
  deltaSeconds: number,
): void {
  const dt = Math.min(Math.max(deltaSeconds, 0), 0.05);
  const inputLength = Math.hypot(input.x, input.y);
  const inputX = inputLength > 1 ? input.x / inputLength : input.x;
  const inputY = inputLength > 1 ? input.y / inputLength : input.y;

  const damping = Math.exp(-FRICTION * dt);
  state.vx = inputX !== 0 ? state.vx + inputX * ACCELERATION * dt : state.vx * damping;
  state.vy = inputY !== 0 ? state.vy + inputY * ACCELERATION * dt : state.vy * damping;

  const speed = Math.hypot(state.vx, state.vy);
  if (speed > MAX_SPEED) {
    state.vx = (state.vx / speed) * MAX_SPEED;
    state.vy = (state.vy / speed) * MAX_SPEED;
  }

  const nextX = state.x + state.vx * dt;
  if (canStandAt(nextX, state.y)) state.x = nextX;
  else state.vx = 0;

  const nextY = state.y + state.vy * dt;
  if (canStandAt(state.x, nextY)) state.y = nextY;
  else state.vy = 0;

  if (state.jumpHeight > 0 || state.jumpVelocity > 0) {
    state.jumpHeight += state.jumpVelocity * dt;
    state.jumpVelocity -= GRAVITY * dt;
    if (state.jumpHeight <= 0) {
      state.jumpHeight = 0;
      state.jumpVelocity = 0;
    }
  }
}

export function beginJump(
  state: Pick<MotionState, "jumpHeight" | "jumpVelocity">,
): boolean {
  if (state.jumpHeight > 0 || state.jumpVelocity > 0) return false;
  state.jumpVelocity = 360;
  return true;
}
