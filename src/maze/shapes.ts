import type { ShapeId } from './types';

/**
 * Shape masks. Each function takes normalized coordinates (x, y) in [-1, 1]
 * (y grows downward) and returns true if the point is inside the shape.
 */
type MaskFn = (x: number, y: number) => boolean;

const rectangle: MaskFn = () => true;

const circle: MaskFn = (x, y) => x * x + y * y <= 1;

const heart: MaskFn = (x, y) => {
  // classic heart curve, flipped so the point faces down
  const xs = x * 1.2;
  const ys = -y * 1.2 + 0.25;
  const a = xs * xs + ys * ys - 1;
  return a * a * a - xs * xs * ys * ys * ys <= 0;
};

const star: MaskFn = (x, y) => {
  // 5-point star via angular radius test
  const r = Math.hypot(x, y);
  if (r < 1e-9) return true;
  let theta = Math.atan2(-y, x) - Math.PI / 2; // point up
  const k = 5;
  // fold angle into one wedge
  theta = Math.abs((((theta % (2 * Math.PI / k)) + 2 * Math.PI / k) % (2 * Math.PI / k)) - Math.PI / k);
  const outer = 1.0;
  const inner = 0.48;
  const halfWedge = Math.PI / k;
  // linear interpolation of radius across the wedge
  const t = theta / halfWedge;
  const rMax = inner + (outer - inner) * t;
  return r <= rMax;
};

const hexagon: MaskFn = (x, y) => {
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  return ax <= 0.95 && ay <= 0.82 && 0.82 * ax + 0.475 * ay <= 0.86;
};

export const SHAPES: Record<ShapeId, MaskFn> = {
  rectangle,
  circle,
  heart,
  star,
  hexagon,
};

export function buildMask(shape: ShapeId, rows: number, cols: number): boolean[][] {
  const fn = SHAPES[shape];
  const mask: boolean[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < cols; c++) {
      // sample cell center in [-1, 1]
      const x = ((c + 0.5) / cols) * 2 - 1;
      const y = ((r + 0.5) / rows) * 2 - 1;
      row.push(fn(x, y));
    }
    mask.push(row);
  }
  keepLargestComponent(mask);
  return mask;
}

/** Remove disconnected pockets so the maze is a single region. */
function keepLargestComponent(mask: boolean[][]): void {
  const rows = mask.length;
  const cols = mask[0].length;
  const comp: number[][] = mask.map((row) => row.map(() => -1));
  let best = -1;
  let bestSize = 0;
  let id = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!mask[r][c] || comp[r][c] !== -1) continue;
      let size = 0;
      const stack: [number, number][] = [[r, c]];
      comp[r][c] = id;
      while (stack.length) {
        const [cr, cc] = stack.pop()!;
        size++;
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
          const nr = cr + dr;
          const nc = cc + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && mask[nr][nc] && comp[nr][nc] === -1) {
            comp[nr][nc] = id;
            stack.push([nr, nc]);
          }
        }
      }
      if (size > bestSize) {
        bestSize = size;
        best = id;
      }
      id++;
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (mask[r][c] && comp[r][c] !== best) mask[r][c] = false;
    }
  }
}
