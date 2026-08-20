import type { Maze, Treasure } from '../maze/types';
import type { ImageMap } from './draw';

const cache = new Map<string, Promise<HTMLImageElement>>();

function loadImage(src: string): Promise<HTMLImageElement> {
  let p = cache.get(src);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
    cache.set(src, p);
  }
  return p;
}

/** Resolve every picture-treasure into a ready-to-draw ImageMap. */
export async function loadTreasureImages(treasures: Treasure[]): Promise<ImageMap> {
  const srcs = [...new Set(treasures.filter((t) => t.kind === 'image').map((t) => (t as { src: string }).src))];
  const map: ImageMap = new Map();
  await Promise.all(
    srcs.map(async (src) => {
      try {
        map.set(src, await loadImage(src));
      } catch {
        // a broken image just won't be drawn; the white halo still marks the spot
      }
    }),
  );
  return map;
}

export function mazeTreasures(mazes: Maze[]): Treasure[] {
  return mazes.flatMap((m) => m.waypoints.map((w) => w.treasure));
}

/** Downscale an uploaded file to a small square-ish data URL for crisp, light storage. */
export function fileToTreasureDataUrl(file: File, maxDim = 384): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('unreadable image'));
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
