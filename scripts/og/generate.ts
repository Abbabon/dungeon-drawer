/**
 * Renders the 1200×630 link-preview card for every locale and POSTs each PNG to
 * the little writer server in `write-server.mjs`, which drops them in `public/`.
 *
 *   node scripts/og/write-server.mjs      # terminal 1
 *   npm run dev                           # terminal 2
 *   open http://localhost:5173/scripts/og/index.html
 *
 * Not part of the app bundle — it just borrows the app's maze renderer so the
 * card and the printed page are drawn by the same code.
 */
import { generateMaze } from '../../src/maze/generate';
import { drawMaze } from '../../src/render/draw';
import { LANGS, RTL_LANGS, STRINGS, type Lang } from '../../src/i18n';
import { ogImageName, pathForLang } from '../../src/share';

const W = 1200;
const H = 630;
const WRITER = 'http://localhost:4319';

const BG = '#f6f1e7';
const INK = '#33333d';
const MUTED = '#8a8a94';
const ACCENT = '#ff8a5c';
const SOFT = '#ffe8d9';
const FONT = "'Avenir Next', 'Avenir', 'Segoe UI', 'Trebuchet MS', system-ui, sans-serif";

const TILE_EMOJI = ['❤️', '⭐', '💎', '📷', '📚'];

const MAZE = generateMaze({
  seed: 20260822,
  difficulty: 'medium',
  shape: 'heart',
  entrances: 2,
  exits: 2,
  treasures: [
    { kind: 'emoji', value: '💎' },
    { kind: 'emoji', value: '👑' },
    { kind: 'emoji', value: '🗝️' },
  ],
  treasureSize: 1,
});

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Greedy word wrap; `ctx.font` must already be set. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Longest app name is the Hebrew one, and at 76px it shoved the castle emoji
 * onto a line of its own. Shrink until the heading fits two lines with the
 * emoji still attached to a word.
 */
function fitHeading(
  ctx: CanvasRenderingContext2D,
  heading: string,
  maxWidth: number,
): { size: number; lines: string[] } {
  let lines: string[] = [];
  let size = 76;
  for (; size >= 48; size -= 2) {
    ctx.font = `700 ${size}px ${FONT}`;
    lines = wrap(ctx, heading, maxWidth);
    const emojiOrphan = lines.some((l) => l.trim() === '🏰');
    if (lines.length <= 2 && !emojiOrphan) break;
  }
  return { size, lines };
}

function drawCard(canvas: HTMLCanvasElement, lang: Lang): void {
  const t = STRINGS[lang];
  const rtl = RTL_LANGS.has(lang);
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // --- the tilted printed page, on the side the language doesn't read from ---
  const pageW = 560;
  const pageH = 700;
  const pageCx = rtl ? 300 : W - 300;
  const pageCy = H / 2;
  ctx.save();
  ctx.translate(pageCx, pageCy);
  ctx.rotate((rtl ? -3.2 : 3.2) * (Math.PI / 180));
  ctx.shadowColor = 'rgba(40, 30, 20, 0.16)';
  ctx.shadowBlur = 46;
  ctx.shadowOffsetY = 14;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, -pageW / 2, -pageH / 2, pageW, pageH, 22);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  drawMaze(ctx, MAZE, -pageW / 2 + 34, -pageH / 2 + 40, pageW - 68, pageH - 80, true);
  ctx.restore();

  // --- text column ---
  const colW = 520;
  const x = rtl ? W - 72 : 72;
  ctx.textAlign = rtl ? 'right' : 'left';
  ctx.direction = rtl ? 'rtl' : 'ltr';
  ctx.textBaseline = 'alphabetic';

  let y = 150;
  ctx.fillStyle = INK;
  const heading = rtl ? `${t.appTitle} 🏰` : `🏰 ${t.appTitle}`;
  const { size, lines } = fitHeading(ctx, heading, colW);
  ctx.font = `700 ${size}px ${FONT}`;
  for (const line of lines) {
    ctx.fillText(line, x, y);
    y += Math.round(size * 1.1);
  }

  y += 18;
  ctx.fillStyle = MUTED;
  ctx.font = `400 34px ${FONT}`;
  for (const line of wrap(ctx, t.tagline, colW)) {
    ctx.fillText(line, x, y);
    y += 46;
  }

  // --- emoji tiles ---
  y += 26;
  const tile = 74;
  const gap = 16;
  const tiles = TILE_EMOJI.length;
  const stripW = tiles * tile + (tiles - 1) * gap;
  const stripX = rtl ? x - stripW : x;
  ctx.textAlign = 'center';
  ctx.direction = 'ltr';
  for (let i = 0; i < tiles; i++) {
    const tx = stripX + i * (tile + gap);
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, tx, y, tile, tile, 18);
    ctx.fill();
    ctx.strokeStyle = SOFT;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.font = `40px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(TILE_EMOJI[i], tx + tile / 2, y + tile / 2 + 2);
    ctx.textBaseline = 'alphabetic';
  }

  // --- the localized URL, so the card advertises the right page ---
  y += tile + 66;
  ctx.textAlign = rtl ? 'right' : 'left';
  ctx.fillStyle = ACCENT;
  ctx.font = `700 30px ${FONT}`;
  ctx.direction = 'ltr';
  const host = `dungeon-drawer.vercel.app${pathForLang(lang).replace(/\/$/, '')}`;
  ctx.fillText(host, x, y);
}

async function run(): Promise<void> {
  const status = document.getElementById('status')!;
  const cards = document.getElementById('cards')!;
  await (document as unknown as { fonts: FontFaceSet }).fonts.ready;
  const lines: string[] = [];
  for (const { id } of LANGS) {
    const canvas = document.createElement('canvas');
    drawCard(canvas, id);
    cards.appendChild(canvas);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
    if (!blob) {
      lines.push(`${id}: toBlob failed`);
      continue;
    }
    const name = ogImageName(id);
    const res = await fetch(`${WRITER}/save/${name}`, { method: 'POST', body: blob });
    lines.push(`${id}: ${name} — ${res.ok ? `${Math.round(blob.size / 1024)} kB written` : `FAILED ${res.status}`}`);
    status.textContent = lines.join('\n');
  }
  status.textContent = `${lines.join('\n')}\ndone`;
}

void run();
