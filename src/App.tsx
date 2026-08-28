import { useEffect, useMemo, useRef, useState } from 'react';
import { generateMaze } from './maze/generate';
import type { DifficultyId, MazeOptions, ShapeId, Treasure } from './maze/types';
import { DIFFICULTIES } from './maze/types';
import { renderMazePage } from './render/draw';
import { fileToTreasureDataUrl, loadTreasureImages, mazeTreasures } from './render/images';
import { downloadBookPdf, downloadMazePdf, type PdfProgress } from './pdf';
import { detectLang, LANGS, STRINGS, type Lang } from './i18n';
import { applyShareHead, dirForLang, langFromLocation, pathForLang } from './share';
import { loadState, readLangCookie, saveState, writeLangCookie, type StoredImage } from './persist';
import { analytics } from './analytics';

interface TreasureTheme {
  id: string;
  emojis: string[];
}

const THEMES: TreasureTheme[] = [
  { id: 'treasure', emojis: ['💎', '🗝️', '👑', '🏆', '💰'] },
  { id: 'animals', emojis: ['🐵', '🦊', '🐸', '🐢', '🦉'] },
  { id: 'space', emojis: ['🚀', '🪐', '⭐', '👽', '🌙'] },
  { id: 'sweets', emojis: ['🧁', '🍭', '🍪', '🍩', '🍓'] },
  { id: 'ocean', emojis: ['🐠', '🐙', '🦀', '🐚', '🐬'] },
];

const SHAPE_CHOICES: { id: ShapeId; icon: string }[] = [
  { id: 'rectangle', icon: '⬜' },
  { id: 'circle', icon: '🔵' },
  { id: 'heart', icon: '❤️' },
  { id: 'star', icon: '⭐' },
  { id: 'hexagon', icon: '⬢' },
];

interface BookEntryState {
  id: number;
  title: string;
  options: MazeOptions;
}

let nextId = 1;

/** Which theme button a stored page's treasures came from, or null if we can't
 *  tell — no treasures, an emoji that has since left the palette, or pictures
 *  when the user has deleted the strip the "My pictures" button hangs off. */
function themeIdOf(treasures: Treasure[], customImages: StoredImage[]): string | null {
  const first = treasures[0];
  if (!first) return null;
  if (first.kind === 'image') return customImages.length ? 'custom' : null;
  return THEMES.find((th) => th.emojis.includes(first.value))?.id ?? null;
}

/** URL wins (a shared link is explicit), then the cookie, then the browser. */
const INITIAL_LANG: Lang = langFromLocation(window.location) ?? readLangCookie() ?? detectLang();
const STORED = loadState();

