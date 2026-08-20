import type { Canvas, CanvasKit, Font, Paint, Path } from "canvaskit-wasm";
import { renderingState } from "../../state/rendering/rendering.state.ts";
import type {
  Fill,
  RgbColor,
  SceneGraph,
  SceneNode,
  ScenePrimitive,
  Stroke,
  TextPrim,
} from "../dexpi/types.ts";
import type { SceneFonts } from "./fonts.ts";
import type { PaletteColor, ScenePalette } from "./scenePalette.ts";
import type { Viewport } from "./viewport.ts";

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

type DrawContext = Readonly<{
  ck: CanvasKit;
  canvas: Canvas;
  palette: ScenePalette;
  fonts: SceneFonts | null;
  /** Below this width (mm) a stroke is clamped up, so lines stay visible. */
  minWidthMm: number;
  widthScale: number;
  darkTheme: boolean;
  /**
   * Spec "scaled symbols" heuristic (vector-effect: non-scaling-stroke):
   * stroke widths inside a scaled ShapeUsage divide by the symbol scale so
   * they render at their authored width.
   */
  strokeDivisor: number;
  /** When set, everything draws in this color (selection/hover pass). */
  overrideColor: PaletteColor | null;
}>;

export type SceneHighlight = Readonly<{
  selectedIds: ReadonlySet<string>;
  hoveredId: string | null;
  /** Trace overlay memberships (amber / green passes). */
  upstreamIds: ReadonlySet<string>;
  downstreamIds: ReadonlySet<string>;
}>;

// -----------------------------------------------------------------------------
// Color & paint helpers
// -----------------------------------------------------------------------------

/**
 * DEXPI colors assume dark ink on white paper. On the dark theme, near-black
 * ink would vanish and white masking fills would glare — remap both to the
 * palette (ink/paper) while leaving real colors (red trims, blue signals…)
 * untouched.
 */
function adaptColor(ctx: DrawContext, color: RgbColor): readonly [number, number, number, number] {
  const { r, g, b } = color;
  if (ctx.darkTheme) {
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const saturation = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    if (saturation < 0.15 && luminance < 0.35) {
      return [ctx.palette.ink[0], ctx.palette.ink[1], ctx.palette.ink[2], 1];
    }

    if (saturation < 0.15 && luminance > 0.9) {
      return [ctx.palette.paper[0], ctx.palette.paper[1], ctx.palette.paper[2], 1];
    }
  }
  return [r / 255, g / 255, b / 255, 1];
}

function makeStrokePaint(ctx: DrawContext, stroke: Stroke): Paint {
  const paint = new ctx.ck.Paint();
  if (ctx.overrideColor) {
    paint.setColor(ctx.ck.Color4f(...ctx.overrideColor));
  } else {
    paint.setColor(ctx.ck.Color4f(...adaptColor(ctx, stroke.color)));
  }
  paint.setStyle(ctx.ck.PaintStyle.Stroke);
  paint.setStrokeWidth(Math.max(stroke.width * ctx.widthScale, ctx.minWidthMm) / ctx.strokeDivisor);
  paint.setStrokeCap(ctx.ck.StrokeCap.Round);
  paint.setStrokeJoin(ctx.ck.StrokeJoin.Round);
  paint.setAntiAlias(true);
  if (stroke.dash.length > 0 && !ctx.overrideColor) {
    const effect = ctx.ck.PathEffect.MakeDash([...stroke.dash], 0);
    paint.setPathEffect(effect);
    effect.delete();
  }
  return paint;
}

function makeFillPaint(ctx: DrawContext, color: RgbColor): Paint {
  const paint = new ctx.ck.Paint();
  if (ctx.overrideColor) {
    const [r, g, b, a] = ctx.overrideColor;
    paint.setColor(ctx.ck.Color4f(r, g, b, a * 0.35));
  } else {
    paint.setColor(ctx.ck.Color4f(...adaptColor(ctx, color)));
  }
  paint.setStyle(ctx.ck.PaintStyle.Fill);
  paint.setAntiAlias(true);
  return paint;
}

// -----------------------------------------------------------------------------
// Primitive drawing (canvas transform is already mm, y-up)
// -----------------------------------------------------------------------------

function polyPath(ctx: DrawContext, points: readonly { x: number; y: number }[], close: boolean) {
  const path = new ctx.ck.Path();
  points.forEach((p, i) => {
    if (i === 0) {
      path.moveTo(p.x, p.y);
    } else {
      path.lineTo(p.x, p.y);
    }
  });
  if (close) {
    path.close();
  }
  return path;
}

