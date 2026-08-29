import type { Maze, Opening, Side, Treasure } from '../maze/types';
import { DIFFICULTIES } from '../maze/types';

const DELTA: Record<Side, [number, number]> = { N: [-1, 0], E: [0, 1], S: [1, 0], W: [0, -1] };

export const PAGE_W_MM = 210;
export const PAGE_H_MM = 297;

const WALL_COLOR = '#33333d';
const SOLUTION_COLOR = '#ff7b72';
const FONT = "'Avenir Next', 'Avenir', 'Segoe UI', 'Trebuchet MS', system-ui, sans-serif";

/** How much of its cell (or room) an uploaded picture's disc fills. Smaller
 *  than the emoji glyph on purpose: it leaves a ring of white inside the room
 *  so kids can draw around the photo instead of over it. */
const PICTURE_DISC = 0.77;

/** Images for treasure pictures, keyed by their src. */
export type ImageMap = Map<string, CanvasImageSource>;

/** Reading direction for the page furniture. The preview canvas inherits it
 *  from <html dir>, but every PDF page is drawn on a detached canvas that never
 *  can — pass it explicitly or Hebrew pages print left-to-right. */
export type Direction = 'ltr' | 'rtl';

export interface PageInfo {
  title: string;
  /** localized difficulty label shown next to the stars */
  difficultyLabel?: string;
  showSolution?: boolean;
  pageNumber?: number;
  images?: ImageMap;
  dir?: Direction;
  /** Sheet colour. Screen-only: the preview dims it in night mode so a full
   *  A4 of white does not glare. Every PDF path leaves it undefined, which is
   *  the point — print output must not follow the app's theme. */
  paper?: string;
}

/** Render a full A4 page (maze + header) onto the canvas at the given pixel width. */
export function renderMazePage(
  canvas: HTMLCanvasElement,
  maze: Maze,
  pixelWidth: number,
  info: PageInfo,
): void {
  const W = pixelWidth;
  const H = Math.round((W * PAGE_H_MM) / PAGE_W_MM);
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const mm = W / PAGE_W_MM; // pixels per millimetre
  const rtl = info.dir === 'rtl';
  ctx.direction = info.dir ?? 'ltr';

  ctx.fillStyle = info.paper ?? '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // header — title on the side the language starts from, stars on the other
  const margin = 14 * mm;
  ctx.fillStyle = '#33333d';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = rtl ? 'right' : 'left';
  ctx.font = `600 ${7 * mm}px ${FONT}`;
  ctx.fillText(info.title, rtl ? W - margin : margin, margin + 6 * mm);
  const level = DIFFICULTIES.findIndex((d) => d.id === maze.options.difficulty) + 1;
  ctx.textAlign = rtl ? 'left' : 'right';
  ctx.font = `${4.5 * mm}px ${FONT}`;
  ctx.fillStyle = '#8a8a94';
  const stars = `${'★'.repeat(level)}${'☆'.repeat(DIFFICULTIES.length - level)}`;
  const label = info.difficultyLabel ? `${info.difficultyLabel}  ${stars}` : stars;
  ctx.fillText(label, rtl ? margin : W - margin, margin + 6 * mm);

  if (info.pageNumber) {
    ctx.textAlign = 'center';
    ctx.font = `${3.8 * mm}px ${FONT}`;
    ctx.fillStyle = '#b5b5bd';
    ctx.fillText(String(info.pageNumber), W / 2, H - 8 * mm);
  }

  // maze area
  const top = margin + 14 * mm;
  const areaW = W - margin * 2;
  const areaH = H - top - 16 * mm;
  drawMaze(ctx, maze, margin, top, areaW, areaH, !!info.showSolution, info.images);
}

export function drawMaze(
  ctx: CanvasRenderingContext2D,
  maze: Maze,
  x0: number,
  y0: number,
  areaW: number,
  areaH: number,
  showSolution: boolean,
  images?: ImageMap,
): void {
  const { rows, cols, mask, walls, openings, waypoints, solution } = maze;
  // leave a rim for arrows outside the maze border
  const rim = 1.6;
  const cell = Math.min(areaW / (cols + rim * 2), areaH / (rows + rim * 2));
  const ox = x0 + (areaW - cell * cols) / 2;
  const oy = y0 + (areaH - cell * rows) / 2;
  const px = (c: number) => ox + c * cell;
  const py = (r: number) => oy + r * cell;
  const lw = Math.max(1.5, cell * 0.16);

  // solution first so walls sit on top of it
  if (showSolution && solution.length) {
    ctx.strokeStyle = SOLUTION_COLOR;
    ctx.lineWidth = Math.max(1.5, cell * 0.28);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    const startO = openings.find((o) => o.kind === 'start')!;
    const exitO = openings.find((o) => o.kind === 'exit')!;
    const outside = (o: Opening, dist: number): [number, number] => {
      const [dr, dc] = DELTA[o.side];
      return [px(o.c + 0.5) + dc * cell * dist, py(o.r + 0.5) + dr * cell * dist];
    };
    ctx.moveTo(...outside(startO, 1.1));
    for (const [r, c] of solution) ctx.lineTo(px(c + 0.5), py(r + 0.5));
    ctx.lineTo(...outside(exitO, 1.1));
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // treasures go under the walls: icons stay inside their room block (a fully
  // open chamber — generation guarantees no internal walls), so no wall is
  // ever hidden and the maze can always be solved by what's visible
  for (const wp of waypoints) {
    const cx = px(wp.c0 + wp.size / 2);
    const cy = py(wp.r0 + wp.size / 2);
    drawTreasure(ctx, wp.treasure, cx, cy, cell * wp.size, images);
  }

  // walls
  ctx.strokeStyle = WALL_COLOR;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!mask[r][c]) continue;
      const w = walls[r][c];
      if (w.N) { ctx.moveTo(px(c), py(r)); ctx.lineTo(px(c + 1), py(r)); }
      if (w.W) { ctx.moveTo(px(c), py(r)); ctx.lineTo(px(c), py(r + 1)); }
      if (w.S) { ctx.moveTo(px(c), py(r + 1)); ctx.lineTo(px(c + 1), py(r + 1)); }
      if (w.E) { ctx.moveTo(px(c + 1), py(r)); ctx.lineTo(px(c + 1), py(r + 1)); }
    }
  }
  ctx.stroke();

  // arrows at the doors
  for (const o of openings) {
    const [dr, dc] = DELTA[o.side];
    const isEntrance = o.kind === 'start' || o.kind === 'decoy-entrance';
    const midX = px(o.c + 0.5);
    const midY = py(o.r + 0.5);
    // arrow sits outside the border, along the door's axis
    const baseX = midX + dc * cell * (isEntrance ? 1.5 : 0.7);
    const baseY = midY + dr * cell * (isEntrance ? 1.5 : 0.7);
    const tipX = midX + dc * cell * (isEntrance ? 0.7 : 1.5);
    const tipY = midY + dr * cell * (isEntrance ? 0.7 : 1.5);
    drawArrow(ctx, baseX, baseY, tipX, tipY, Math.max(2, cell * 0.2), WALL_COLOR);
  }
}

