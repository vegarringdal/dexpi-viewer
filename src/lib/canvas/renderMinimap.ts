import type { Theme } from "../../state/theme/theme.state.ts";
import type { SceneGraph } from "../dexpi/types.ts";
import { drawDexpiScene } from "./drawDexpiScene.ts";
import { loadCanvasKit } from "./loadCanvasKit.ts";
import { getScenePalette } from "./scenePalette.ts";
import { Viewport } from "./viewport.ts";

// -----------------------------------------------------------------------------
// Types & constants
// -----------------------------------------------------------------------------

export type MinimapImage = Readonly<{
  /** Blob URL of the rendered overview (revoke when replaced). */
  url: string;
  widthPx: number;
  heightPx: number;
  /** Image px per drawing mm, and the drawing origin's position in image px. */
  scale: number;
  offsetX: number;
  offsetY: number;
}>;

const MINIMAP_WIDTH_PX = 480;
const MINIMAP_MARGIN_PX = 4;

// -----------------------------------------------------------------------------
// Rendering
// -----------------------------------------------------------------------------

/**
 * Rasterizes the whole drawing once into a small CPU-surface PNG for the
 * minimap. Text is skipped (unreadable at this scale, and it keeps the
 * raster cheap); the viewport rectangle is overlaid in DOM by the panel.
 */
export async function renderMinimap(scene: SceneGraph, theme: Theme): Promise<MinimapImage | null> {
  const ck = await loadCanvasKit();
  const b = scene.bounds;
  const aspect = (b.maxY - b.minY) / Math.max(b.maxX - b.minX, 1e-6);
  const widthPx = MINIMAP_WIDTH_PX;
  const heightPx = Math.max(40, Math.round(widthPx * aspect));

  const surface = ck.MakeSurface(widthPx, heightPx);
  if (!surface) {
    return null;
  }

  const viewport = new Viewport();
  viewport.fitTo(b, widthPx, heightPx, MINIMAP_MARGIN_PX);
  drawDexpiScene(ck, surface.getCanvas(), scene, viewport, getScenePalette(theme), 1, null, {
    selectedIds: new Set(),
    hoveredId: null,
    upstreamIds: new Set(),
    downstreamIds: new Set(),
  });
  surface.flush();

  const image = surface.makeImageSnapshot();
  const bytes = image.encodeToBytes();
  image.delete();
  surface.delete();
  if (!bytes) {
    return null;
  }

  return {
    url: URL.createObjectURL(new Blob([bytes.slice()], { type: "image/png" })),
    widthPx,
    heightPx,
    scale: viewport.scale,
    offsetX: viewport.offsetX,
    offsetY: viewport.offsetY,
  };
}
