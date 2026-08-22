import type { UnderlayState } from "../../state/underlay/underlay.state.ts";
import type { Bounds } from "../dexpi/types.ts";
import { fail, ok, type Result } from "../result.ts";

// -----------------------------------------------------------------------------
// Underlay decoding & placement
//
// A background image/SVG/PDF stretched onto the diagram extent lets the
// generated drawing be compared against a reference rendering in place.
// The official DISC SVGs share the drawing's mm coordinate system, so the
// default extent-fit aligns them exactly; the offsets/scale cover scans.
// -----------------------------------------------------------------------------

/** Long-edge raster resolution for vector sources (SVG, PDF). */
const RASTER_TARGET_PX = 4096;

function rasterizeToBitmap(
  draw: (context: CanvasRenderingContext2D, width: number, height: number) => void | Promise<void>,
  width: number,
  height: number,
): Promise<ImageBitmap> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("no 2d context");
  }

  return Promise.resolve(draw(context, canvas.width, canvas.height)).then(() => createImageBitmap(canvas));
}

async function decodeSvg(file: File): Promise<ImageBitmap> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("SVG decode failed"));
      image.src = url;
    });
    const naturalWidth = image.naturalWidth || 1000;
    const naturalHeight = image.naturalHeight || 700;
    const scale = RASTER_TARGET_PX / Math.max(naturalWidth, naturalHeight);
    return await rasterizeToBitmap(
      (context, width, height) => {
        context.drawImage(image, 0, 0, width, height);
      },
      naturalWidth * scale,
      naturalHeight * scale,
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function decodePdf(file: File): Promise<ImageBitmap> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() });
  try {
    const doc = await loadingTask.promise;
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = RASTER_TARGET_PX / Math.max(base.width, base.height);
    const viewport = page.getViewport({ scale });
    return await rasterizeToBitmap(
      async (context) => {
        await page.render({ canvas: context.canvas, canvasContext: context, viewport }).promise;
      },
      viewport.width,
      viewport.height,
    );
  } finally {
    await loadingTask.destroy();
  }
}

/**
 * Decodes an underlay file (raster image, SVG, or page 1 of a PDF) into an
 * ImageBitmap. Expected failures come back as Result errors, never throws.
 */
export async function decodeUnderlayFile(file: File): Promise<Result<ImageBitmap>> {
  try {
    const name = file.name.toLowerCase();
    if (name.endsWith(".pdf") || file.type === "application/pdf") {
      return ok(await decodePdf(file));
    }

    if (name.endsWith(".svg") || file.type === "image/svg+xml") {
      return ok(await decodeSvg(file));
    }

    return ok(await createImageBitmap(file));
  } catch (err) {
    return fail(`Could not decode "${file.name}" as an underlay.`, err);
  }
}

/** Hex "#rrggbb" → CanvasKit Color4f components (defaults to red on junk). */
export function hexToColor4f(hex: string): readonly [number, number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m?.[1]) {
    return [0.9, 0.1, 0.1, 1];
  }

  const value = Number.parseInt(m[1], 16);
  return [((value >> 16) & 0xff) / 255, ((value >> 8) & 0xff) / 255, (value & 0xff) / 255, 1];
}

/**
 * The underlay's destination rectangle in drawing mm: the diagram extent,
 * scaled about its own top-left corner, then nudged by the offsets.
 */
export function underlayDestRect(
  bounds: Bounds,
  state: Pick<UnderlayState, "offsetXMm" | "offsetYMm" | "scalePercent">,
): Readonly<{ left: number; top: number; right: number; bottom: number }> {
  const scale = state.scalePercent / 100;
  const left = bounds.minX + state.offsetXMm;
  const top = bounds.minY + state.offsetYMm;
  return {
    left,
    top,
    right: left + (bounds.maxX - bounds.minX) * scale,
    bottom: top + (bounds.maxY - bounds.minY) * scale,
  };
}