function drawTreasure(
  ctx: CanvasRenderingContext2D,
  treasure: Treasure,
  cx: number,
  cy: number,
  cell: number,
  images?: ImageMap,
): void {
  if (treasure.kind === 'emoji') {
    // no backing disc — the glyph is transparent and fits inside its cell.
    // Emoji ink is rarely centered on the font's metrics, so center the
    // measured glyph bounds instead of trusting textAlign/textBaseline.
    ctx.font = `${cell * 0.82}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const m = ctx.measureText(treasure.value);
    const inkW = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
    const inkH = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
    if (inkW > 0 && inkH > 0) {
      const dx = (m.actualBoundingBoxLeft - m.actualBoundingBoxRight) / 2;
      const dy = (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
      ctx.fillText(treasure.value, cx + dx, cy + dy);
    } else {
      ctx.fillText(treasure.value, cx, cy + cell * 0.04);
    }
    return;
  }
  const img = images?.get(treasure.src);
  if (!img) return;
  const d = cell * PICTURE_DISC;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, d / 2, 0, Math.PI * 2);
  ctx.clip();
  const iw = 'width' in img ? Number(img.width) : d;
  const ih = 'height' in img ? Number(img.height) : d;
  const scale = Math.max(d / iw, d / ih); // cover the circle
  const w = iw * scale;
  const h = ih * scale;
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  ctx.restore();
  ctx.strokeStyle = WALL_COLOR;
  ctx.lineWidth = Math.max(1, cell * 0.06);
  ctx.beginPath();
  ctx.arc(cx, cy, d / 2, 0, Math.PI * 2);
  ctx.stroke();
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  color: string,
): void {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const head = width * 2.2;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2 - Math.cos(angle) * head * 0.6, y2 - Math.sin(angle) * head * 0.6);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - Math.cos(angle - 0.5) * head, y2 - Math.sin(angle - 0.5) * head);
  ctx.lineTo(x2 - Math.cos(angle + 0.5) * head, y2 - Math.sin(angle + 0.5) * head);
  ctx.closePath();
  ctx.fill();
}

export interface CoverInfo {
  title: string;
  /** the line under the title — a count of the mazes, or whatever the user typed */
  subtitle: string;
  /** a taste of what is inside; at most five are shown */
  treasures: Treasure[];
  images?: ImageMap;
  dir?: Direction;
}

/** Cover page for a maze book. */
export function renderCoverPage(
  canvas: HTMLCanvasElement,
  pixelWidth: number,
  info: CoverInfo,
): void {
  const W = pixelWidth;
  const H = Math.round((W * PAGE_H_MM) / PAGE_W_MM);
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const mm = W / PAGE_W_MM;
  const rtl = info.dir === 'rtl';
  ctx.direction = info.dir ?? 'ltr';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // playful dashed border
  ctx.strokeStyle = '#33333d';
  ctx.lineWidth = 1.2 * mm;
  ctx.setLineDash([6 * mm, 4 * mm]);
  ctx.lineCap = 'round';
  ctx.strokeRect(12 * mm, 12 * mm, W - 24 * mm, H - 24 * mm);
  ctx.setLineDash([]);

  ctx.fillStyle = '#33333d';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 ${14 * mm}px ${FONT}`;
  wrapText(ctx, info.title, W / 2, H * 0.38, W - 60 * mm, 18 * mm);
  ctx.font = `${6 * mm}px ${FONT}`;
  ctx.fillStyle = '#8a8a94';
  if (info.subtitle) ctx.fillText(info.subtitle, W / 2, H * 0.5);

  // the strip reads in the same direction as the words above it
  const shown = info.treasures.slice(0, 5);
  if (rtl) shown.reverse();
  const size = 16 * mm;
  const gap = 8 * mm;
  const total = shown.length * size + (shown.length - 1) * gap;
  let x = W / 2 - total / 2 + size / 2;
  for (const t of shown) {
    // icons are sized off their cell, so ask for a cell that draws them ~`size` big
    drawTreasure(ctx, t, x, H * 0.64, size / 0.86, info.images);
    x += size + gap;
  }
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): void {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i) => ctx.fillText(l, x, startY + i * lineHeight));
}
