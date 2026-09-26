export const TRAJECTORY_WIDTH = 1200;
export const TRAJECTORY_HEIGHT = 560;

const P0 = { x: 30, y: 470 };
const C = { x: 690, y: 540 };
const P2 = { x: 1170, y: 120 };

export const NODE_POSITIONS = [0.08, 0.3, 0.5, 0.7, 0.92];

export const trajectoryPath = `M${P0.x} ${P0.y} Q${C.x} ${C.y} ${P2.x} ${P2.y}`;
export const launchPoint = P0;

// A dashed stretch past the last mission, continuing along the curve's tangent.
export const futurePath = (() => {
  const dx = P2.x - C.x;
  const dy = P2.y - C.y;
  const len = Math.hypot(dx, dy);
  const reach = 70;
  return `M${P2.x} ${P2.y} L${(P2.x + (dx / len) * reach).toFixed(1)} ${(P2.y + (dy / len) * reach).toFixed(1)}`;
})();

export function pointAt(t: number): { x: number; y: number } {
  const u = 1 - t;
  return {
    x: u * u * P0.x + 2 * u * t * C.x + t * t * P2.x,
    y: u * u * P0.y + 2 * u * t * C.y + t * t * P2.y,
  };
}
