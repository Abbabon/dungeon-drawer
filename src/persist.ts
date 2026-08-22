import { LANGS, type Lang } from './i18n';
import { DIFFICULTIES, type DifficultyId, type MazeOptions, type ShapeId, type Treasure } from './maze/types';

/* ------------------------------------------------------------------ *
 * Language — a real cookie.
 *
 * Small, and readable outside JS: if we ever put an edge redirect in
 * front of the static locale pages, it can honour this without a round
 * trip through the app.
 * ------------------------------------------------------------------ */

const LANG_COOKIE = 'dd_lang';
const YEAR_SECONDS = 60 * 60 * 24 * 365;

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function readLangCookie(): Lang | null {
  const value = readCookie(LANG_COOKIE);
  return LANGS.some((l) => l.id === value) ? (value as Lang) : null;
}

export function writeLangCookie(lang: Lang): void {
  try {
    document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=${YEAR_SECONDS}; SameSite=Lax`;
  } catch {
    // private mode / cookies blocked — the app still works, it just forgets
  }
}

/* ------------------------------------------------------------------ *
 * The maze book and the uploaded pictures — localStorage, not a cookie.
 *
 * A book is a list of {options, seed} snapshots, and uploaded treasures
 * ride along as image data URLs. That is routinely hundreds of KB, well
 * past the ~4 KB a cookie holds — and cookies are sent on every request,
 * so parking a book in one would be wrong even if it fit. localStorage is
 * the same "it's still there tomorrow" guarantee without either problem.
 * ------------------------------------------------------------------ */

const STATE_KEY = 'dd_state_v1';

export interface StoredBookEntry {
  title: string;
  options: MazeOptions;
}

export interface StoredBook {
  title: string;
  solutions: boolean;
  entries: StoredBookEntry[];
}

export interface StoredState {
  book: StoredBook;
  /** the user's own uploaded treasure pictures, so the strip survives a reload */
  images: string[];
}

/** Uploads only ever become data URLs; refuse anything else that shows up. */
function isDataImage(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('data:image/');
}

/** localStorage is user-editable and survives across app versions — validate. */
function parseTreasure(value: unknown): Treasure | null {
  if (!value || typeof value !== 'object') return null;
  const t = value as Record<string, unknown>;
  if (t.kind === 'emoji' && typeof t.value === 'string') return { kind: 'emoji', value: t.value };
  if (t.kind === 'image' && isDataImage(t.src)) return { kind: 'image', src: t.src };
  return null;
}

function parseOptions(value: unknown): MazeOptions | null {
  if (!value || typeof value !== 'object') return null;
  const o = value as Record<string, unknown>;
  const shapes: ShapeId[] = ['rectangle', 'circle', 'heart', 'star', 'hexagon'];
  if (typeof o.seed !== 'number' || !Number.isFinite(o.seed)) return null;
  if (!DIFFICULTIES.some((d) => d.id === o.difficulty)) return null;
  if (!shapes.includes(o.shape as ShapeId)) return null;
  if (!Array.isArray(o.treasures)) return null;
  const treasures = o.treasures.map(parseTreasure);
  if (treasures.some((t) => t === null)) return null;
  const clamp = (n: unknown, lo: number, hi: number, fallback: number) =>
    typeof n === 'number' && Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : fallback;
  return {
    seed: Math.floor(o.seed),
    difficulty: o.difficulty as DifficultyId,
    shape: o.shape as ShapeId,
    entrances: clamp(o.entrances, 1, 3, 1),
    exits: clamp(o.exits, 1, 3, 1),
    treasures: treasures as Treasure[],
    treasureSize: clamp(o.treasureSize, 1, 5, 1),
  };
}

export function loadState(): StoredState | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STATE_KEY);
  } catch {
    return null; // storage disabled
  }
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    const book = (data.book ?? {}) as Record<string, unknown>;
    const entries = Array.isArray(book.entries) ? book.entries : [];
    const parsed: StoredBookEntry[] = [];
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') continue;
      const e = entry as Record<string, unknown>;
      const options = parseOptions(e.options);
      if (options) parsed.push({ title: typeof e.title === 'string' ? e.title : '', options });
    }
    return {
      book: {
        title: typeof book.title === 'string' ? book.title : '',
        solutions: book.solutions !== false,
        entries: parsed,
      },
      images: Array.isArray(data.images) ? data.images.filter(isDataImage) : [],
    };
  } catch {
    clearState();
    return null;
  }
}

/** @returns false when the browser refused to store it (quota, private mode). */
export function saveState(state: StoredState): boolean {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STATE_KEY);
  } catch {
    // nothing to do
  }
}