function drawText(ctx: DrawContext, prim: TextPrim): void {
  const typeface = ctx.fonts?.resolve(prim.font) ?? null;
  if (!typeface || prim.value.length === 0) {
    return;
  }

  const font: Font = new ctx.ck.Font(typeface, prim.size);
  // The font size is in drawing mm (tiny) and the canvas matrix scales it up;
  // hinted, pixel-quantized advances at that size read as random letter
  // spacing after scaling. Linear metrics + subpixel + no hinting keep
  // advances scale-independent.
  font.setSubpixel(true);
  font.setLinearMetrics(true);
  font.setHinting(ctx.ck.FontHinting.None);
  const ids = font.getGlyphIDs(prim.value);
  const widths = font.getGlyphWidths(ids);
  let textWidth = 0;
  for (const w of widths) {
    textWidth += w;
  }

  const dx = prim.hAlign === "Center" ? -textWidth / 2 : prim.hAlign === "Right" ? -textWidth : 0;
  const dy = prim.vAlign === "Center" ? 0.3 * prim.size : prim.vAlign === "Top" ? 0.8 * prim.size : 0;

  const paint = new ctx.ck.Paint();
  paint.setColor(ctx.ck.Color4f(...(ctx.overrideColor ?? adaptColor(ctx, prim.color))));
  paint.setStyle(ctx.ck.PaintStyle.Fill);
  paint.setAntiAlias(true);
  ctx.canvas.save();
  ctx.canvas.translate(prim.position.x, prim.position.y);
  if (prim.rotation !== 0) {
    ctx.canvas.rotate(prim.rotation, 0, 0);
  }
  ctx.canvas.drawText(prim.value, dx, dy, paint, font);
  ctx.canvas.restore();
  paint.delete();
  font.delete();
}

/**
 * Fills `path` (already in the current coordinate frame) per the fill style.
 * Hatch follows the spec's example SVGs: stroke-colored lines at 45°
 * (pattern rotate(315)), one through the visual center, spacing scaled by
 * the stroke width. Under a highlight override, hatch renders like solid.
 */
function drawFill(ctx: DrawContext, path: Path, fill: Fill, strokeWidthMm: number): void {
  if (fill.style === "Transparent") {
    return;
  }

  if (fill.style === "Solid" || ctx.overrideColor) {
    const paint = makeFillPaint(ctx, fill.color);
    ctx.canvas.drawPath(path, paint);
    paint.delete();
    return;
  }

  const bounds = path.getBounds();
  const left = bounds[0] ?? 0;
  const top = bounds[1] ?? 0;
  const right = bounds[2] ?? 0;
  const bottom = bounds[3] ?? 0;
  const cx = (left + right) / 2;
  const cy = (top + bottom) / 2;
  const diag = Math.hypot(right - left, bottom - top);
  const spacing = Math.min(Math.max(strokeWidthMm * 10, 1), 20);
  const lineCount = Math.ceil(diag / spacing);

  ctx.canvas.save();
  ctx.canvas.clipPath(path, ctx.ck.ClipOp.Intersect, true);
  const paint = makeStrokePaint(ctx, { color: fill.color, width: strokeWidthMm, dash: [] });
  for (let k = -lineCount; k <= lineCount; k++) {
    const px = cx + k * spacing * Math.SQRT1_2;
    const py = cy + k * spacing * Math.SQRT1_2;
    ctx.canvas.drawLine(
      px - diag * Math.SQRT1_2,
      py + diag * Math.SQRT1_2,
      px + diag * Math.SQRT1_2,
      py - diag * Math.SQRT1_2,
      paint,
    );
  }
  paint.delete();
  ctx.canvas.restore();
}

