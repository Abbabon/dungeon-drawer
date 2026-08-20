---
name: run-dev
description: Launch the dungeon-drawer Vite dev server locally and verify or drive it. Use when asked to run/start the app, or to visually confirm a change in the real app (preview canvas, sliders, PDF flow).
---

# Run the dev server

## Launch

Start Vite in the background (it blocks the shell otherwise):

- `npm run dev` with `run_in_background: true`
- Wait ~2s, then read the task's output file and grep for `Local` to get the
  real URL — normally `http://localhost:5173/`, but Vite silently picks the
  next free port if 5173 is taken, so never assume.

Quick smoke check (the app is fully client-rendered, so this only proves the
server is up, not that the app works):

```bash
curl -s http://localhost:5173/ | grep -q '<div id="root">' && echo up
```

## Drive it (visual verification)

The Claude-in-Chrome extension may not be connected; the reliable fallback is
headless Playwright reusing the machine's cached browsers:

1. In the scratchpad: `npm install playwright-core --no-fund --no-audit`
2. Find the executable — the version dir changes, so glob for it:
   `ls ~/Library/Caches/ms-playwright/ | grep chromium_headless_shell` →
   executable is `<that dir>/chrome-headless-shell-mac-arm64/chrome-headless-shell`
3. Launch with `chromium.launch({ executablePath, headless: true })`,
   viewport ~1500×1100 so the whole page fits.

Useful selectors/interactions in the app:

- `.preview-canvas` — the rendered maze page; screenshot this element.
  Wait for it, then ~800ms more (maze regenerates + images load async).
- `input[type=range]` — index 0 is treasure count, index 1 is treasure size.
  Use `.fill('3')` (fires the right events; don't drag).
- Difficulty/shape are buttons found by visible text, e.g.
  `page.getByText('Circle', { exact: true })`.
- `page.getByText('Peek at solution')` toggles the solution overlay.

**Look at the screenshots** — a blank canvas means the app failed, not passed.

## Cleanup

Stop the background task with TaskStop when done, unless the user wants the
server left running to test in their own browser.
