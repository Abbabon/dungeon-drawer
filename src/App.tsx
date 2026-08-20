import { useEffect, useMemo, useRef, useState } from 'react';
import { generateMaze } from './maze/generate';
import type { DifficultyId, MazeOptions, ShapeId, Treasure } from './maze/types';
import { DIFFICULTIES } from './maze/types';
import { renderMazePage } from './render/draw';
import { fileToTreasureDataUrl, loadTreasureImages, mazeTreasures } from './render/images';
import { downloadBookPdf, downloadMazePdf } from './pdf';
import { detectLang, LANGS, RTL_LANGS, STRINGS, type Lang } from './i18n';
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

export default function App() {
  const [lang, setLang] = useState<Lang>(() => detectLang());
  const t = STRINGS[lang];

  const [difficulty, setDifficulty] = useState<DifficultyId>('medium');
  const [shape, setShape] = useState<ShapeId>('rectangle');
  const [entrances, setEntrances] = useState(2);
  const [exits, setExits] = useState(1);
  const [themeId, setThemeId] = useState('treasure');
  const [customImages, setCustomImages] = useState<string[]>([]);
  const [treasureCount, setTreasureCount] = useState(3);
  const [treasureSize, setTreasureSize] = useState(1);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const [title, setTitle] = useState(() => STRINGS[detectLang()].defaultMazeTitle);
  const [showSolution, setShowSolution] = useState(false);
  const [withSolutionPage, setWithSolutionPage] = useState(true);

  const [book, setBook] = useState<BookEntryState[]>([]);
  const [bookTitle, setBookTitle] = useState(() => STRINGS[detectLang()].defaultBookTitle);
  const [bookSolutions, setBookSolutions] = useState(true);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = RTL_LANGS.has(lang) ? 'rtl' : 'ltr';
  }, [lang]);

  const switchLang = (next: Lang) => {
    // keep default titles in sync unless the user typed their own
    const defaults = Object.values(STRINGS);
    if (defaults.some((s) => s.defaultMazeTitle === title)) setTitle(STRINGS[next].defaultMazeTitle);
    if (defaults.some((s) => s.defaultBookTitle === bookTitle)) setBookTitle(STRINGS[next].defaultBookTitle);
    setLang(next);
    analytics.languageChanged(next);
  };

  const treasures: Treasure[] = useMemo(() => {
    const pool: Treasure[] =
      themeId === 'custom'
        ? customImages.map((src) => ({ kind: 'image', src }))
        : THEMES.find((th) => th.id === themeId)!.emojis.map((value) => ({ kind: 'emoji', value }));
    if (!pool.length) return [];
    return Array.from({ length: treasureCount }, (_, i) => pool[i % pool.length]);
  }, [themeId, customImages, treasureCount]);

  const options: MazeOptions = useMemo(
    () => ({ seed, difficulty, shape, entrances, exits, treasures, treasureSize }),
    [seed, difficulty, shape, entrances, exits, treasures, treasureSize],
  );

  const maze = useMemo(() => generateMaze(options), [options]);

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
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [maze, title, showSolution, t]);

  const shuffle = () => setSeed(Math.floor(Math.random() * 1e9));

  const reroll = () => {
    analytics.mazeRerolled(options);
    shuffle();
  };

  const addToBook = () => {
    analytics.bookMazeAdded(options, book.length + 1);
    setBook((b) => [...b, { id: nextId++, title, options }]);
    shuffle();
  };

  const removeFromBook = (id: number) => setBook((b) => b.filter((e) => e.id !== id));

  const onUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    const urls = await Promise.all([...files].map((f) => fileToTreasureDataUrl(f).catch(() => null)));
    const good = urls.filter((u): u is string => !!u);
    if (good.length) {
      analytics.picturesUploaded(good.length);
      setCustomImages((imgs) => [...imgs, ...good]);
      setThemeId('custom');
      setTreasureCount((n) => Math.max(n, 1));
    }
  };

  const removeCustomImage = (idx: number) =>
    setCustomImages((imgs) => imgs.filter((_, i) => i !== idx));

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
                  <img className="theme-img" src={customImages[0]} alt={t.myPictures} />
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
                {customImages.map((src, i) => (
                  <span key={i} className="custom-chip">
                    <img src={src} alt="" />
                    <button title={t.remove} onClick={() => removeCustomImage(i)}>✕</button>
                  </span>
                ))}
              </div>
            )}
            <p className="hint">{t.uploadHint}</p>
            <label className="row">
              {t.howMany} <strong>{treasureCount}</strong>
              <input
                type="range"
                min={0}
                max={5}
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
              onClick={() => {
                analytics.pdfDownloaded(options, withSolutionPage);
                void downloadMazePdf(maze, title, withSolutionPage, t);
              }}
            >
              {t.downloadPdf}
            </button>
            <button className="big-btn" onClick={addToBook}>{t.addToBook}</button>
          </div>
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
              disabled={!book.length}
              onClick={() => {
                analytics.bookDownloaded(book.length, bookSolutions);
                void downloadBookPdf(
                  bookTitle,
                  book.map((e) => ({ maze: generateMaze(e.options), title: e.title })),
                  bookSolutions,
                  t,
                );
              }}
            >
              {t.downloadBook}
            </button>
          </div>
        </div>
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
                removeLabel={t.remove}
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
  removeLabel,
  onRemove,
}: {
  entry: BookEntryState;
  index: number;
  difficultyLabel: string;
  removeLabel: string;
  onRemove: (id: number) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const maze = useMemo(() => generateMaze(entry.options), [entry.options]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const images = await loadTreasureImages(mazeTreasures([maze]));
      if (cancelled || !ref.current) return;
      renderMazePage(ref.current, maze, 300, { title: entry.title, difficultyLabel, images });
    })();
    return () => {
      cancelled = true;
    };
  }, [maze, entry.title, difficultyLabel]);
  return (
    <div className="thumb">
      <canvas ref={ref} />
      <div className="thumb-bar">
        <span>{index + 1}. {entry.title}</span>
        <button title={removeLabel} onClick={() => onRemove(entry.id)}>✕</button>
      </div>
    </div>
  );
}