function drawPrimitive(ctx: DrawContext, prim: ScenePrimitive): void {
  const { ck, canvas } = ctx;
  switch (prim.kind) {
    case "polyline": {
      if (prim.points.length < 2) {
        return;
      }

      const path = polyPath(ctx, prim.points, false);
      const paint = makeStrokePaint(ctx, prim.stroke);
      canvas.drawPath(path, paint);
      paint.delete();
      path.delete();
      break;
    }
    case "polygon": {
      if (prim.points.length < 2) {
        return;
      }

      const path = polyPath(ctx, prim.points, true);
      drawFill(ctx, path, prim.fill, prim.stroke.width);
      const paint = makeStrokePaint(ctx, prim.stroke);
      canvas.drawPath(path, paint);
      paint.delete();
      path.delete();
      break;
    }
    case "circle": {
      if (prim.fill.style !== "Transparent") {
        const path = new ck.Path();
        path.addOval(
          ck.LTRBRect(
            prim.center.x - prim.radius,
            prim.center.y - prim.radius,
            prim.center.x + prim.radius,
            prim.center.y + prim.radius,
          ),
        );
        drawFill(ctx, path, prim.fill, prim.stroke.width);
        path.delete();
      }
      const paint = makeStrokePaint(ctx, prim.stroke);
      canvas.drawCircle(prim.center.x, prim.center.y, prim.radius, paint);
      paint.delete();
      break;
    }
    case "ellipse": {
      const rect = ck.LTRBRect(-prim.rx, -prim.ry, prim.rx, prim.ry);
      canvas.save();
      canvas.translate(prim.center.x, prim.center.y);
      if (prim.rotation !== 0) {
        canvas.rotate(prim.rotation, 0, 0);
      }
      if (prim.fill.style !== "Transparent") {
        const path = new ck.Path();
        path.addOval(rect);
        drawFill(ctx, path, prim.fill, prim.stroke.width);
        path.delete();
      }
      const paint = makeStrokePaint(ctx, prim.stroke);
      canvas.drawOval(rect, paint);
      paint.delete();
      canvas.restore();
      break;
    }
    case "ellipseArc": {
      const rect = ck.LTRBRect(-prim.rx, -prim.ry, prim.rx, prim.ry);
      // Spec: the arc runs from StartAngle in POSITIVE direction (clockwise
      // in the y-down drawing space) to EndAngle — wrap when end < start.
      let sweep = prim.endAngle - prim.startAngle;
      if (sweep <= 0) {
        sweep += 360;
      }
      const path = new ck.Path();
      path.arcToOval(rect, prim.startAngle, sweep, true);
      canvas.save();
      canvas.translate(prim.center.x, prim.center.y);
      if (prim.rotation !== 0) {
        canvas.rotate(prim.rotation, 0, 0);
      }
      const paint = makeStrokePaint(ctx, prim.stroke);
      canvas.drawPath(path, paint);
      paint.delete();
      canvas.restore();
      path.delete();
      break;
    }
    case "rect": {
      const rect = ck.LTRBRect(-prim.width / 2, -prim.height / 2, prim.width / 2, prim.height / 2);
      canvas.save();
      canvas.translate(prim.center.x, prim.center.y);
      if (prim.rotation !== 0) {
        canvas.rotate(prim.rotation, 0, 0);
      }
      if (prim.fill.style !== "Transparent") {
        const path = new ck.Path();
        path.addRect(rect);
        drawFill(ctx, path, prim.fill, prim.stroke.width);
        path.delete();
      }
      const paint = makeStrokePaint(ctx, prim.stroke);
      canvas.drawRect(rect, paint);
      paint.delete();
      canvas.restore();
      break;
    }
    case "text":
      drawText(ctx, prim);
      break;
  }
}

function drawNode(ctx: DrawContext, scene: SceneGraph, node: SceneNode): void {
  if (node.kind === "prim") {
    drawPrimitive(ctx, node.prim);
    return;
  }

  const shape = scene.shapes.get(node.shapeId);
  if (!shape) {
    return;
  }

  const { canvas } = ctx;
  const t = node.transform;
  canvas.save();
  canvas.translate(t.position.x, t.position.y);
  if (t.rotation !== 0) {
    canvas.rotate(t.rotation, 0, 0);
  }
  canvas.scale(t.isMirrored ? -t.scaleX : t.scaleX, t.scaleY);
  const symbolScale = Math.max(Math.abs(t.scaleX) || 1, Math.abs(t.scaleY) || 1);
  const useCtx: DrawContext =
    symbolScale === 1 ? ctx : { ...ctx, strokeDivisor: ctx.strokeDivisor * symbolScale };
  for (const prim of shape.primitives) {
    drawPrimitive(useCtx, prim);
  }
  canvas.restore();
}

// -----------------------------------------------------------------------------
// Entry point
// -----------------------------------------------------------------------------

const PAPER_MARGIN_MM = 5;

/** Zoom-dependent stroke parameters shared by the content and highlight passes. */
export type SceneDrawOptions = Readonly<{
  /** Below this width (mm) strokes clamp up (= minStrokePx / viewport.scale). */
  minWidthMm: number;
  widthScale: number;
}>;

function makeContext(
  ck: CanvasKit,
  canvas: Canvas,
  palette: ScenePalette,
  fonts: SceneFonts | null,
  options: SceneDrawOptions,
): DrawContext {
  return {
    ck,
    canvas,
    palette,
    fonts,
    minWidthMm: options.minWidthMm,
    widthScale: options.widthScale,
    darkTheme: palette.isDark,
    strokeDivisor: 1,
    overrideColor: null,
  };
}

