import { jsPDF } from 'jspdf';
import type { Maze } from './maze/types';
import type { Strings } from './i18n';
import { PAGE_W_MM, PAGE_H_MM, renderMazePage, renderCoverPage } from './render/draw';
import { loadTreasureImages, mazeTreasures } from './render/images';

const PDF_PIXEL_WIDTH = 2480; // ~300 dpi for A4

function pageToPdf(pdf: jsPDF, draw: (canvas: HTMLCanvasElement) => void, first: boolean): void {
  const canvas = document.createElement('canvas');
  draw(canvas);
  if (!first) pdf.addPage();
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, PAGE_W_MM, PAGE_H_MM);
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
): Promise<void> {
  const images = await loadTreasureImages(mazeTreasures([maze]));
  const difficultyLabel = t.difficulty[maze.options.difficulty];
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  pageToPdf(pdf, (c) => renderMazePage(c, maze, PDF_PIXEL_WIDTH, { title, difficultyLabel, images }), true);
  if (includeSolution) {
    pageToPdf(
      pdf,
      (c) =>
        renderMazePage(c, maze, PDF_PIXEL_WIDTH, {
          title: `${title} — ${t.solution}`,
          difficultyLabel,
          showSolution: true,
          images,
        }),
      false,
    );
  }
  pdf.save(`${safeName(title)}.pdf`);
}

export async function downloadBookPdf(
  bookTitle: string,
  entries: BookEntry[],
  includeSolutions: boolean,
  t: Strings,
): Promise<void> {
  const images = await loadTreasureImages(mazeTreasures(entries.map((e) => e.maze)));
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const treasures = mazeTreasures(entries.map((e) => e.maze));
  const seen = new Set<string>();
  const unique = treasures.filter((tr) => {
    const k = tr.kind === 'emoji' ? tr.value : tr.src;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (!unique.length) unique.push({ kind: 'emoji', value: '🏰' }, { kind: 'emoji', value: '⭐' });
  pageToPdf(
    pdf,
    (c) => renderCoverPage(c, PDF_PIXEL_WIDTH, bookTitle, t.mazesInside(entries.length), unique, images),
    true,
  );
  entries.forEach((entry, i) => {
    pageToPdf(
      pdf,
      (c) =>
        renderMazePage(c, entry.maze, PDF_PIXEL_WIDTH, {
          title: entry.title,
          difficultyLabel: t.difficulty[entry.maze.options.difficulty],
          pageNumber: i + 1,
          images,
        }),
      false,
    );
  });
  if (includeSolutions) {
    entries.forEach((entry, i) => {
      pageToPdf(
        pdf,
        (c) =>
          renderMazePage(c, entry.maze, PDF_PIXEL_WIDTH, {
            title: `${t.solution} — ${entry.title}`,
            difficultyLabel: t.difficulty[entry.maze.options.difficulty],
            showSolution: true,
            pageNumber: entries.length + i + 1,
            images,
          }),
        false,
      );
    });
  }
  pdf.save(`${safeName(bookTitle)}.pdf`);
}

function safeName(s: string): string {
  return (s.trim() || 'maze').replace(/[^\p{L}\p{N} _-]/gu, '').replace(/\s+/g, '-').toLowerCase();
}
