export type Side = 'N' | 'E' | 'S' | 'W';

export type ShapeId = 'rectangle' | 'circle' | 'heart' | 'star' | 'hexagon';

export type DifficultyId = 'easy' | 'medium' | 'hard' | 'expert' | 'giant';

export interface Difficulty {
  id: DifficultyId;
  /** base grid size; rectangle stretches it for a portrait page */
  size: number;
  /** fraction of dead ends opened into loops — more loops = easier */
  braid: number;
  /** how long the solution is, as a quantile of possible door distances */
  windiness: number;
}

export const DIFFICULTIES: Difficulty[] = [
  { id: 'easy', size: 9, braid: 0.55, windiness: 0.55 },
  { id: 'medium', size: 14, braid: 0.25, windiness: 0.8 },
  { id: 'hard', size: 21, braid: 0.1, windiness: 1 },
  { id: 'expert', size: 30, braid: 0, windiness: 1 },
  { id: 'giant', size: 42, braid: 0, windiness: 1 },
];

export interface Opening {
  r: number;
  c: number;
  side: Side;
  kind: 'start' | 'exit' | 'decoy-entrance' | 'decoy-exit';
}

export type Treasure =
  | { kind: 'emoji'; value: string }
  | { kind: 'image'; src: string };

export interface Waypoint {
  /** anchor cell on the solution path */
  r: number;
  c: number;
  /** room block the treasure occupies: top-left corner + side length in cells */
  r0: number;
  c0: number;
  size: number;
  treasure: Treasure;
}

export interface MazeOptions {
  seed: number;
  difficulty: DifficultyId;
  shape: ShapeId;
  entrances: number; // total entrance arrows (1 real + decoys)
  exits: number; // total exit arrows (1 real + decoys)
  treasures: Treasure[]; // placed on the solution path, in order
  /** cells per side each treasure occupies (1–3); >1 carves an open room around it */
  treasureSize?: number;
}

export interface Maze {
  rows: number;
  cols: number;
  /** inMask[r][c] — cell is part of the maze */
  mask: boolean[][];
  /** walls[r][c] = { N, E, S, W } — true means wall present */
  walls: Record<Side, boolean>[][];
  openings: Opening[];
  waypoints: Waypoint[];
  /** solution path from start opening to exit opening, list of [r, c] */
  solution: [number, number][];
  options: MazeOptions;
}