/**
 * The scene body (paper + every node) in raw drawing-mm coordinates — the
 * caller owns the canvas matrix. Recordable into an SkPicture for cheap
 * replay while panning/hovering.
 */
export function drawSceneContent(
  ck: CanvasKit,
  canvas: Canvas,
  scene: SceneGraph,
  palette: ScenePalette,
  fonts: SceneFonts | null,
  options: SceneDrawOptions,
): void {
  const ctx = makeContext(ck, canvas, palette, fonts, options);
  const b = scene.bounds;
  const paper = new ck.Paint();
  paper.setColor(ck.Color4f(...palette.paper));
  paper.setAntiAlias(true);
  canvas.drawRect(
    ck.LTRBRect(
      b.minX - PAPER_MARGIN_MM,
      b.minY - PAPER_MARGIN_MM,
      b.maxX + PAPER_MARGIN_MM,
      b.maxY + PAPER_MARGIN_MM,
    ),
    paper,
  );
  paper.delete();

  for (const node of scene.nodes) {
    drawNode(ctx, scene, node);
  }
}

/** The selection/hover/trace overlays, in raw drawing-mm coordinates. */
export function drawSceneHighlights(
  ck: CanvasKit,
  canvas: Canvas,
  scene: SceneGraph,
  palette: ScenePalette,
  fonts: SceneFonts | null,
  options: SceneDrawOptions,
  highlight: SceneHighlight,
): void {
  const ctx = makeContext(ck, canvas, palette, fonts, options);
  drawHighlightPass(ctx, scene, highlight.upstreamIds, palette.traceUp);
  drawHighlightPass(ctx, scene, highlight.downstreamIds, palette.traceDown);
  drawHighlightPass(ctx, scene, singleton(highlight.hoveredId), [
    palette.accent[0],
    palette.accent[1],
    palette.accent[2],
    0.5,
  ]);
  drawHighlightPass(ctx, scene, highlight.selectedIds, palette.accent);
}

/** The mm→device-px canvas matrix for a viewport. */
export function viewportMatrix(viewport: Viewport, dpr: number): number[] {
  return [
    viewport.scale * dpr,
    0,
    viewport.offsetX * dpr,
    0,
    viewport.scale * dpr,
    viewport.offsetY * dpr,
    0,
    0,
    1,
  ];
}

/**
 * Renders a parsed DEXPI scene in one go (exports, minimap). The whole pass
 * runs under one canvas matrix mapping drawing mm to device px — DEXPI 2.0
 * coordinates are y-down like SVG and Skia, so no axis flip anywhere. The
 * interactive stage uses drawSceneContent/drawSceneHighlights directly with
 * a cached picture instead.
 */
export function drawDexpiScene(
  ck: CanvasKit,
  canvas: Canvas,
  scene: SceneGraph,
  viewport: Viewport,
  palette: ScenePalette,
  dpr: number,
  fonts: SceneFonts | null,
  highlight: SceneHighlight,
): void {
  const rendering = renderingState.get();
  const options: SceneDrawOptions = {
    minWidthMm: rendering.minStrokePx / Math.max(viewport.scale, 1e-9),
    widthScale: rendering.strokeWidthScale,
  };

  canvas.clear(ck.Color4f(...palette.background));
  canvas.save();
  canvas.concat(viewportMatrix(viewport, dpr));
  drawSceneContent(ck, canvas, scene, palette, fonts, options);
  drawSceneHighlights(ck, canvas, scene, palette, fonts, options, highlight);
  canvas.restore();
}

const EMPTY_SET: ReadonlySet<string> = new Set();

function singleton(objectId: string | null): ReadonlySet<string> {
  return objectId ? new Set([objectId]) : EMPTY_SET;
}

/** Redraws every node representing one of `objectIds` in the given color, on top. */
function drawHighlightPass(
  ctx: DrawContext,
  scene: SceneGraph,
  objectIds: ReadonlySet<string>,
  color: PaletteColor,
): void {
  if (objectIds.size === 0) {
    return;
  }

  const highlightCtx: DrawContext = {
    ...ctx,
    overrideColor: color,
    minWidthMm: ctx.minWidthMm * 2.5,
  };
  for (const node of scene.nodes) {
    if (node.objectId && objectIds.has(node.objectId)) {
      drawNode(highlightCtx, scene, node);
    }
  }
}
