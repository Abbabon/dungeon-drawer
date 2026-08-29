# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Vite dev server with hot reload
npm run build    # tsc --noEmit (strict typecheck) + vite build → dist/
npm run preview  # serve the production build locally
```

No test script and no lint config. `npm run build` is the correctness gate; `scripts/` is type-checked by it too. TypeScript is strict with `noUnusedLocals`/`noUnusedParameters`, so unused code fails the build.

The one real test is the generator invariant suite, run by hand after touching `src/maze/generate.ts`:

```bash
npx tsx scripts/verify-mazes.ts   # 625 mazes; prints "all invariants hold"
```

Regenerating the share cards is a separate manual step — see **Share cards** below.

## Feature pipeline

`main` is production (Vercel deploys it on push). For any user-facing change:

1. Branch: `git checkout -b feature/<name>`.
2. Implement; `npm run build` must pass, run `npx tsx scripts/verify-mazes.ts` if generation logic changed, and regenerate the share cards if `LANGS`/`appTitle`/`tagline` changed.
3. Commit (as Abbabon) and push the branch; the user tests it (`npm run dev` locally or the Vercel preview deploy) before it merges.
4. Merge to `main` only after the user approves. Trivial fixes (copy, typos) may go straight to `main` when the user says so.

## What this is

A fully client-side React + Vite app that generates printable kids' mazes and exports them as A4 PDFs (single pages or a multi-maze "book"). No backend and no network calls beyond loading the app: uploaded treasure images become data URLs, and the only thing that outlives the tab is the user's own browser storage (see **Persistence**).

## Architecture

Data flow: `App.tsx` (UI state) → `maze/generate.ts` (pure, seeded generation) → `render/draw.ts` (one canvas renderer for preview, thumbnails, and PDF pages) → `pdf.ts` (jsPDF assembly).

Two cross-cutting modules sit beside that pipeline: `share.ts` (locale ↔ URL mapping and head/OG tags, shared by the build and the runtime) and `persist.ts` (the language cookie and the localStorage snapshot).

**Determinism is load-bearing.** Generation is seeded (mulberry32); the same `{options, seed}` always reproduces the same maze. Book entries are stored only as `{options, seed}` snapshots and re-generated on demand — never break reproducibility of `generateMaze`.

**Generation pipeline** (`src/maze/generate.ts`), in order: shape mask (`shapes.ts`, implicit functions; disconnected pockets dropped) → DFS carve (perfect maze) → door placement (exit chosen by route-length quantile, tuned per difficulty) → decoy doors (walled off into guaranteed dead ends) → treasures spread along the solution path → braiding (opening dead ends into loops on easy levels) → rooms around treasures.

**Safety invariants.** Braiding and rooms mutate a maze that already has decoys and treasures, so every individual wall removal is validated and reverted if any of these breaks:
1. exit stays reachable from start;
2. every decoy door stays disconnected from start;
3. every treasure remains a cut vertex (no route can bypass it).

Any change to the pipeline must preserve these. `scripts/verify-mazes.ts` sweeps 5 shapes × 5 difficulties × 25 seeds (625 mazes, treasure counts 0–10 and sizes 1–5) and asserts all three plus solvability and one more: **treasure rooms never overlap**. Rooms are carved largest-first and a treasure that finds no room falls back to its single anchor cell, so every anchor is claimed up front — otherwise a big room swallows a neighbouring treasure and two icons print on top of each other.

Treasures are spread along the solution path at evenly spaced indices, nudged apart when the path is too short for the count (up to 10), and any that no longer fit are dropped rather than stacked.

**Theme** (`:root` tokens in `styles.css`, `dd_theme` cookie, `data-theme` on `<html>`). Light is the warm "desk"; dark is the same hue family, not neutral grey. An explicit choice wins in both directions, so the dark tokens are written twice on purpose — once under `prefers-color-scheme` for "system says dark and the user hasn't overridden", once under `[data-theme='dark']` for the toggle. An inline script in `index.html` stamps the attribute *before the first paint*; React mounts far too late, and a flash of the daylight palette is the one thing night mode exists to prevent.

**Draw mode** (`src/DrawLayer.tsx`): an overlay canvas above the preview for solving a maze on screen. It is a *second* canvas on purpose — the maze underneath is re-rendered on every knob turn and on every frame of the ink animation, so anything drawn into it would be wiped. Strokes are kept as point lists and replayed on every repaint, which is what makes undo a slice. Screen-only: nothing in it reaches `render/draw.ts`, so the PDF still prints a clean maze. Changing the maze clears the sheet (`sheetKey`).

**The theme must never reach the PDF.** `renderMazePage` takes optional `paper` and `ink`/`solutionInk` values and only the preview passes them (night mode's "dim the paper", so a full A4 of white does not glare at bedtime). Every `pdf.ts` call leaves it undefined and the page prints pure white. This is the same trap as `dir`: a detached canvas cannot inherit document state, and print output must not follow screen chrome.

**Rendering** (`src/render/draw.ts`): the same renderer draws the 900 px preview, 300 px book thumbnails, and 2480 px (~300 dpi A4) PDF pages, so preview = print. Every entry point takes an explicit `dir` — the preview canvas is in the document and inherits `<html dir>`, but a PDF page is drawn on a *detached* canvas that cannot, so without it Hebrew pages printed left-to-right (numbers at the wrong end of the line, title on the wrong side) while the preview looked fine. `dirForLang` in `share.ts` is the single source. Draw order is part of correctness: solution line → treasures → walls on top. Treasure icons must fit inside one cell and never cover a wall.

**PDF assembly** (`src/pdf.ts`): every page is a canvas PNG handed to `jsPDF.addImage` with an explicit `'SLOW'` compression argument. jsPDF stores image data *uncompressed* when that argument is omitted — 26 MB of raw pixels per A4 page, which once produced a 250 MB seven-maze book. Deflate is lossless, so the print is unaffected; never drop the argument.

Both export functions take an optional `onProgress(done, total)` and yield a frame (`nextFrame()`) before each page — page rendering blocks the main thread, so without the yield the counter would never paint. `App.tsx` drives the busy label from it and locks re-entry with a **ref**, not the `building` state: `disabled` only reaches the DOM on the next render, so a state-only guard still lets two same-tick clicks start two renders of the same document.

**The cover is the user's.** `downloadBookPdf` takes a `CoverChoice`: drop the cover page entirely, or type your own line under the title — blank falls back to the localized `t.mazesInside(n)`. Both live in the stored book, next to the title.

**Uploaded pictures switch on and off.** Each one is stored as `{src, on}`, and only the ones that are on go into the treasure pool; a pool shorter than the treasure count simply repeats (`pool[i % pool.length]`), so one picture can fill all ten treasures. Old snapshots hold bare data URLs and read back as "all on".

**Book pages are editable.** Adding to the book does not reroll the editor, and clicking a shelf thumbnail loads that page's `{options, seed}` back into the controls (`selectPage` in `App.tsx`). Edits only reach the stored page when the user presses save — so the shelf never changes under them. Loading maps `options.treasures` back to a theme button via `themeIdOf`; a page whose treasures are no longer in the palette keeps the current theme rather than guessing.

**Difficulty** is a three-knob table in `src/maze/types.ts`: grid size, braid fraction, and route-length quantile ("windiness") — not just size.

**i18n** (`src/i18n.ts`): plain typed dictionaries, no framework. 5 languages including Hebrew with full RTL (`document.dir` flips at runtime). Adding a language = new `Lang` id + `LANGS` row + `Strings` entry + `SHARE_META` entry, then regenerate the share cards (below); the compiler flags anything missing. Printed PDF pages are localized too.

**Locale routing & link previews** (`src/share.ts` + the `localePages()` plugin in `vite.config.ts`): English is served at `/`, every other language at `/<lang>/`. The plugin emits one real HTML page per locale at build time — same JS bundle, but its own `<title>`, description, `og:*`/`twitter:*`, canonical and hreflang alternates — because link-preview crawlers never run our JS. At runtime the app resolves the language from `?lang=xx` → path prefix → `dd_lang` cookie → `navigator`, then normalizes the URL to the path form and re-applies the share tags via `applyShareHead`. `vercel.json` redirects `/he` → `/he/` so the share URL is always the canonical one.

**Share cards** (`public/og.png`, `public/og-<lang>.png`): one 1200×630 card per locale, drawn by `scripts/og/` using the app's own `drawMaze`, so the card and the printed page come from the same renderer. Regenerate after touching `LANGS`, `appTitle` or `tagline`:

```bash
node scripts/og/write-server.mjs           # terminal 1 — writes into public/
npm run dev                                # terminal 2
open http://localhost:5173/scripts/og/index.html
```

The page renders all locales and POSTs each PNG to the writer; the RTL layout is mirrored. `scripts/` is type-checked by `npm run build` but never bundled (the only Rollup input is the root `index.html`).

**Persistence** (`src/persist.ts`). Two stores, chosen on purpose:

- **Language** — a `dd_lang` cookie, one year, `SameSite=Lax`. Small, and readable outside JS if an edge redirect ever fronts the locale pages.
- **Theme** — a `dd_theme` cookie (`light` | `dark`), same shape and lifetime. A cookie rather than localStorage for one reason: the no-flash script in `index.html` has to read it synchronously in `<head>`. No cookie means "follow the system".
- **Book + uploaded pictures** — `localStorage` under `dd_state_v1`, shaped `{ book: { title, solutions, cover, coverText, entries }, images: [{ src, on }] }`. Deliberately *not* a cookie: photos ride along as data URLs and blow past the ~4 KB limit, and a book has no business being sent up with every request.

Entries stay `{options, seed}` snapshots, so a restored book re-generates byte-identical mazes — this is the same determinism contract as above, now load-bearing across sessions too. Everything read back is validated (`parseOptions`, `isDataImage`) because localStorage is user-editable; a bad payload is dropped, never fed to `generateMaze`. `saveState` returns `false` when the browser refuses (quota, private mode) and the UI surfaces `Strings.bookNotSaved` rather than silently forgetting.

**Analytics** (`src/analytics.ts`): Vercel Web Analytics custom funnel events. Keep event props low-cardinality (enums/counts only).

## Notes

- `examples/` holds reference photos (HEIC) of a commercial maze book — deliberately not committed; don't add it to git.
- Deployed on Vercel (static `dist/`). The build output is now multi-page: `dist/index.html` plus `dist/<lang>/index.html` for each non-English locale, all sharing one JS bundle.
- `firebase.json` exists as an alternative host config, but only `vercel.json` carries the `/he` → `/he/` redirect; another host would need its own equivalent.
