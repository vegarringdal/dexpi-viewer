import type { Canvas, CanvasKit, Paint } from "canvaskit-wasm";
import { renderingState } from "../../state/rendering/rendering.state.ts";
import type { ScenePalette } from "./scenePalette.ts";
import type { BoundsMm, Viewport } from "./viewport.ts";

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** A3 landscape sheet, the usual P&ID paper size. */
export const SHEET_BOUNDS: BoundsMm = { minX: 0, minY: 0, maxX: 420, maxY: 297 };

const GRID_STEP_MM = 10;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

type SceneContext = Readonly<{
  ck: CanvasKit;
  canvas: Canvas;
  viewport: Viewport;
  dpr: number;
}>;

function strokeWidthPx(ctx: SceneContext, widthMm: number): number {
  const { minStrokePx, strokeWidthScale } = renderingState.get();
  return Math.max(widthMm * strokeWidthScale * ctx.viewport.scale, minStrokePx) * ctx.dpr;
}

function makeStroke(ctx: SceneContext, color: readonly number[], widthMm: number): Paint {
  const paint = new ctx.ck.Paint();
  paint.setColor(ctx.ck.Color4f(color[0] ?? 0, color[1] ?? 0, color[2] ?? 0, color[3] ?? 1));
  paint.setStyle(ctx.ck.PaintStyle.Stroke);
  paint.setStrokeWidth(strokeWidthPx(ctx, widthMm));
  paint.setAntiAlias(true);
  return paint;
}

function makeFill(ctx: SceneContext, color: readonly number[]): Paint {
  const paint = new ctx.ck.Paint();
  paint.setColor(ctx.ck.Color4f(color[0] ?? 0, color[1] ?? 0, color[2] ?? 0, color[3] ?? 1));
  paint.setStyle(ctx.ck.PaintStyle.Fill);
  paint.setAntiAlias(true);
  return paint;
}

function drawPolylineMm(
  ctx: SceneContext,
  points: readonly (readonly [number, number])[],
  paint: Paint,
): void {
  const path = new ctx.ck.Path();
  points.forEach(([xMm, yMm], index) => {
    const p = ctx.viewport.toScreen({ xMm, yMm });
    if (index === 0) {
      path.moveTo(p.xPx * ctx.dpr, p.yPx * ctx.dpr);
    } else {
      path.lineTo(p.xPx * ctx.dpr, p.yPx * ctx.dpr);
    }
  });
  ctx.canvas.drawPath(path, paint);
  path.delete();
}

function drawCircleMm(ctx: SceneContext, cxMm: number, cyMm: number, rMm: number, paint: Paint): void {
  const c = ctx.viewport.toScreen({ xMm: cxMm, yMm: cyMm });
  ctx.canvas.drawCircle(c.xPx * ctx.dpr, c.yPx * ctx.dpr, rMm * ctx.viewport.scale * ctx.dpr, paint);
}

function drawGrid(ctx: SceneContext, paint: Paint): void {
  for (let x = SHEET_BOUNDS.minX; x <= SHEET_BOUNDS.maxX; x += GRID_STEP_MM) {
    drawPolylineMm(
      ctx,
      [
        [x, SHEET_BOUNDS.minY],
        [x, SHEET_BOUNDS.maxY],
      ],
      paint,
    );
  }
  for (let y = SHEET_BOUNDS.minY; y <= SHEET_BOUNDS.maxY; y += GRID_STEP_MM) {
    drawPolylineMm(
      ctx,
      [
        [SHEET_BOUNDS.minX, y],
        [SHEET_BOUNDS.maxX, y],
      ],
      paint,
    );
  }
}

/** A tank, a pump, a valve and their piping — stand-ins until M2/M3 render real files. */
function drawDemoSymbols(ctx: SceneContext, ink: Paint, accent: Paint): void {
  drawPolylineMm(
    ctx,
    [
      [80, 130],
      [80, 220],
      [140, 220],
      [140, 130],
      [80, 130],
    ],
    ink,
  );
  drawPolylineMm(
    ctx,
    [
      [80, 220],
      [110, 240],
      [140, 220],
    ],
    ink,
  );
  drawCircleMm(ctx, 200, 120, 14, ink);
  drawPolylineMm(
    ctx,
    [
      [193, 132],
      [207, 132],
    ],
    ink,
  );
  drawPolylineMm(
    ctx,
    [
      [110, 130],
      [110, 120],
      [186, 120],
    ],
    accent,
  );
  drawPolylineMm(
    ctx,
    [
      [214, 120],
      [280, 120],
    ],
    accent,
  );
  drawPolylineMm(
    ctx,
    [
      [280, 128],
      [296, 112],
      [280, 112],
      [296, 128],
      [280, 128],
    ],
    ink,
  );
  drawPolylineMm(
    ctx,
    [
      [296, 120],
      [360, 120],
      [360, 180],
    ],
    accent,
  );
}

// -----------------------------------------------------------------------------
// Entry point
// -----------------------------------------------------------------------------

/**
 * Draws the M0 placeholder: paper sheet, grid, and a few P&ID-style symbols.
 * All coordinates are drawing mm; `dpr` maps the viewport's CSS px to the
 * backing-store px CanvasKit draws in.
 */
export function drawPlaceholderScene(
  ck: CanvasKit,
  canvas: Canvas,
  viewport: Viewport,
  palette: ScenePalette,
  dpr: number,
): void {
  const ctx: SceneContext = { ck, canvas, viewport, dpr };
  canvas.clear(ck.Color4f(...palette.background));

  const paper = makeFill(ctx, palette.paper);
  const topLeft = viewport.toScreen({ xMm: SHEET_BOUNDS.minX, yMm: SHEET_BOUNDS.maxY });
  const bottomRight = viewport.toScreen({ xMm: SHEET_BOUNDS.maxX, yMm: SHEET_BOUNDS.minY });
  canvas.drawRect(
    ck.LTRBRect(topLeft.xPx * dpr, topLeft.yPx * dpr, bottomRight.xPx * dpr, bottomRight.yPx * dpr),
    paper,
  );
  paper.delete();

  if (renderingState.get().showGrid) {
    const grid = makeStroke(ctx, palette.grid, 0);
    drawGrid(ctx, grid);
    grid.delete();
  }

  const border = makeStroke(ctx, palette.paperBorder, 0.35);
  drawPolylineMm(
    ctx,
    [
      [0, 0],
      [420, 0],
      [420, 297],
      [0, 297],
      [0, 0],
    ],
    border,
  );
  border.delete();

  const ink = makeStroke(ctx, palette.ink, 0.5);
  const accent = makeStroke(ctx, palette.accent, 0.5);
  drawDemoSymbols(ctx, ink, accent);
  ink.delete();
  accent.delete();
}
