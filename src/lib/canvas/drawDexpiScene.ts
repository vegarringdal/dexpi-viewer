import type { Canvas, CanvasKit, Font, Paint, Path } from "canvaskit-wasm";
import { renderingState } from "../../state/rendering/rendering.state.ts";
import { baselineOffsetMm, layoutTextLines } from "../dexpi/textLayout.ts";
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
  monochrome: boolean;
  /**
   * Spec "scaled symbols" heuristic (vector-effect: non-scaling-stroke):
   * stroke widths inside a scaled ShapeUsage divide by the symbol scale so
   * they render at their authored width.
   */
  strokeDivisor: number;
  /**
   * Added to every stroke width on a halo pass, in drawing mm, so the halo
   * stays wider than the stroke redrawn over it at ANY zoom.
   */
  extraWidthMm: number;
  /** When set, everything draws in this color (selection/hover pass). */
  overrideColor: PaletteColor | null;
  /** Overrides `overrideColor` for GLYPHS only — the pass that re-draws
   *  selected text over its yellow backdrop needs dark ink, not accent blue. */
  glyphColor: PaletteColor | null;
  /** Halo pass: text draws as a filled backdrop rect instead of glyphs. */
  textBackdrop: boolean;
}>;

export type SceneHighlight = Readonly<{
  selectedIds: ReadonlySet<string>;
  hoveredId: string | null;
  /** Trace overlay memberships (amber / green passes). */
  upstreamIds: ReadonlySet<string>;
  downstreamIds: ReadonlySet<string>;
  /** Classification tint per object id — drawn below trace/hover/selection. */
  classification: ReadonlyMap<string, PaletteColor>;
  /** Veil the non-highlighted content so the classification tints pop. */
  dimOthers?: boolean;
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
  if (ctx.monochrome) {
    // Near-white stays paper — white masking fills must keep masking.
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.85
      ? [ctx.palette.paper[0], ctx.palette.paper[1], ctx.palette.paper[2], 1]
      : [ctx.palette.ink[0], ctx.palette.ink[1], ctx.palette.ink[2], 1];
  }
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
  const widthMm = Math.max(stroke.width * ctx.widthScale, ctx.minWidthMm) + ctx.extraWidthMm;
  paint.setStrokeWidth(widthMm / ctx.strokeDivisor);
  const isButt = stroke.rounding === "Butt";
  paint.setStrokeCap(isButt ? ctx.ck.StrokeCap.Butt : ctx.ck.StrokeCap.Round);
  paint.setStrokeJoin(isButt ? ctx.ck.StrokeJoin.Miter : ctx.ck.StrokeJoin.Round);
  paint.setAntiAlias(true);
  // Dash patterns survive highlight overrides: a selected heat-trace or
  // signal line must still read as dashed (director), or the selection
  // blue makes trace and pipe indistinguishable.
  if (stroke.dash.length > 0) {
    const effect = ctx.ck.PathEffect.MakeDash([...stroke.dash], stroke.dashOffset ?? 0);
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
// Primitive drawing (canvas transform is already mm, y-down)
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
  const measure = (text: string): number => {
    const widths = font.getGlyphWidths(font.getGlyphIDs(text));
    let total = 0;
    for (const w of widths) {
      total += w;
    }
    return total;
  };

  const dy = baselineOffsetMm(prim.size, prim.vAlign);

  if (ctx.textBackdrop && ctx.overrideColor) {
    drawTextBackdrop(ctx, prim, measure, dy);
    font.delete();
    return;
  }

  const paint = new ctx.ck.Paint();
  paint.setColor(ctx.ck.Color4f(...(ctx.glyphColor ?? ctx.overrideColor ?? adaptColor(ctx, prim.color))));
  paint.setStyle(ctx.ck.PaintStyle.Fill);
  paint.setAntiAlias(true);
  ctx.canvas.save();
  ctx.canvas.translate(prim.position.x, prim.position.y);
  if (prim.rotation !== 0) {
    ctx.canvas.rotate(prim.rotation, 0, 0);
  }
  // Each line measures and h-aligns on its own; the block rotates as one
  // unit because all lines draw inside the rotated frame.
  for (const line of layoutTextLines(prim.value, prim.size, prim.vAlign)) {
    if (line.value.length === 0) {
      continue;
    }

    const lineWidth = measure(line.value);
    const dx = prim.hAlign === "Center" ? -lineWidth / 2 : prim.hAlign === "Right" ? -lineWidth : 0;
    ctx.canvas.drawText(line.value, dx, dy + line.offsetY, paint, font);
  }
  ctx.canvas.restore();
  paint.delete();
  font.delete();
}

const TEXT_BACKDROP_PAD_MM = 0.4;

/**
 * The halo pass's stand-in for text: a filled rect behind the block (bold
 * glyph doubling reads blurry; a marker-pen rect reads as a highlight).
 */
function drawTextBackdrop(
  ctx: DrawContext,
  prim: TextPrim,
  measure: (text: string) => number,
  dy: number,
): void {
  const lines = layoutTextLines(prim.value, prim.size, prim.vAlign).filter((l) => l.value.length > 0);
  if (lines.length === 0 || !ctx.overrideColor) {
    return;
  }

  let minX = Infinity;
  let maxX = -Infinity;
  for (const line of lines) {
    const width = measure(line.value);
    const dx = prim.hAlign === "Center" ? -width / 2 : prim.hAlign === "Right" ? -width : 0;
    minX = Math.min(minX, dx);
    maxX = Math.max(maxX, dx + width);
  }
  const first = lines[0];
  const last = lines[lines.length - 1];
  if (!first || !last) {
    return;
  }

  const top = dy + first.offsetY - prim.size * 0.8;
  const bottom = dy + last.offsetY + prim.size * 0.25;
  const paint = new ctx.ck.Paint();
  // Opaque regardless of the halo color's alpha: the rect has to MASK the
  // glyphs the content pass already drew, or they ghost through the yellow
  // and the label reads muddy under the dark ink drawn on top.
  const [r, g, b] = ctx.overrideColor;
  paint.setColor(ctx.ck.Color4f(r, g, b, 1));
  paint.setStyle(ctx.ck.PaintStyle.Fill);
  paint.setAntiAlias(true);
  ctx.canvas.save();
  ctx.canvas.translate(prim.position.x, prim.position.y);
  if (prim.rotation !== 0) {
    ctx.canvas.rotate(prim.rotation, 0, 0);
  }
  ctx.canvas.drawRect(
    ctx.ck.LTRBRect(
      minX - TEXT_BACKDROP_PAD_MM,
      top - TEXT_BACKDROP_PAD_MM,
      maxX + TEXT_BACKDROP_PAD_MM,
      bottom + TEXT_BACKDROP_PAD_MM,
    ),
    paint,
  );
  ctx.canvas.restore();
  paint.delete();
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
  /** Drawing mm per screen px (= 1 / viewport.scale) — for zoom-invariant overlays. */
  mmPerPx: number;
  widthScale: number;
  /** Skip the opaque paper rect — an underlay behind the drawing must show through. */
  hidePaper?: boolean;
  /** Draw all content in ink/paper only, so highlight tints never collide
   *  with the drawing's own colors (blue signal text, magenta trims…). */
  monochrome?: boolean;
  /** Selected TEXT gets a filled yellow backdrop rect (Settings toggle). */
  selectionTextRect?: boolean;
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
    monochrome: options.monochrome === true,
    textBackdrop: false,
    strokeDivisor: 1,
    extraWidthMm: 0,
    overrideColor: null,
    glyphColor: null,
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
  if (!options.hidePaper) {
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
  }

  for (const node of scene.nodes) {
    drawNode(ctx, scene, node);
  }
}

/** The classification/selection/hover/trace overlays, in raw drawing-mm coordinates. */
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
  if (highlight.dimOthers === true && highlight.classification.size > 0) {
    drawDimVeil(ctx, scene);
  }
  drawClassificationPass(ctx, scene, highlight.classification);
  drawHighlightPass(ctx, scene, highlight.upstreamIds, palette.traceUp);
  drawHighlightPass(ctx, scene, highlight.downstreamIds, palette.traceDown);
  drawHighlightPass(ctx, scene, singleton(highlight.hoveredId), [
    palette.accent[0],
    palette.accent[1],
    palette.accent[2],
    0.5,
  ]);
  // Marker-pen halo: the selection's own geometry re-stroked thick in
  // yellow UNDER the blue pass (a bounding rect covered far too much);
  // text gets a filled yellow rect instead of doubled glyphs. The extra
  // width is in SCREEN px, not a factor on the min-width clamp — a factor
  // stops widening anything once zoom makes the clamp non-binding, and the
  // blue pass then covers the halo exactly.
  const backdropText = options.selectionTextRect !== false;
  drawHighlightPass(ctx, scene, highlight.selectedIds, palette.selectionFill, {
    extraWidthMm: SELECTION_HALO_PAD_PX * 2 * options.mmPerPx,
    textBackdrop: backdropText,
  });
  // The blue re-stroke would put light accent glyphs on that yellow rect —
  // unreadable (director). Text on a backdrop draws in dark ink instead.
  drawHighlightPass(ctx, scene, highlight.selectedIds, palette.accent, {
    glyphColor: backdropText ? palette.selectionInk : null,
  });
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
  const scale = Math.max(viewport.scale, 1e-9);
  const options: SceneDrawOptions = {
    minWidthMm: rendering.minStrokePx / scale,
    mmPerPx: 1 / scale,
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

/** Hairlines are clamped up further on overlay passes, so a tint stays readable. */
const HIGHLIGHT_MIN_WIDTH_FACTOR = 2.5;

/** The selection halo sticks out this many screen px on each side, at any zoom. */
const SELECTION_HALO_PAD_PX = 3;

function singleton(objectId: string | null): ReadonlySet<string> {
  return objectId ? new Set([objectId]) : EMPTY_SET;
}

/**
 * Redraws every node whose object has a classification tint, each in its
 * group's color, in one scan. Like all override passes this flattens dashes
 * and drops fills to translucent — acceptable for a highlight.
 */
function drawClassificationPass(
  ctx: DrawContext,
  scene: SceneGraph,
  classification: ReadonlyMap<string, PaletteColor>,
): void {
  if (classification.size === 0) {
    return;
  }

  for (const node of scene.nodes) {
    const color = node.objectId !== null ? classification.get(node.objectId) : undefined;
    if (color !== undefined) {
      drawNode(
        { ...ctx, overrideColor: color, minWidthMm: ctx.minWidthMm * HIGHLIGHT_MIN_WIDTH_FACTOR },
        scene,
        node,
      );
    }
  }
}

const DIM_VEIL_ALPHA = 0.8;
const DIM_VEIL_PAD_MM = 25;

/**
 * "Dim others": a paper-colored veil over the whole sheet, drawn before the
 * highlight passes — everything fades, then the classification/trace/
 * selection passes repaint their members at full strength on top.
 */
function drawDimVeil(ctx: DrawContext, scene: SceneGraph): void {
  const paint = new ctx.ck.Paint();
  paint.setColor(
    ctx.ck.Color4f(ctx.palette.paper[0], ctx.palette.paper[1], ctx.palette.paper[2], DIM_VEIL_ALPHA),
  );
  paint.setStyle(ctx.ck.PaintStyle.Fill);
  const b = scene.bounds;
  ctx.canvas.drawRect(
    ctx.ck.LTRBRect(
      b.minX - DIM_VEIL_PAD_MM,
      b.minY - DIM_VEIL_PAD_MM,
      b.maxX + DIM_VEIL_PAD_MM,
      b.maxY + DIM_VEIL_PAD_MM,
    ),
    paint,
  );
  paint.delete();
}

/** Redraws every node representing one of `objectIds` in the given color, on top. */
function drawHighlightPass(
  ctx: DrawContext,
  scene: SceneGraph,
  objectIds: ReadonlySet<string>,
  color: PaletteColor,
  pass: Readonly<{ extraWidthMm?: number; textBackdrop?: boolean; glyphColor?: PaletteColor | null }> = {},
): void {
  if (objectIds.size === 0) {
    return;
  }

  const highlightCtx: DrawContext = {
    ...ctx,
    overrideColor: color,
    minWidthMm: ctx.minWidthMm * HIGHLIGHT_MIN_WIDTH_FACTOR,
    extraWidthMm: pass.extraWidthMm ?? 0,
    glyphColor: pass.glyphColor ?? null,
    textBackdrop: pass.textBackdrop === true,
  };
  for (const node of scene.nodes) {
    if (node.objectId && objectIds.has(node.objectId)) {
      drawNode(highlightCtx, scene, node);
    }
  }
}
