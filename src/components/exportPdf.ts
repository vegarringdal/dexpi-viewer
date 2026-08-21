import fontkit from "@pdf-lib/fontkit";
import { degrees, LineCapStyle, PDFDocument, type PDFFont, type PDFPage, rgb } from "pdf-lib";
import { type FaceKey, faceKeyFor, loadFontData } from "../lib/canvas/fonts.ts";
import { flattenScene } from "../lib/dexpi/flattenScene.ts";
import { primitiveToPathData } from "../lib/dexpi/pathData.ts";
import { baselineOffsetMm, layoutTextLines } from "../lib/dexpi/textLayout.ts";
import type { RgbColor, SceneGraph, ScenePrimitive, TextPrim } from "../lib/dexpi/types.ts";

// -----------------------------------------------------------------------------
// PDF export
//
// Vector output via pdf-lib: geometry as SVG path data (drawing mm, y-down —
// drawSvgPath handles the axis flip), text with the same metric-compatible
// embedded faces the canvas uses, so widths match the on-screen rendering.
// -----------------------------------------------------------------------------

const MM_TO_PT = 72 / 25.4;
const MARGIN_MM = 5;

type PdfContext = Readonly<{
  page: PDFPage;
  fonts: ReadonlyMap<FaceKey, PDFFont>;
  /** Shift from drawing mm into export mm (margin-adjusted). */
  ox: number;
  oy: number;
  pageHeightPt: number;
}>;

function toRgb(c: RgbColor): ReturnType<typeof rgb> {
  return rgb(c.r / 255, c.g / 255, c.b / 255);
}

function drawGeometry(ctx: PdfContext, prim: Exclude<ScenePrimitive, TextPrim>): void {
  const path = primitiveToPathData(prim, ctx.ox, ctx.oy);
  if (!path) {
    return;
  }

  // Hatch renders as a translucent solid in PDF for now (documented interim —
  // pdf-lib has no pattern fills; real hatching would need manual clipping).
  const fillStyle = "fill" in prim ? prim.fill.style : "Transparent";
  // drawSvgPath applies `scale` to the CTM before setting the line width and
  // dash pattern, so both are in path units (drawing mm), NOT points.
  ctx.page.drawSvgPath(path, {
    x: 0,
    y: ctx.pageHeightPt,
    scale: MM_TO_PT,
    borderColor: toRgb(prim.stroke.color),
    borderWidth: Math.max(prim.stroke.width, 0.05),
    borderLineCap: prim.stroke.rounding === "Butt" ? LineCapStyle.Butt : LineCapStyle.Round,
    ...(prim.stroke.dash.length > 0 ? { borderDashArray: [...prim.stroke.dash] } : {}),
    ...(prim.stroke.dashOffset ? { borderDashPhase: prim.stroke.dashOffset } : {}),
    ...("fill" in prim && fillStyle !== "Transparent"
      ? { color: toRgb(prim.fill.color), ...(fillStyle === "Hatch" ? { opacity: 0.25 } : {}) }
      : {}),
  });
}

function drawPdfText(ctx: PdfContext, prim: TextPrim): void {
  if (prim.value.length === 0) {
    return;
  }

  const font = ctx.fonts.get(faceKeyFor(prim.font));
  if (!font) {
    return;
  }

  const sizePt = prim.size * MM_TO_PT;
  const baseDyMm = baselineOffsetMm(prim.size, prim.vAlign);
  const rad = (prim.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  for (const line of layoutTextLines(prim.value, prim.size, prim.vAlign)) {
    if (line.value.length === 0) {
      continue;
    }

    const widthPt = font.widthOfTextAtSize(line.value, sizePt);
    const dx = prim.hAlign === "Center" ? -widthPt / 2 : prim.hAlign === "Right" ? -widthPt : 0;
    const dy = (baseDyMm + line.offsetY) * MM_TO_PT;

    // Rotate the local (dx, dy) anchor offset into drawing space (y-down),
    // then flip into PDF's y-up page space. Rotating each line's offset
    // around the shared anchor keeps the block turning as one unit.
    const offsetX = dx * cos - dy * sin;
    const offsetY = dx * sin + dy * cos;
    const xPt = (prim.position.x + ctx.ox) * MM_TO_PT + offsetX;
    const yPt = ctx.pageHeightPt - ((prim.position.y + ctx.oy) * MM_TO_PT + offsetY);

    ctx.page.drawText(line.value, {
      x: xPt,
      y: yPt,
      size: sizePt,
      font,
      color: toRgb(prim.color),
      rotate: degrees(-prim.rotation),
    });
  }
}

/** Renders the scene graph into a single-page PDF; returns the file bytes. */
export async function sceneToPdf(scene: SceneGraph): Promise<Uint8Array> {
  const b = scene.bounds;
  const widthPt = (b.maxX - b.minX + 2 * MARGIN_MM) * MM_TO_PT;
  const heightPt = (b.maxY - b.minY + 2 * MARGIN_MM) * MM_TO_PT;

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const prims = flattenScene(scene);

  // Embed only the faces the scene uses, unsubsetted: fontkit's subsetter
  // emits a corrupt glyf table for these hinted faces, which PDF viewers
  // reject — the text then renders with most glyphs missing.
  const usedFaces = new Set<FaceKey>(
    prims.flatMap((p) => (p.kind === "text" && p.value.length > 0 ? [faceKeyFor(p.font)] : [])),
  );
  const data = await loadFontData();
  const fonts = new Map<FaceKey, PDFFont>();
  for (const key of usedFaces) {
    fonts.set(key, await pdf.embedFont(data[key], { subset: false }));
  }

  const page = pdf.addPage([widthPt, heightPt]);
  const ctx: PdfContext = {
    page,
    fonts,
    ox: MARGIN_MM - b.minX,
    oy: MARGIN_MM - b.minY,
    pageHeightPt: heightPt,
  };

  for (const prim of prims) {
    if (prim.kind === "text") {
      drawPdfText(ctx, prim);
    } else {
      drawGeometry(ctx, prim);
    }
  }
  return pdf.save();
}
