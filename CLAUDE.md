# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Vite dev server with hot reload
npm run build    # tsc --noEmit (strict typecheck) + vite build → dist/
npm run preview  # serve the production build locally
```

There is no test script or lint config. `npm run build` is the correctness gate — TypeScript is strict with `noUnusedLocals`/`noUnusedParameters`, so unused code fails the build. For ad-hoc verification scripts (e.g. regenerating the maze invariant suite), run them with `npx tsx <script>`; `tsx` is a devDependency for exactly this.

## Feature pipeline

`main` is production (Vercel deploys it on push). For any user-facing change:

1. Branch: `git checkout -b feature/<name>`.
2. Implement; `npm run build` must pass, and regenerate the invariant suite if generation logic changed.
3. Commit (as Abbabon) and push the branch; the user tests it (`npm run dev` locally or the Vercel preview deploy) before it merges.
4. Merge to `main` only after the user approves. Trivial fixes (copy, typos) may go straight to `main` when the user says so.

## What this is

A fully client-side React + Vite app that generates printable kids' mazes and exports them as A4 PDFs (single pages or a multi-maze "book"). No backend; uploaded treasure images stay in browser memory as data URLs.

## Architecture

Data flow: `App.tsx` (UI state) → `maze/generate.ts` (pure, seeded generation) → `render/draw.ts` (one canvas renderer for preview, thumbnails, and PDF pages) → `pdf.ts` (jsPDF assembly).

**Determinism is load-bearing.** Generation is seeded (mulberry32); the same `{options, seed}` always reproduces the same maze. Book entries are stored only as `{options, seed}` snapshots and re-generated on demand — never break reproducibility of `generateMaze`.

**Generation pipeline** (`src/maze/generate.ts`), in order: shape mask (`shapes.ts`, implicit functions; disconnected pockets dropped) → DFS carve (perfect maze) → door placement (exit chosen by route-length quantile, tuned per difficulty) → decoy doors (walled off into guaranteed dead ends) → treasures spread along the solution path → braiding (opening dead ends into loops on easy levels) → rooms around treasures.

**Safety invariants.** Braiding and rooms mutate a maze that already has decoys and treasures, so every individual wall removal is validated and reverted if any of these breaks:
1. exit stays reachable from start;
2. every decoy door stays disconnected from start;
3. every treasure remains a cut vertex (no route can bypass it).

Any change to the pipeline must preserve these. The historical invariant suite generated 5 shapes × 5 difficulties × 25 seeds (625 mazes) and asserted all three plus solvability — recreate something equivalent when touching generation logic.

**Rendering** (`src/render/draw.ts`): the same renderer draws the 900 px preview, 300 px book thumbnails, and 2480 px (~300 dpi A4) PDF pages, so preview = print. Draw order is part of correctness: solution line → treasures → walls on top. Treasure icons must fit inside one cell and never cover a wall.

**Difficulty** is a three-knob table in `src/maze/types.ts`: grid size, braid fraction, and route-length quantile ("windiness") — not just size.

**i18n** (`src/i18n.ts`): plain typed dictionaries, no framework. 5 languages including Hebrew with full RTL (`document.dir` flips at runtime). Adding a language = new `Lang` id + `LANGS` row + `Strings` entry; the compiler flags anything missing. Printed PDF pages are localized too.

**Analytics** (`src/analytics.ts`): Vercel Web Analytics custom funnel events. Keep event props low-cardinality (enums/counts only).

## Notes

- `examples/` holds reference photos (HEIC) of a commercial maze book — deliberately not committed; don't add it to git.
- Deployed on Vercel (static `dist/`); `firebase.json` exists as an alternative host config.
