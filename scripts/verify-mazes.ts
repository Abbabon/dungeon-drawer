/**
 * Invariant suite for the generator. `npm run build` only type-checks it — run
 * it by hand after touching src/maze/generate.ts:
 *
 *     npx tsx scripts/verify-mazes.ts
 *
 * It sweeps every shape × difficulty × seed and asserts the four properties the
 * rest of the app leans on:
 *   1. the exit is reachable from the start (the maze is solvable, and the
 *      returned solution really is a walk through open walls);
 *   2. every decoy door is walled off from the start — a decoy that connects is
 *      a second real entrance;
 *   3. every treasure is a cut vertex: no route from start to exit gets past it;
 *   4. treasure rooms are whole — distinct, fully open inside, so an oversized
 *      icon can never hide a wall.
 */
import { generateMaze } from '../src/maze/generate';
import { DIFFICULTIES, type Maze, type ShapeId, type Side, type Treasure } from '../src/maze/types';

const SHAPES: ShapeId[] = ['rectangle', 'circle', 'heart', 'star', 'hexagon'];
const SIDES: Side[] = ['N', 'E', 'S', 'W'];
const DELTA: Record<Side, [number, number]> = { N: [-1, 0], E: [0, 1], S: [1, 0], W: [0, -1] };
const EMOJIS = ['💎', '🗝️', '👑', '🏆', '💰', '🐵', '🦊', '🐸', '🐢', '🦉'];

const treasuresOf = (n: number): Treasure[] =>
  Array.from({ length: n }, (_, i) => ({ kind: 'emoji', value: EMOJIS[i % EMOJIS.length] }));

/** Cells reachable from `from` without entering `blocked`. */
function reachable(maze: Maze, from: [number, number], blocked: Set<number>): Set<number> {
  const { rows, cols, mask, walls } = maze;
  const key = (r: number, c: number) => r * cols + c;
  const seen = new Set<number>();
  if (blocked.has(key(from[0], from[1]))) return seen;
  const queue: [number, number][] = [from];
  seen.add(key(from[0], from[1]));
  while (queue.length) {
    const [r, c] = queue.pop()!;
    for (const s of SIDES) {
      if (walls[r][c][s]) continue;
      const [dr, dc] = DELTA[s];
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || !mask[nr][nc]) continue;
      const k = key(nr, nc);
      if (seen.has(k) || blocked.has(k)) continue;
      seen.add(k);
      queue.push([nr, nc]);
    }
  }
  return seen;
}

const failures: string[] = [];
let checked = 0;

function check(label: string, maze: Maze): void {
  checked++;
  const { cols, walls, openings, waypoints, solution } = maze;
  const key = (r: number, c: number) => r * cols + c;
  const fail = (why: string) => failures.push(`${label}: ${why}`);

  const start = openings.find((o) => o.kind === 'start')!;
  const exit = openings.find((o) => o.kind === 'exit')!;

  // 1. solvable, and the solution is a real walk
  const open = reachable(maze, [start.r, start.c], new Set());
  if (!open.has(key(exit.r, exit.c))) fail('exit unreachable from start');
  if (!solution.length) fail('empty solution');
  if (solution.length) {
    const [sr, sc] = solution[0];
    const [er, ec] = solution[solution.length - 1];
    if (sr !== start.r || sc !== start.c) fail('solution does not begin at the start door');
    if (er !== exit.r || ec !== exit.c) fail('solution does not end at the exit door');
    for (let i = 1; i < solution.length; i++) {
      const [pr, pc] = solution[i - 1];
      const [r, c] = solution[i];
      const side = SIDES.find((s) => pr + DELTA[s][0] === r && pc + DELTA[s][1] === c);
      if (!side) fail(`solution step ${i} is not between neighbours`);
      else if (walls[pr][pc][side]) fail(`solution step ${i} walks through a wall`);
    }
  }

  // 2. decoys stay dead
  for (const o of openings) {
    if (o.kind !== 'decoy-entrance' && o.kind !== 'decoy-exit') continue;
    if (open.has(key(o.r, o.c))) fail(`${o.kind} at ${o.r},${o.c} connects to the start`);
  }

  // 3./4. treasures are mandatory, and their rooms are whole
  const claimed = new Map<number, number>();
  waypoints.forEach((w, wi) => {
    const room = new Set<number>();
    for (let r = w.r0; r < w.r0 + w.size; r++)
      for (let c = w.c0; c < w.c0 + w.size; c++) {
        const k = key(r, c);
        const owner = claimed.get(k);
        if (owner !== undefined) fail(`treasures ${owner} and ${wi} share cell ${r},${c}`);
        claimed.set(k, wi);
        room.add(k);
      }
    if (!reachable(maze, [start.r, start.c], room).size) fail(`treasure ${wi} swallows the start`);
    if (reachable(maze, [start.r, start.c], room).has(key(exit.r, exit.c)))
      fail(`treasure ${wi} can be bypassed`);
    // an oversized icon covers the whole room, so the room must have no walls in it
    for (let r = w.r0; r < w.r0 + w.size; r++)
      for (let c = w.c0; c < w.c0 + w.size; c++) {
        if (c + 1 < w.c0 + w.size && walls[r][c].E) fail(`treasure ${wi} room has an inner wall`);
        if (r + 1 < w.r0 + w.size && walls[r][c].S) fail(`treasure ${wi} room has an inner wall`);
      }
  });
}

const SEEDS = 25;
for (const shape of SHAPES) {
  for (const d of DIFFICULTIES) {
    for (let i = 0; i < SEEDS; i++) {
      const seed = 1_000 + i * 7919;
      // sweep the treasure count too — 10 is the most the UI offers
      const count = i % 11;
      const size = 1 + (i % 5);
      check(`${shape}/${d.id}/seed ${seed}/${count} treasures/size ${size}`, generateMaze({
        seed,
        difficulty: d.id,
        shape,
        entrances: 1 + (i % 3),
        exits: 1 + ((i + 1) % 3),
        treasures: treasuresOf(count),
        treasureSize: size,
      }));
    }
  }
}

console.log(`checked ${checked} mazes`);
if (failures.length) {
  for (const f of failures.slice(0, 40)) console.error(`  ✗ ${f}`);
  // `throw` rather than process.exit: the DOM tsconfig that type-checks this
  // folder has no Node globals, and a non-zero exit is all we need anyway.
  throw new Error(`${failures.length} invariant failure(s)`);
}
console.log('all invariants hold');