export default function App() {
  const [lang, setLang] = useState<Lang>(INITIAL_LANG);
  const t = STRINGS[lang];

  const [difficulty, setDifficulty] = useState<DifficultyId>('medium');
  const [shape, setShape] = useState<ShapeId>('rectangle');
  const [entrances, setEntrances] = useState(1);
  const [exits, setExits] = useState(1);
  // if their own pictures came back from last time, that's where they left off
  const [themeId, setThemeId] = useState(STORED?.images.length ? 'custom' : 'treasure');
  const [customImages, setCustomImages] = useState<StoredImage[]>(() => STORED?.images ?? []);
  const [treasureCount, setTreasureCount] = useState(3);
  const [treasureSize, setTreasureSize] = useState(1);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const [title, setTitle] = useState(() => STRINGS[INITIAL_LANG].defaultMazeTitle);
  const [showSolution, setShowSolution] = useState(false);
  const [withSolutionPage, setWithSolutionPage] = useState(true);

  const [book, setBook] = useState<BookEntryState[]>(() =>
    (STORED?.book.entries ?? []).map((e) => ({ id: nextId++, title: e.title, options: e.options })),
  );
  const [bookTitle, setBookTitle] = useState(
    () => STORED?.book.title || STRINGS[INITIAL_LANG].defaultBookTitle,
  );
  const [bookSolutions, setBookSolutions] = useState(STORED?.book.solutions ?? true);
  const [bookCover, setBookCover] = useState(STORED?.book.cover ?? true);
  /** the line under the title on the cover; empty means "count the mazes for me" */
  const [coverText, setCoverText] = useState(STORED?.book.coverText ?? '');
  const [bookTooBig, setBookTooBig] = useState(false);
  /** the book page the editor is currently standing in for, if any */
  const [selectedId, setSelectedId] = useState<number | null>(null);
  /** a PDF being built right now — which button started it, and how far in */
  const [building, setBuilding] = useState<{ what: 'page' | 'book'; done: number; total: number } | null>(
    null,
  );
  const buildingRef = useRef(false);

  // Language lives in three places at once: the document (lang/dir + share
  // tags), a cookie for the next visit, and the URL so a copied link carries it.
  useEffect(() => {
    applyShareHead(lang);
    writeLangCookie(lang);
    const url = new URL(window.location.href);
    url.pathname = pathForLang(lang);
    url.searchParams.delete('lang'); // normalize ?lang=he into /he/
    const next = url.pathname + url.search + url.hash;
    if (next !== window.location.pathname + window.location.search + window.location.hash) {
      window.history.replaceState(null, '', next);
    }
  }, [lang]);

  // The book is only {options, seed} snapshots, so re-generating it tomorrow
  // reproduces the exact same mazes. Uploaded pictures ride along so the
  // treasure strip is still there too.
  useEffect(() => {
    const stored = saveState({
      book: {
        title: bookTitle,
        solutions: bookSolutions,
        cover: bookCover,
        coverText,
        entries: book.map(({ title: entryTitle, options: entryOptions }) => ({
          title: entryTitle,
          options: entryOptions,
        })),
      },
      images: customImages,
    });
    setBookTooBig(!stored && (book.length > 0 || customImages.length > 0));
  }, [book, bookTitle, bookSolutions, bookCover, coverText, customImages]);

  const switchLang = (next: Lang) => {
    // keep default titles in sync unless the user typed their own
    const defaults = Object.values(STRINGS);
    if (defaults.some((s) => s.defaultMazeTitle === title)) setTitle(STRINGS[next].defaultMazeTitle);
    if (defaults.some((s) => s.defaultBookTitle === bookTitle)) setBookTitle(STRINGS[next].defaultBookTitle);
    setLang(next);
    analytics.languageChanged(next);
  };

  const treasures: Treasure[] = useMemo(() => {
    // only the pictures that are switched on; too few for the treasures asked
    // for and they simply take turns
    const pool: Treasure[] =
      themeId === 'custom'
        ? customImages.filter((img) => img.on).map(({ src }) => ({ kind: 'image', src }))
        : THEMES.find((th) => th.id === themeId)!.emojis.map((value) => ({ kind: 'emoji', value }));
    if (!pool.length) return [];
    return Array.from({ length: treasureCount }, (_, i) => pool[i % pool.length]);
  }, [themeId, customImages, treasureCount]);

  const options: MazeOptions = useMemo(
    () => ({ seed, difficulty, shape, entrances, exits, treasures, treasureSize }),
    [seed, difficulty, shape, entrances, exits, treasures, treasureSize],
  );

  const maze = useMemo(() => generateMaze(options), [options]);

  const selectedIndex = book.findIndex((e) => e.id === selectedId);

  const previewRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const images = await loadTreasureImages(mazeTreasures([maze]));
      if (cancelled || !previewRef.current) return;
      renderMazePage(previewRef.current, maze, 900, {
        title,
        difficultyLabel: t.difficulty[maze.options.difficulty],
        showSolution,
        images,
        dir: dirForLang(lang),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [maze, title, showSolution, t, lang]);

  const shuffle = () => setSeed(Math.floor(Math.random() * 1e9));

  const reroll = () => {
    analytics.mazeRerolled(options);
    shuffle();
  };

  // Adding deliberately leaves the editor alone: rolling a new maze here threw
  // away the one the user was still looking at. The new page becomes the
  // selected one instead, so the next tweak lands on what they just added.
  const addToBook = () => {
    const id = nextId++;
    analytics.bookMazeAdded(options, book.length + 1);
    setBook((b) => [...b, { id, title, options }]);
    setSelectedId(id);
  };

  /** Load a page back into the editor. Only the knobs travel — the maze itself
   *  is re-generated from {options, seed}, so it comes back identical. */
  const selectPage = (id: number) => {
    if (id === selectedId) {
      setSelectedId(null);
      return;
    }
    const entry = book.find((e) => e.id === id);
    if (!entry) return;
    const o = entry.options;
    setDifficulty(o.difficulty);
    setShape(o.shape);
    setEntrances(o.entrances);
    setExits(o.exits);
    setTreasureCount(o.treasures.length);
    setTreasureSize(o.treasureSize ?? 1);
    const theme = themeIdOf(o.treasures, customImages);
    if (theme) setThemeId(theme);
    setTitle(entry.title);
    setSeed(o.seed);
    setSelectedId(id);
  };

  const updateSelectedPage = () => {
    if (selectedId === null) return;
    analytics.bookPageUpdated(options, book.length);
    setBook((b) => b.map((e) => (e.id === selectedId ? { ...e, title, options } : e)));
  };

  /**
   * Building a PDF takes a few seconds and gives no feedback of its own, so the
   * buttons go busy for the duration. That is the point: a disabled button with
   * a live page count is what stops a second click from starting a second,
   * competing render of the same document.
   */
  const buildPdf = async (what: 'page' | 'book', run: (onProgress: PdfProgress) => Promise<void>) => {
    // The ref, not the state, is the lock: `disabled` only reaches the DOM on
    // the next render, so two clicks in the same tick would both still see
    // `building === null` and start two renders of the same document.
    if (buildingRef.current) return;
    buildingRef.current = true;
    setBuilding({ what, done: 0, total: 0 });
    try {
      await run((done, total) => setBuilding({ what, done, total }));
    } finally {
      buildingRef.current = false;
      setBuilding(null);
    }
  };

  const buildingLabel = (what: 'page' | 'book') => {
    if (building?.what !== what) return null;
    const { done, total } = building;
    // `done` counts finished pages, so the one being drawn right now is done + 1
    return total > 1 ? t.preparingPage(Math.min(done + 1, total), total) : t.preparingPdf;
  };

  const removeFromBook = (id: number) => {
    setBook((b) => b.filter((e) => e.id !== id));
    if (id === selectedId) setSelectedId(null);
  };

  const onUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    const urls = await Promise.all([...files].map((f) => fileToTreasureDataUrl(f).catch(() => null)));
    const good = urls.filter((u): u is string => !!u);
    if (good.length) {
      analytics.picturesUploaded(good.length);
      setCustomImages((imgs) => [...imgs, ...good.map((src) => ({ src, on: true }))]);
      setThemeId('custom');
      setTreasureCount((n) => Math.max(n, 1));
    }
  };

  const removeCustomImage = (idx: number) =>
    setCustomImages((imgs) => imgs.filter((_, i) => i !== idx));

  /** Leave a picture out of the maze without throwing it away. */
  const toggleCustomImage = (idx: number) =>
    setCustomImages((imgs) => imgs.map((img, i) => (i === idx ? { ...img, on: !img.on } : img)));

  /** the button that opens the picture theme wears the first picture in play */
  const pictureIcon = customImages.find((img) => img.on)?.src ?? customImages[0]?.src;

  return (
    <div className="app">
      <header className="topbar">
        <div className="lang-row">
          <select
            className="lang-select"
            value={lang}
            onChange={(e) => switchLang(e.target.value as Lang)}
            aria-label="Language"
          >
            {LANGS.map((l) => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </select>
        </div>
        <h1>🏰 {t.appTitle}</h1>
        <p>{t.tagline}</p>
      </header>

      <div className="layout">
        <aside className="controls">
          <section className="card">
            <h2>{t.secDifficulty}</h2>
            <div className="pill-grid">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.id}
                  className={`pill ${difficulty === d.id ? 'active' : ''}`}
                  onClick={() => setDifficulty(d.id)}
                >
                  <strong>{t.difficulty[d.id]}</strong>
                </button>
              ))}
            </div>
          </section>

          <section className="card">
            <h2>{t.secShape}</h2>
            <div className="shape-row">
              {SHAPE_CHOICES.map((s) => (
                <button
                  key={s.id}
                  title={t.shapes[s.id]}
                  className={`shape ${shape === s.id ? 'active' : ''}`}
                  onClick={() => setShape(s.id)}
                >
                  <span className="shape-icon">{s.icon}</span>
                  <span>{t.shapes[s.id]}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="card">
            <h2>{t.secDoors}</h2>
            <label className="row">
              {t.waysIn}
              <select value={entrances} onChange={(e) => setEntrances(Number(e.target.value))}>
                {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label className="row">
              {t.waysOut}
              <select value={exits} onChange={(e) => setExits(Number(e.target.value))}>
                {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <p className="hint">{t.doorsHint}</p>
          </section>

          <section className="card">
            <h2>{t.secTreasures}</h2>
            <div className="theme-row">
              {THEMES.map((th) => (
                <button
                  key={th.id}
                  title={t.themes[th.id]}
                  className={`theme ${themeId === th.id ? 'active' : ''}`}
                  onClick={() => setThemeId(th.id)}
                >
                  {th.emojis[0]}
                </button>
              ))}
              {customImages.length > 0 && (
                <button
                  title={t.myPictures}
                  className={`theme ${themeId === 'custom' ? 'active' : ''}`}
                  onClick={() => setThemeId('custom')}
                >
                  <img className="theme-img" src={pictureIcon} alt={t.myPictures} />
                </button>
              )}
            </div>
            <label className="upload-btn">
              {t.uploadPictures}
              <input
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  void onUpload(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
            {themeId === 'custom' && customImages.length > 0 && (
              <div className="custom-strip">
                {customImages.map((img, i) => (
                  <span key={i} className={`custom-chip ${img.on ? '' : 'off'}`}>
                    <button
                      className="chip-pick"
                      title={t.usePicture}
                      aria-pressed={img.on}
                      onClick={() => toggleCustomImage(i)}
                    >
                      <img src={img.src} alt="" />
                    </button>
                    <button
                      className="chip-remove"
                      title={t.remove}
                      onClick={() => removeCustomImage(i)}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="hint">{themeId === 'custom' && customImages.length > 0 ? t.pictureToggleHint : t.uploadHint}</p>
            <label className="row">
              {t.howMany} <strong>{treasureCount}</strong>
              <input
                type="range"
                min={0}
                max={10}
                value={treasureCount}
                onChange={(e) => setTreasureCount(Number(e.target.value))}
              />
            </label>
            <label className="row">
              {t.treasureSize} <strong>{treasureSize}×{treasureSize}</strong>
              <input
                type="range"
                min={1}
                max={5}
                value={treasureSize}
                onChange={(e) => setTreasureSize(Number(e.target.value))}
              />
            </label>
            <p className="hint">{t.treasuresHint}</p>
          </section>

          <section className="card">
            <h2>{t.secName}</h2>
            <input
              className="text-input"
              value={title}
              maxLength={40}
              onChange={(e) => setTitle(e.target.value)}
            />
          </section>
        </aside>

        <main className="preview-pane">
          <div className="preview-actions">
            <button className="big-btn" onClick={reroll}>{t.tryAnother}</button>
            <label className="toggle">
              <input
                type="checkbox"
                checked={showSolution}
                onChange={(e) => {
                  if (e.target.checked) analytics.solutionPeeked();
                  setShowSolution(e.target.checked);
                }}
              />
              {t.peekSolution}
            </label>
            <span className="spacer" />
            <button
              className="big-btn accent"
              disabled={!!building}
              aria-busy={building?.what === 'page'}
              onClick={() => {
                analytics.pdfDownloaded(options, withSolutionPage);
                void buildPdf('page', (onProgress) =>
                  downloadMazePdf(maze, title, withSolutionPage, lang, onProgress),
                );
              }}
            >
              {buildingLabel('page') ? (
                <><span className="spinner" aria-hidden="true" />{buildingLabel('page')}</>
              ) : (
                t.downloadPdf
              )}
            </button>
            <button className="big-btn" onClick={addToBook}>{t.addToBook}</button>
          </div>
          {selectedIndex >= 0 && (
            <div className="editing-note">
              <span>{t.editingPage(selectedIndex + 1)}</span>
              <button className="save" onClick={updateSelectedPage}>
                {t.updatePage(selectedIndex + 1)}
              </button>
              <button onClick={() => setSelectedId(null)}>{t.stopEditing}</button>
            </div>
          )}
          <label className="toggle small">
            <input
              type="checkbox"
              checked={withSolutionPage}
              onChange={(e) => setWithSolutionPage(e.target.checked)}
            />
            {t.includeSolutionPage}
          </label>
          <div className="paper">
            <canvas ref={previewRef} className="preview-canvas" />
          </div>
        </main>
      </div>

      <section className="book-shelf card">
        <div className="book-head">
          <h2>
            {t.yourBook}{' '}
            <span className="count">{book.length ? t.mazeCount(book.length) : t.bookEmpty}</span>
          </h2>
          <div className="book-actions">
            <input
              className="text-input"
              value={bookTitle}
              maxLength={40}
              onChange={(e) => setBookTitle(e.target.value)}
            />
            <label className="toggle small">
              <input
                type="checkbox"
                checked={bookSolutions}
                onChange={(e) => setBookSolutions(e.target.checked)}
              />
              {t.solutionsAtBack}
            </label>
            <button
              className="big-btn accent"
              disabled={!book.length || !!building}
              aria-busy={building?.what === 'book'}
              onClick={() => {
                analytics.bookDownloaded(book.length, bookSolutions);
                void buildPdf('book', (onProgress) =>
                  downloadBookPdf(
                    bookTitle,
                    book.map((e) => ({ maze: generateMaze(e.options), title: e.title })),
                    bookSolutions,
                    { include: bookCover, text: coverText },
                    lang,
                    onProgress,
                  ),
                );
              }}
            >
              {buildingLabel('book') ? (
                <><span className="spinner" aria-hidden="true" />{buildingLabel('book')}</>
              ) : (
                t.downloadBook
              )}
            </button>
          </div>
        </div>
        <div className="cover-row">
          <label className="toggle small">
            <input
              type="checkbox"
              checked={bookCover}
              onChange={(e) => setBookCover(e.target.checked)}
            />
            {t.includeCoverPage}
          </label>
          {bookCover && (
            <label className="toggle small cover-line">
              {t.coverText}
              <input
                className="text-input"
                value={coverText}
                maxLength={60}
                placeholder={t.mazesInside(book.length)}
                onChange={(e) => setCoverText(e.target.value)}
              />
            </label>
          )}
        </div>
        {bookCover && <p className="hint">{t.coverTextHint}</p>}
        {bookTooBig && <p className="hint warn">{t.bookNotSaved}</p>}
        {book.length === 0 ? (
          <p className="hint">{t.bookHint}</p>
        ) : (
          <div className="shelf">
            {book.map((entry, i) => (
              <BookThumb
                key={entry.id}
                entry={entry}
                index={i}
                difficultyLabel={t.difficulty[entry.options.difficulty]}
                dir={dirForLang(lang)}
                removeLabel={t.remove}
                openLabel={t.openPage}
                selected={entry.id === selectedId}
                onSelect={selectPage}
                onRemove={removeFromBook}
              />
            ))}
          </div>
        )}
      </section>

      <footer className="footer">{t.footer}</footer>
    </div>
  );
}

function BookThumb({
  entry,
  index,
  difficultyLabel,
  dir,
  removeLabel,
  openLabel,
  selected,
  onSelect,
  onRemove,
}: {
  entry: BookEntryState;
  index: number;
  difficultyLabel: string;
  dir: 'ltr' | 'rtl';
  removeLabel: string;
  openLabel: string;
  selected: boolean;
  onSelect: (id: number) => void;
  onRemove: (id: number) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const maze = useMemo(() => generateMaze(entry.options), [entry.options]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const images = await loadTreasureImages(mazeTreasures([maze]));
      if (cancelled || !ref.current) return;
      renderMazePage(ref.current, maze, 300, { title: entry.title, difficultyLabel, images, dir });
    })();
    return () => {
      cancelled = true;
    };
  }, [maze, entry.title, difficultyLabel, dir]);
  return (
    <div className={`thumb ${selected ? 'selected' : ''}`}>
      <button
        className="thumb-pick"
        title={openLabel}
        aria-pressed={selected}
        onClick={() => onSelect(entry.id)}
      >
        <canvas ref={ref} />
      </button>
      <div className="thumb-bar">
        <span>{index + 1}. {entry.title}</span>
        <button title={removeLabel} onClick={() => onRemove(entry.id)}>✕</button>
      </div>
    </div>
  );
}
