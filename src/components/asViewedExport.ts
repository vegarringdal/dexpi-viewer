import { classifyColor, getScenePalette, paletteColorToRgb } from "../lib/canvas/scenePalette.ts";
import { buildExportUnderlay, hasVisibleUnderlay } from "../lib/canvas/underlayExport.ts";
import { sceneToSvg } from "../lib/dexpi/exportSvg.ts";
import { sceneAsViewed, type ViewAppearance } from "../lib/dexpi/sceneAsViewed.ts";
import type { Bounds, RgbColor, SceneGraph } from "../lib/dexpi/types.ts";
import { downloadBlob } from "../lib/download.ts";
import type { ExportImage } from "../lib/exportImage.ts";
import { fail, ok, type Result } from "../lib/result.ts";
import { highlightState } from "../state/highlight/highlight.state.ts";
import { traceState } from "../state/trace/trace.state.ts";
import { getUnderlayBitmap } from "../state/underlay/underlay.actions.ts";
import { underlayState } from "../state/underlay/underlay.state.ts";
import { sceneToPdf } from "./exportPdf.ts";
import { baseName, requireDocument } from "./exportShared.ts";

// -----------------------------------------------------------------------------
// "As viewed" exports
//
// PDF/SVG of the drawing the way the viewer currently shows it: black & white,
// highlight tints, dim-others, trace overlays and the underlay. The transient
// bits of the view — selection halo and hover — are deliberately left out: they
// are where the pointer happens to be, not a property of the drawing.
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// Types & constants
// -----------------------------------------------------------------------------

type AsViewedSheet = Readonly<{
  scene: SceneGraph;
  underlay: ExportImage | null;
  name: string;
}>;

const AS_VIEWED_SUFFIX = "-as-viewed";

// -----------------------------------------------------------------------------
// The view, as data
// -----------------------------------------------------------------------------

/**
 * The overlay colors the canvas is currently painting, resolved in the same
 * order it paints them (classification first, then the trace overlays on top).
 * Colors come from the LIGHT palette because an export lands on white paper
 * whatever theme the app is in.
 */
function viewAppearance(): ViewAppearance {
  const highlight = highlightState.get();
  const trace = traceState.get();
  const palette = getScenePalette("light");
  const tints = new Map<string, RgbColor>();

  let classifiedCount = 0;
  for (const [index, group] of highlight.groups.entries()) {
    if (highlight.hiddenKeys.includes(group.key)) {
      continue;
    }

    const color = paletteColorToRgb(classifyColor(palette, index));
    for (const id of group.objectIds) {
      tints.set(id, color);
      classifiedCount += 1;
    }
  }

  for (const id of trace.upstreamIds) {
    tints.set(id, paletteColorToRgb(palette.traceUp));
  }
  for (const id of trace.downstreamIds) {
    tints.set(id, paletteColorToRgb(palette.traceDown));
  }

  return {
    monochrome: highlight.monochrome,
    tints,
    // Matches the canvas: the veil only makes sense with classification groups
    // to make stand out.
    dimOthers: highlight.dimOthers && classifiedCount > 0,
  };
}

/** The underlay as an embeddable image; `data` is null when none is showing. */
async function currentUnderlay(bounds: Bounds): Promise<Result<ExportImage | null>> {
  const state = underlayState.get();
  const bitmap = getUnderlayBitmap();
  if (!bitmap || !hasVisibleUnderlay(state)) {
    return ok(null);
  }

  const baked = await buildExportUnderlay(bounds, state, bitmap);
  return baked.error ? { error: baked.error } : ok(baked.data ?? null);
}

async function buildSheet(): Promise<Result<AsViewedSheet>> {
  const docResult = requireDocument();
  if (!docResult.data) {
    return fail(docResult.error?.msg ?? "No document loaded.");
  }

  const doc = docResult.data;
  const underlay = await currentUnderlay(doc.scene.bounds);
  if (underlay.error) {
    return { error: underlay.error };
  }

  return ok({
    scene: sceneAsViewed(doc.scene, viewAppearance()),
    underlay: underlay.data ?? null,
    name: `${baseName()}${AS_VIEWED_SUFFIX}`,
  });
}

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

/** The current view as a vector PDF (underlay embedded as a raster). */
export async function exportPdfAsViewed(): Promise<Result<void>> {
  const sheet = await buildSheet();
  if (!sheet.data) {
    return fail(sheet.error?.msg ?? "No document loaded.", sheet.error?.err);
  }

  try {
    const bytes = await sceneToPdf(sheet.data.scene, sheet.data.underlay);
    downloadBlob(bytes.slice(), `${sheet.data.name}.pdf`, "application/pdf");
    return ok(undefined);
  } catch (err) {
    return fail("PDF export failed.", err);
  }
}

/** The current view as a standalone SVG (underlay embedded as a data URI). */
export async function exportSvgAsViewed(): Promise<Result<void>> {
  const sheet = await buildSheet();
  if (!sheet.data) {
    return fail(sheet.error?.msg ?? "No document loaded.", sheet.error?.err);
  }

  try {
    const svg = sceneToSvg(sheet.data.scene, sheet.data.underlay);
    downloadBlob(svg, `${sheet.data.name}.svg`, "image/svg+xml");
    return ok(undefined);
  } catch (err) {
    return fail("SVG export failed.", err);
  }
}
