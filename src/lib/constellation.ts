import { mulberry32 } from './random';

export const CONSTELLATION_WIDTH = 150;
export const CONSTELLATION_HEIGHT = 52;

export interface StarPoint {
  readonly x: number;
  readonly y: number;
  readonly r: number;
  /** 0 at the bottom of the map, 1 at the top — drives the note the star plays. */
  readonly level: number;
}

export function constellation(count: number, seed: number): StarPoint[] {
  const rnd = mulberry32(seed);
  const pad = 5;
  return Array.from({ length: count }, (_, k) => {
    const fx = count === 1 ? 0.5 : k / (count - 1);
    const x = Math.round(pad + (CONSTELLATION_WIDTH - 2 * pad) * fx + (rnd() - 0.5) * 8);
    const y = Math.round(pad + rnd() * (CONSTELLATION_HEIGHT - 2 * pad));
    return { x, y, r: 1.3 + ((k * 7) % 3) * 0.4, level: 1 - y / CONSTELLATION_HEIGHT };
  });
}

export function constellationPath(points: readonly StarPoint[]): string {
  return points.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');
}
