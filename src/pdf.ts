import { jsPDF } from 'jspdf';
import type { Maze } from './maze/types';
import type { Strings } from './i18n';
import { PAGE_W_MM, PAGE_H_MM, renderMazePage, renderCoverPage } from './render/draw';
import { loadTreasureImages, mazeTreasures } from './render/images';

const PDF_PIXEL_WIDTH = 2480; // ~300 dpi for A4

/**
 * jsPDF re-encodes an RGBA canvas PNG into a raw RGB image plus an alpha mask,
 * and stores both *uncompressed* unless a compression level is passed — 26 MB
 * of pixels per A4 page, which is how a seven-maze book once weighed 250 MB.
 *
 * 'SLOW' (deflate level 9 with a Paeth predictor) is the right trade here: a
 * fraction of a second per page, and on white-dominated line art it takes that
 * same book to ~2 MB. It is lossless, so the print is still exactly what the
 * preview showed. Don't drop this argument — the default is "no compression".
 */
const PDF_IMAGE_COMPRESSION = 'SLOW';

/** Draws one A4 page onto a fresh canvas. */
type DrawPage = (canvas: HTMLCanvasElement) => void;

/**
 * Reports how many pages are finished. `total` is 0 while treasure pictures are
 * still loading and we don't yet know how many pages there will be.
 */
export type PdfProgress = (done: number, total: number) => void;

function pageToPdf(pdf: jsPDF, draw: DrawPage, first: boolean): void {
  const canvas = document.createElement('canvas');
  draw(canvas);
  if (!first) pdf.addPage();
  pdf.addImage(
    canvas.toDataURL('image/png'),
    'PNG',
    0,
    0,
    PAGE_W_MM,
    PAGE_H_MM,
    undefined,
    PDF_IMAGE_COMPRESSION,
  );
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => setTimeout(resolve, 0));
  });
}

/**
 * Render every page into the document, reporting progress as we go.
 *
 * Drawing and compressing a 2480 px page blocks the main thread for a good
 * fraction of a second, so we hand the browser a frame to paint in before each
 * one. Without that yield the counter would never reach the screen — it would
 * sit at zero and then jump straight to "saved", which is exactly the silence
 * that makes people press the button a second time.
 */
async function renderPages(pdf: jsPDF, pages: DrawPage[], onProgress?: PdfProgress): Promise<void> {
  for (let i = 0; i < pages.length; i++) {
    onProgress?.(i, pages.length);
    await nextFrame();
    pageToPdf(pdf, pages[i], i === 0);
  }
  onProgress?.(pages.length, pages.length);
}

export interface BookEntry {
  maze: Maze;
  title: string;
}

export async function downloadMazePdf(
  maze: Maze,
  title: string,
  includeSolution: boolean,
  t: Strings,
  onProgress?: PdfProgress,
): Promise<void> {
  const images = await loadTreasureImages(mazeTreasures([maze]));
  const difficultyLabel = t.difficulty[maze.options.difficulty];
  const pages: DrawPage[] = [
    (c) => renderMazePage(c, maze, PDF_PIXEL_WIDTH, { title, difficultyLabel, images }),
  ];
  if (includeSolution) {
    pages.push((c) =>
      renderMazePage(c, maze, PDF_PIXEL_WIDTH, {
        title: `${title} — ${t.solution}`,
        difficultyLabel,
        showSolution: true,
        images,
      }),
    );
  }
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  await renderPages(pdf, pages, onProgress);
  pdf.save(`${safeName(title)}.pdf`);
}

export async function downloadBookPdf(
  bookTitle: string,
  entries: BookEntry[],
  includeSolutions: boolean,
  t: Strings,
  onProgress?: PdfProgress,
): Promise<void> {
  const images = await loadTreasureImages(mazeTreasures(entries.map((e) => e.maze)));
  const treasures = mazeTreasures(entries.map((e) => e.maze));
  const seen = new Set<string>();
  const unique = treasures.filter((tr) => {
    const k = tr.kind === 'emoji' ? tr.value : tr.src;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (!unique.length) unique.push({ kind: 'emoji', value: '🏰' }, { kind: 'emoji', value: '⭐' });

  const pages: DrawPage[] = [
    (c) =>
      renderCoverPage(c, PDF_PIXEL_WIDTH, bookTitle, t.mazesInside(entries.length), unique, images),
  ];
  entries.forEach((entry, i) => {
    pages.push((c) =>
      renderMazePage(c, entry.maze, PDF_PIXEL_WIDTH, {
        title: entry.title,
        difficultyLabel: t.difficulty[entry.maze.options.difficulty],
        pageNumber: i + 1,
        images,
      }),
    );
  });
  if (includeSolutions) {
    entries.forEach((entry, i) => {
      pages.push((c) =>
        renderMazePage(c, entry.maze, PDF_PIXEL_WIDTH, {
          title: `${t.solution} — ${entry.title}`,
          difficultyLabel: t.difficulty[entry.maze.options.difficulty],
          showSolution: true,
          pageNumber: entries.length + i + 1,
          images,
        }),
      );
    });
  }

  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  await renderPages(pdf, pages, onProgress);
  pdf.save(`${safeName(bookTitle)}.pdf`);
}

function safeName(s: string): string {
  return (s.trim() || 'maze').replace(/[^\p{L}\p{N} _-]/gu, '').replace(/\s+/g, '-').toLowerCase();
}
