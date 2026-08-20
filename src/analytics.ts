import { track } from '@vercel/analytics';
import type { MazeOptions } from './maze/types';
import type { Lang } from './i18n';

/**
 * Funnel we care about (each step is a named event, page views are automatic):
 *
 *   visit  →  engage (maze_rerolled / solution_peeked / pictures_uploaded)
 *          →  convert (pdf_downloaded)
 *          →  deepen (book_maze_added → book_downloaded)
 *
 * Every event carries low-cardinality props (difficulty, shape, counts) so we
 * can break the funnel down by configuration without exploding event space.
 */

type Props = Record<string, string | number | boolean>;

function send(name: string, props?: Props): void {
  try {
    track(name, props);
  } catch {
    // analytics must never break the app
  }
}

function mazeProps(options: MazeOptions): Props {
  return {
    difficulty: options.difficulty,
    shape: options.shape,
    doors: options.entrances + options.exits,
    treasures: options.treasures.length,
    customPictures: options.treasures.some((t) => t.kind === 'image'),
  };
}

export const analytics = {
  /** engagement: user hit 🎲 to explore variations */
  mazeRerolled(options: MazeOptions): void {
    send('maze_rerolled', { difficulty: options.difficulty, shape: options.shape });
  },

  /** engagement: user toggled the solution overlay on */
  solutionPeeked(): void {
    send('solution_peeked');
  },

  /** engagement: user invested in personalization */
  picturesUploaded(count: number): void {
    send('pictures_uploaded', { count });
  },

  /** conversion: a single-maze PDF left the site */
  pdfDownloaded(options: MazeOptions, withSolution: boolean): void {
    send('pdf_downloaded', { ...mazeProps(options), withSolution });
  },

  /** deepening: user is building a book */
  bookMazeAdded(options: MazeOptions, bookSize: number): void {
    send('book_maze_added', { ...mazeProps(options), bookSize });
  },

  /** deepest conversion: a whole book PDF left the site */
  bookDownloaded(mazeCount: number, withSolutions: boolean): void {
    send('book_downloaded', { mazes: mazeCount, withSolutions });
  },

  /** localization demand signal */
  languageChanged(lang: Lang): void {
    send('language_changed', { lang });
  },
};
