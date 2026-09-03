import type { UnderlayState } from "../../state/underlay/underlay.state.ts";
import type { Bounds } from "../dexpi/types.ts";
import type { ExportImage } from "../exportImage.ts";
import { fail, ok, type Result } from "../result.ts";
import { hexToColor4f, underlayDestRect } from "./underlaySource.ts";

// -----------------------------------------------------------------------------
// Underlay → export image
//
// The canvas draws the underlay through a Skia paint (color filter, blend mode,
// alpha). PDF and SVG have no equivalent pipeline, so the tint and the
// hide-white blend are BAKED into the pixels here and only the opacity travels
// as data — both formats apply that natively.
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/**
 * Hide-white makes the underlay's paper transparent instead of multiplying it
 * against the drawing: on a white sheet the two are identical, and a baked
 * alpha is the only version PDF and SVG can both reproduce. Channels at or
 * above this value count as paper.
 */
const WHITE_CUTOFF = 250;

// -----------------------------------------------------------------------------
// Baking
// -----------------------------------------------------------------------------

/** Does the current underlay put anything on an exported sheet? */
export function hasVisibleUnderlay(state: UnderlayState): boolean {
  return state.name !== null && state.visible && state.opacityPercent > 0;
}

function clearWhitePixels(context: CanvasRenderingContext2D, width: number, height: number): void {
  const image = context.getImageData(0, 0, width, height);
  const { data } = image;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    if (r >= WHITE_CUTOFF && g >= WHITE_CUTOFF && b >= WHITE_CUTOFF) {
      data[i + 3] = 0;
    }
  }
  context.putImageData(image, 0, 0);
}

/** Recolors every remaining pixel while keeping its alpha — the 2D twin of the
 *  canvas renderer's SrcIn blend filter, so line art turns uniformly tinted. */
function applyTint(context: CanvasRenderingContext2D, tintHex: string, width: number, height: number): void {
  const [r, g, b] = hexToColor4f(tintHex);
  context.globalCompositeOperation = "source-in";
  context.fillStyle = `rgb(${String(Math.round(r * 255))},${String(Math.round(g * 255))},${String(Math.round(b * 255))})`;
  context.fillRect(0, 0, width, height);
  context.globalCompositeOperation = "source-over";
}

function encodePng(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

/**
 * Renders the underlay bitmap the way the viewer shows it and returns it as
 * PNG bytes plus its placement. Call only when `hasVisibleUnderlay` holds.
 */
export async function buildExportUnderlay(
  bounds: Bounds,
  state: UnderlayState,
  bitmap: ImageBitmap,
): Promise<Result<ExportImage>> {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) {
      return fail("Could not prepare the underlay for export (no 2D context).");
    }

    context.drawImage(bitmap, 0, 0);
    if (state.hideWhite) {
      clearWhitePixels(context, canvas.width, canvas.height);
    }
    if (state.tintHex) {
      applyTint(context, state.tintHex, canvas.width, canvas.height);
    }

    const blob = await encodePng(canvas);
    if (!blob) {
      return fail("Could not encode the underlay image for export.");
    }

    return ok({
      png: new Uint8Array(await blob.arrayBuffer()),
      rect: underlayDestRect(bounds, state),
      opacity: state.opacityPercent / 100,
      placement: state.placement,
    });
  } catch (err) {
    return fail("Could not prepare the underlay for export.", err);
  }
}
