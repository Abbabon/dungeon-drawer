import type { Maze, MazeOptions, Opening, Side, Waypoint } from './types';
import { DIFFICULTIES } from './types';
import { buildMask } from './shapes';

const SIDES: Side[] = ['N', 'E', 'S', 'W'];
const DELTA: Record<Side, [number, number]> = { N: [-1, 0], E: [0, 1], S: [1, 0], W: [0, -1] };
const OPPOSITE: Record<Side, Side> = { N: 'S', S: 'N', E: 'W', W: 'E' };

/** Deterministic PRNG (mulberry32) so a seed always reproduces the same maze. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gridSize(options: MazeOptions): { rows: number; cols: number } {
  const diff = DIFFICULTIES.find((d) => d.id === options.difficulty)!;
  if (options.shape === 'rectangle') {
    // portrait page: taller than wide
    return { rows: Math.round(diff.size * 1.3), cols: diff.size };
  }
  // shaped mazes lose cells to the mask; bump the grid so play area stays comparable
  const n = Math.round(diff.size * 1.25);
  return { rows: n, cols: n };
}

export function generateMaze(options: MazeOptions): Maze {
  const rand = rng(options.seed);
  const { rows, cols } = gridSize(options);
  const mask = buildMask(options.shape, rows, cols);

  // all walls up
  const walls = mask.map((row) =>
    row.map(() => ({ N: true, E: true, S: true, W: true } as Record<Side, boolean>)),
  );

  const inMask = (r: number, c: number) =>
    r >= 0 && r < rows && c >= 0 && c < cols && mask[r][c];

  // --- carve a perfect maze with randomized DFS ---
  const cells: [number, number][] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) if (mask[r][c]) cells.push([r, c]);

  const visited = mask.map((row) => row.map(() => false));
  const startCell = cells[Math.floor(rand() * cells.length)];
  const stack: [number, number][] = [startCell];
  visited[startCell[0]][startCell[1]] = true;
  while (stack.length) {
    const [r, c] = stack[stack.length - 1];
    const candidates = SIDES.filter((s) => {
      const [dr, dc] = DELTA[s];
      return inMask(r + dr, c + dc) && !visited[r + dr][c + dc];
    });
    if (!candidates.length) {
      stack.pop();
      continue;
    }
    const side = candidates[Math.floor(rand() * candidates.length)];
    const [dr, dc] = DELTA[side];
    const nr = r + dr;
    const nc = c + dc;
    walls[r][c][side] = false;
    walls[nr][nc][OPPOSITE[side]] = false;
    visited[nr][nc] = true;
    stack.push([nr, nc]);
  }

  // --- boundary sides (cell edge facing outside the mask) ---
  const boundary: { r: number; c: number; side: Side }[] = [];
  for (const [r, c] of cells) {
    for (const s of SIDES) {
      const [dr, dc] = DELTA[s];
      if (!inMask(r + dr, c + dc)) boundary.push({ r, c, side: s });
    }
  }

  const key = (r: number, c: number) => r * cols + c;

  // BFS over open passages; returns parent map (-2 = unreached, -1 = root)
  const bfs = (fromR: number, fromC: number, blocked?: ReadonlySet<number>): Int32Array => {
    const parent = new Int32Array(rows * cols).fill(-2);
    const queue: number[] = [key(fromR, fromC)];
    parent[key(fromR, fromC)] = -1;
    while (queue.length) {
      const k = queue.shift()!;
      const r = Math.floor(k / cols);
      const c = k % cols;
      for (const s of SIDES) {
        if (walls[r][c][s]) continue;
        const [dr, dc] = DELTA[s];
        const nk = key(r + dr, c + dc);
        if (!inMask(r + dr, c + dc) || parent[nk] !== -2 || blocked?.has(nk)) continue;
        parent[nk] = k;
        queue.push(nk);
      }
    }
    return parent;
  };

  const pathFrom = (parent: Int32Array, toR: number, toC: number): [number, number][] => {
    const path: [number, number][] = [];
    let k = key(toR, toC);
    while (k !== -1) {
      path.push([Math.floor(k / cols), k % cols]);
      k = parent[k];
    }
    return path.reverse();
  };

  // --- pick start & exit far apart on the boundary (both through the maze
  //     and physically on the page, so the doors don't sit side by side) ---
  const spatial = (a: { r: number; c: number }, b: { r: number; c: number }) =>
    Math.hypot(a.r - b.r, a.c - b.c);
  const maxSpan = Math.hypot(rows, cols);
  const b0 = boundary[Math.floor(rand() * boundary.length)];
  let parent = bfs(b0.r, b0.c);
  let start = b0;
  let bestD = -1;
  for (const b of boundary) {
    const d = pathFrom(parent, b.r, b.c).length;
    if (d > bestD) {
      bestD = d;
      start = b;
    }
  }
  parent = bfs(start.r, start.c);
  // easier levels pick a shorter route between the doors (windiness quantile),
  // harder levels take the longest one available
  const diff = DIFFICULTIES.find((d) => d.id === options.difficulty)!;
  let candidates = boundary
    .filter((b) => !(b.r === start.r && b.c === start.c) && spatial(b, start) >= maxSpan * 0.45)
    .map((b) => ({ b, d: pathFrom(parent, b.r, b.c).length }));
  if (!candidates.length) {
    // masked shapes can make the spatial filter too strict; fall back
    candidates = boundary
      .filter((b) => !(b.r === start.r && b.c === start.c))
      .map((b) => ({ b, d: pathFrom(parent, b.r, b.c).length }));
  }
  candidates.sort((a, b) => a.d - b.d);
  const exit = candidates[Math.round(diff.windiness * (candidates.length - 1))].b;

  const openings: Opening[] = [
    { r: start.r, c: start.c, side: start.side, kind: 'start' },
    { r: exit.r, c: exit.c, side: exit.side, kind: 'exit' },
  ];
  walls[start.r][start.c][start.side] = false;
  walls[exit.r][exit.c][exit.side] = false;

  const solutionCells = new Set<number>();
  const solution = pathFrom(parent, exit.r, exit.c);
  for (const [r, c] of solution) solutionCells.add(key(r, c));

  // --- decoy doors: extra openings whose corridor is cut off before it
  //     reaches the real solution path, so they dead-end ---
  const usedDoors = new Set([`${start.r},${start.c}`, `${exit.r},${exit.c}`]);
  const shuffled = [...boundary].sort(() => rand() - 0.5);
  let entrancesLeft = Math.max(0, options.entrances - 1);
  let exitsLeft = Math.max(0, options.exits - 1);
  for (const b of shuffled) {
    if (entrancesLeft + exitsLeft <= 0) break;
    if (usedDoors.has(`${b.r},${b.c}`)) continue;
    if (solutionCells.has(key(b.r, b.c))) continue; // don't open doors on the true path
    // keep doors visually spread out
    const minGap = Math.max(3, Math.min(rows, cols) * 0.18);
    const doorCells = openings.map((o) => ({ r: o.r, c: o.c }));
    if (doorCells.some((d) => spatial(d, b) < minGap)) continue;
    // walk the unique path from the decoy toward the start; cut the edge just
    // before it merges into the solution path
    const p = bfs(start.r, start.c);
    if (p[key(b.r, b.c)] === -2) {
      // already inside a region cut off by a previous decoy — a free dead end
      walls[b.r][b.c][b.side] = false;
      usedDoors.add(`${b.r},${b.c}`);
      if (entrancesLeft > 0) {
        openings.push({ r: b.r, c: b.c, side: b.side, kind: 'decoy-entrance' });
        entrancesLeft--;
      } else {
        openings.push({ r: b.r, c: b.c, side: b.side, kind: 'decoy-exit' });
        exitsLeft--;
      }
      continue;
    }
    const path = pathFrom(p, b.r, b.c); // start -> decoy
    let cutAt = -1;
    for (let i = path.length - 1; i >= 0; i--) {
      if (solutionCells.has(key(path[i][0], path[i][1]))) {
        cutAt = i;
        break;
      }
    }
    if (cutAt < 0 || cutAt >= path.length - 1) continue;
    // the decoy branch must be long enough to be a fun trap, not a stub
    if (path.length - cutAt < 4) continue;
    const [ar, ac] = path[cutAt];
    const [br2, bc2] = path[cutAt + 1];
    const side = SIDES.find((s) => {
      const [dr, dc] = DELTA[s];
      return ar + dr === br2 && ac + dc === bc2;
    })!;
    walls[ar][ac][side] = true;
    walls[br2][bc2][OPPOSITE[side]] = true;
    walls[b.r][b.c][b.side] = false;
    usedDoors.add(`${b.r},${b.c}`);
    if (entrancesLeft > 0) {
      openings.push({ r: b.r, c: b.c, side: b.side, kind: 'decoy-entrance' });
      entrancesLeft--;
    } else {
      openings.push({ r: b.r, c: b.c, side: b.side, kind: 'decoy-exit' });
      exitsLeft--;
    }
  }

  // --- waypoint treasures spread along the solution path ---
  const waypoints: Waypoint[] = [];
  const treasures = options.treasures;
  if (treasures.length > 0 && solution.length > 6) {
    const lo = Math.floor(solution.length * 0.15);
    const hi = Math.ceil(solution.length * 0.85);
    const span = hi - lo;
    // Evenly spread, but never two treasures on one cell: a short path with a
    // lot of treasures packs them a cell apart and drops whatever runs off the
    // end. (With a handful of treasures the nudge never fires, so old seeds
    // still reproduce exactly.)
    let prev = -1;
    for (let i = 0; i < treasures.length; i++) {
      const t = treasures.length === 1 ? 0.5 : i / (treasures.length - 1);
      const idx = Math.max(prev + 1, Math.min(hi - 1, lo + Math.floor(t * (span - 1))));
      if (idx >= hi) break;
      prev = idx;
      const [r, c] = solution[idx];
      waypoints.push({ r, c, r0: r, c0: c, size: 1, treasure: treasures[i] });
    }
  }

  // --- open a little room around each treasure (like the book examples),
  //     but only when it keeps every treasure mandatory and decoys dead ---
  const decoys = openings.filter((o) => o.kind !== 'start' && o.kind !== 'exit');
  const regionOf = (w: Waypoint): Set<number> => {
    const region = new Set<number>();
    for (let r = w.r0; r < w.r0 + w.size; r++)
      for (let c = w.c0; c < w.c0 + w.size; c++) region.add(key(r, c));
    return region;
  };
  const layoutIsSafe = (): boolean => {
    const fromStart = bfs(start.r, start.c);
    if (fromStart[key(exit.r, exit.c)] === -2) return false;
    for (const d of decoys) {
      if (fromStart[key(d.r, d.c)] !== -2) return false; // decoy reconnected
    }
    for (const w of waypoints) {
      const avoiding = bfs(start.r, start.c, regionOf(w));
      if (avoiding[key(exit.r, exit.c)] !== -2) return false; // treasure bypassable
    }
    return true;
  };

  // --- braiding: open some dead ends into loops. Extra routes make the maze
  //     feel friendlier — easy levels get lots of them, expert gets none ---
  if (diff.braid > 0) {
    for (const [r, c] of cells) {
      const openSides = SIDES.filter((s) => !walls[r][c][s]);
      if (openSides.length !== 1 || rand() >= diff.braid) continue;
      const closed = SIDES.filter((s) => {
        const [dr, dc] = DELTA[s];
        return walls[r][c][s] && inMask(r + dr, c + dc);
      });
      if (!closed.length) continue;
      const s = closed[Math.floor(rand() * closed.length)];
      const [dr, dc] = DELTA[s];
      walls[r][c][s] = false;
      walls[r + dr][c + dc][OPPOSITE[s]] = false;
      if (!layoutIsSafe()) {
        walls[r][c][s] = true;
        walls[r + dr][c + dc][OPPOSITE[s]] = true;
      }
    }
  }

  // --- big treasures (treasureSize > 1) get an s×s open chamber carved
  //     around their anchor. The carve is atomic: a partially open room would
  //     hide walls under the oversized icon, so if no placement passes the
  //     safety check the treasure falls back to a smaller room / single cell ---
  const requestedSize = Math.max(1, Math.min(5, Math.round(options.treasureSize ?? 1)));
  if (requestedSize > 1) {
    const doorCells = new Set(openings.map((o) => key(o.r, o.c)));
    // Every anchor is spoken for from the outset: a room that swallowed a
    // neighbouring treasure's cell would sit two icons in one chamber, and the
    // one that fell back to a single cell has nowhere else to go.
    const claimed = new Map<number, Waypoint>();
    for (const w of waypoints) claimed.set(key(w.r, w.c), w);
    for (const w of waypoints) {
      outer: for (let size = requestedSize; size >= 2; size--) {
        // candidate top-left corners, closest-to-centered first (deterministic)
        const corners: { r0: number; c0: number; d: number }[] = [];
        for (let r0 = w.r - size + 1; r0 <= w.r; r0++)
          for (let c0 = w.c - size + 1; c0 <= w.c; c0++) {
            const d =
              Math.abs(r0 + (size - 1) / 2 - w.r) + Math.abs(c0 + (size - 1) / 2 - w.c);
            corners.push({ r0, c0, d });
          }
        corners.sort((a, b) => a.d - b.d || a.r0 - b.r0 || a.c0 - b.c0);
        for (const { r0, c0 } of corners) {
          let fits = true;
          for (let r = r0; r < r0 + size && fits; r++)
            for (let c = c0; c < c0 + size && fits; c++)
              if (!inMask(r, c) || doorCells.has(key(r, c)) || (claimed.get(key(r, c)) ?? w) !== w)
                fits = false;
          if (!fits) continue;
          const undo: [number, number, Side][] = [];
          const open = (r: number, c: number, s: Side) => {
            if (!walls[r][c][s]) return;
            const [dr, dc] = DELTA[s];
            walls[r][c][s] = false;
            walls[r + dr][c + dc][OPPOSITE[s]] = false;
            undo.push([r, c, s]);
          };
          for (let r = r0; r < r0 + size; r++)
            for (let c = c0; c < c0 + size; c++) {
              if (c + 1 < c0 + size) open(r, c, 'E');
              if (r + 1 < r0 + size) open(r, c, 'S');
            }
          w.r0 = r0;
          w.c0 = c0;
          w.size = size;
          if (layoutIsSafe()) {
            for (let r = r0; r < r0 + size; r++)
              for (let c = c0; c < c0 + size; c++) claimed.set(key(r, c), w);
            break outer;
          }
          for (const [r, c, s] of undo) {
            const [dr, dc] = DELTA[s];
            walls[r][c][s] = true;
            walls[r + dr][c + dc][OPPOSITE[s]] = true;
          }
          w.r0 = w.r;
          w.c0 = w.c;
          w.size = 1;
        }
      }
    }
  }

  for (const w of waypoints) {
    if (w.size > 1) continue; // big rooms are already carved
    for (const s of SIDES) {
      const [dr, dc] = DELTA[s];
      const nr = w.r + dr;
      const nc = w.c + dc;
      if (!inMask(nr, nc) || !walls[w.r][w.c][s]) continue;
      walls[w.r][w.c][s] = false;
      walls[nr][nc][OPPOSITE[s]] = false;
      if (!layoutIsSafe()) {
        walls[w.r][w.c][s] = true;
        walls[nr][nc][OPPOSITE[s]] = true;
      }
    }
  }

  // recompute solution (room carving may have shortened it slightly)
  parent = bfs(start.r, start.c);
  const finalSolution = pathFrom(parent, exit.r, exit.c);

  return { rows, cols, mask, walls, openings, waypoints, solution: finalSolution, options };
}
