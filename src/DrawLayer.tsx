import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

/** A crayon box that reads on white paper and in both themes. */
export const DRAW_COLOURS = [
  '#4a4034', // pencil
  '#e2574c', // red
  '#f08a3c', // orange
  '#3f9a5c', // green
  '#3f7fc4', // blue
  '#8a5fc0', // purple
] as const;

/** Stroke widths in canvas units, sized against the 900px preview. */
export const DRAW_WIDTHS = [4, 9, 18] as const;

export interface DrawTool {
  colour: string;
  width: number;
  erasing: boolean;
}

interface Stroke {
  colour: string;
  width: number;
  erasing: boolean;
  /** points in canvas coordinates */
  points: [number, number][];
}

export interface DrawLayerHandle {
  undo: () => void;
  clear: () => void;
}

interface Props {
  /** backing-store size, matched to the preview canvas so lines stay crisp */
  width: number;
  height: number;
  tool: DrawTool;
  /** bumping this wipes the drawing — a new maze is a new sheet */
  sheetKey: string;
  onCountChange: (count: number) => void;
}

/**
 * A sheet of acetate over the preview.
 *
 * It is deliberately its own canvas: the maze underneath is re-rendered on
 * every knob turn and every animation frame, so anything drawn into it would
 * be wiped constantly. Strokes are kept as points and replayed, which is what
 * makes undo a one-liner.
 *
 * Screen-only by design — nothing here reaches render/draw.ts, so the PDF
 * still prints a clean maze to solve with a real pencil.
 */
export const DrawLayer = forwardRef<DrawLayerHandle, Props>(function DrawLayer(
  { width, height, tool, sheetKey, onCountChange },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const drawingRef = useRef<Stroke | null>(null);

  const repaint = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const stroke of strokesRef.current) paintStroke(ctx, stroke);
    if (drawingRef.current) paintStroke(ctx, drawingRef.current);
  };

  // a different maze is a different sheet of paper
  useEffect(() => {
    strokesRef.current = [];
    drawingRef.current = null;
    onCountChange(0);
    repaint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetKey]);

  // the backing store changes with the difficulty; redraw what was there
  useEffect(repaint, [width, height]);

  useImperativeHandle(ref, () => ({
    undo() {
      strokesRef.current = strokesRef.current.slice(0, -1);
      onCountChange(strokesRef.current.length);
      repaint();
    },
    clear() {
      strokesRef.current = [];
      onCountChange(0);
      repaint();
    },
  }));

  /** Pointer position in canvas units. The canvas is displayed at whatever
   *  size the layout gives it, so every event has to be scaled back. */
  const at = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const box = e.currentTarget.getBoundingClientRect();
    return [
      ((e.clientX - box.left) / box.width) * width,
      ((e.clientY - box.top) / box.height) * height,
    ];
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = { ...tool, points: [at(e)] };
    repaint();
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const stroke = drawingRef.current;
    if (!stroke) return;
    stroke.points.push(at(e));
    repaint();
  };

  const end = () => {
    const stroke = drawingRef.current;
    drawingRef.current = null;
    if (!stroke) return;
    // a tap is a dot, and a dot is worth keeping
    strokesRef.current = [...strokesRef.current, stroke];
    onCountChange(strokesRef.current.length);
    repaint();
  };

  return (
    <canvas
      ref={canvasRef}
      className="draw-layer"
      width={width}
      height={height}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    />
  );
});

function paintStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  const { points, colour, width, erasing } = stroke;
  ctx.globalCompositeOperation = erasing ? 'destination-out' : 'source-over';
  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;
  ctx.lineWidth = erasing ? width * 2.4 : width;
  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(points[0][0], points[0][1], ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    // midpoint smoothing, so a fast drag is a curve rather than a polygon
    for (let i = 1; i < points.length - 1; i++) {
      const [x, y] = points[i];
      const [nx, ny] = points[i + 1];
      ctx.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
    }
    ctx.lineTo(points[points.length - 1][0], points[points.length - 1][1]);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
}
