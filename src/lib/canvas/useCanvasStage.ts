import type { CanvasKit, Canvas as CkCanvas, Image as CkImage, SkPicture, Surface } from "canvaskit-wasm";
import { type RefObject, useEffect, useRef } from "react";
import { highlightState } from "../../state/highlight/highlight.state.ts";
import { renderingState } from "../../state/rendering/rendering.state.ts";
import { selectionState } from "../../state/selection/selection.state.ts";
import { themeState } from "../../state/theme/theme.state.ts";
import { traceState } from "../../state/trace/trace.state.ts";
import { getUnderlayBitmap } from "../../state/underlay/underlay.actions.ts";
import { underlayState } from "../../state/underlay/underlay.state.ts";
import {
  getLoadedDocument,
  setViewerError,
  setViewportRect,
  setZoomPercent,
} from "../../state/viewer/viewer.actions.ts";
import { type ViewCommand, viewerState } from "../../state/viewer/viewer.state.ts";
import { computeObjectBounds } from "../dexpi/sceneGraph.ts";
import {
  drawSceneContent,
  drawSceneHighlights,
  type SceneDrawOptions,
  viewportMatrix,
} from "./drawDexpiScene.ts";
import { drawPlaceholderScene, SHEET_BOUNDS } from "./drawPlaceholderScene.ts";
import { createSceneFonts, loadFontData, type SceneFonts } from "./fonts.ts";
import { loadCanvasKit } from "./loadCanvasKit.ts";
import { classifyColor, getScenePalette, type PaletteColor } from "./scenePalette.ts";
import { attachStageInput } from "./stageInput.ts";
import { hexToColor4f, underlayDestRect } from "./underlaySource.ts";
import { Viewport } from "./viewport.ts";

// -----------------------------------------------------------------------------
// Types & constants
// -----------------------------------------------------------------------------

export type CanvasStageHandles = Readonly<{
  containerRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
}>;

export type StageRuntime = {
  ck: CanvasKit;
  surface: Surface | null;
  fonts: SceneFonts | null;
  viewport: Viewport;
  /** CSS px size of the canvas, tracked for fit computations. */
  cssWidth: number;
  cssHeight: number;
  dpr: number;
  didInitialFit: boolean;
  /** viewerState.docRevision the viewport was last fitted to. */
  fittedRevision: number;
  /** Recorded scene body; replayed while panning/hovering (see scenePicture). */
  picture: SkPicture | null;
  pictureKey: string;
  /** GPU copy of the underlay bitmap, re-uploaded per bitmapRevision. */
  underlayImage: CkImage | null;
  underlayRevision: number;
  /** True while a coalesced draw callback is queued (see redraw). */
  drawPending: boolean;
};

const FIT_MARGIN_PX = 24;
const MAX_OBJECT_ZOOM_PERCENT = 400;

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

/**
 * Owns the CanvasKit surface lifecycle for one canvas: wasm + font loading,
 * HiDPI resize (the WebGL surface must be recreated when the backing store
 * changes), input wiring, and redraws on theme/settings/document changes.
 * A newly loaded document is fitted to the viewport exactly once.
 */
export function useCanvasStage(): CanvasStageHandles {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runtimeRef = useRef<StageRuntime | null>(null);

  /**
   * Schedules one draw for the next animation frame; further redraw()
   * calls before it runs coalesce into it. All state — viewport, palette,
   * highlights, and crucially the cached picture — resolves INSIDE the
   * callback, so rapid input (wheel zoom) can never queue callbacks holding
   * a picture that a later re-record has already deleted.
   */
  function redraw(): void {
    const runtime = runtimeRef.current;
    if (!runtime?.surface || runtime.drawPending) {
      return;
    }

    runtime.drawPending = true;
    runtime.surface.requestAnimationFrame((canvas) => {
      const rt = runtimeRef.current;
      if (!rt) {
        return;
      }

      rt.drawPending = false;
      const { ck, viewport, dpr } = rt;
      const doc = getLoadedDocument();
      const revision = viewerState.get().docRevision;
      if (doc && rt.fittedRevision !== revision && rt.cssWidth > 0) {
        viewport.fitTo(doc.scene.bounds, rt.cssWidth, rt.cssHeight, FIT_MARGIN_PX);
        rt.fittedRevision = revision;
        setZoomPercent(viewport.zoomPercent);
      }
      if (rt.cssWidth > 0) {
        const topLeft = viewport.toDrawing({ xPx: 0, yPx: 0 });
        setViewportRect({
          xMm: topLeft.xMm,
          yMm: topLeft.yMm,
          widthMm: rt.cssWidth / viewport.scale,
          heightMm: rt.cssHeight / viewport.scale,
        });
      }

      const palette = getScenePalette(themeState.get().theme);
      if (!doc) {
        drawPlaceholderScene(ck, canvas, viewport, palette, dpr);
        return;
      }

      const { selectedIds, hoveredId } = selectionState.get();
      const trace = traceState.get();
      const highlight = highlightState.get();
      const classification = new Map<string, PaletteColor>();
      highlight.groups.forEach((group, index) => {
        if (!highlight.hiddenKeys.includes(group.key)) {
          const color = classifyColor(palette, index);
          for (const id of group.objectIds) {
            classification.set(id, color);
          }
        }
      });
      const rendering = renderingState.get();
      const underlay = underlayState.get();
      // An underlay behind the drawing needs the opaque paper rect gone,
      // or it would be completely hidden (director's catch).
      const hidePaper =
        underlay.name !== null &&
        underlay.visible &&
        underlay.placement === "under" &&
        underlay.opacityPercent > 0;
      const options: SceneDrawOptions = {
        minWidthMm: rendering.minStrokePx / Math.max(viewport.scale, 1e-9),
        widthScale: rendering.strokeWidthScale,
        hidePaper,
      };
      const picture = scenePicture(rt, doc.scene, palette, options);
      canvas.clear(ck.Color4f(...palette.background));
      canvas.save();
      canvas.concat(viewportMatrix(viewport, dpr));
      if (underlay.placement === "under") {
        drawUnderlay(rt, canvas, doc.scene.bounds);
      }
      if (picture) {
        canvas.drawPicture(picture);
      } else {
        drawSceneContent(ck, canvas, doc.scene, palette, rt.fonts, options);
      }
      drawSceneHighlights(ck, canvas, doc.scene, palette, rt.fonts, options, {
        selectedIds: new Set(selectedIds),
        hoveredId,
        upstreamIds: new Set(trace.upstreamIds),
        downstreamIds: new Set(trace.downstreamIds),
        classification,
      });
      if (underlay.placement === "over") {
        drawUnderlay(rt, canvas, doc.scene.bounds);
      }
      canvas.restore();
    });
  }

  /**
   * Draws the verification underlay stretched onto the diagram extent
   * (plus the user's offset/scale nudges) at the configured opacity. The
   * GPU image is re-uploaded only when the decoded bitmap changes.
   */
  function drawUnderlay(
    rt: StageRuntime,
    canvas: CkCanvas,
    bounds: Parameters<typeof underlayDestRect>[0],
  ): void {
    const state = underlayState.get();
    const bitmap = getUnderlayBitmap();
    if (!state.name || !state.visible || state.opacityPercent <= 0 || !bitmap) {
      return;
    }

    if (rt.underlayRevision !== state.bitmapRevision) {
      rt.underlayImage?.delete();
      rt.underlayImage = rt.ck.MakeImageFromCanvasImageSource(bitmap);
      rt.underlayRevision = state.bitmapRevision;
    }
    const image = rt.underlayImage;
    if (!image) {
      return;
    }

    const dst = underlayDestRect(bounds, state);
    const paint = new rt.ck.Paint();
    paint.setAlphaf(state.opacityPercent / 100);
    if (state.tintHex) {
      // SrcIn keeps each pixel's alpha and replaces its color — line art
      // (the official SVGs rasterize with a TRANSPARENT background) turns
      // uniformly into the tint color without filling the background.
      paint.setColorFilter(
        rt.ck.ColorFilter.MakeBlend(rt.ck.Color4f(...hexToColor4f(state.tintHex)), rt.ck.BlendMode.SrcIn),
      );
    }
    if (state.hideWhite) {
      // Multiply makes white transparent-equivalent: only the ink darkens
      // what is underneath ("dim background" diff overlay).
      paint.setBlendMode(rt.ck.BlendMode.Multiply);
    }
    canvas.drawImageRectOptions(
      image,
      rt.ck.LTRBRect(0, 0, image.width(), image.height()),
      rt.ck.LTRBRect(dst.left, dst.top, dst.right, dst.bottom),
      rt.ck.FilterMode.Linear,
      rt.ck.MipmapMode.Linear,
      paint,
    );
    paint.delete();
  }

  function zoomToObject(objectId: string | null): void {
    const runtime = runtimeRef.current;
    const doc = getLoadedDocument();
    if (!runtime || !doc || !objectId || runtime.cssWidth <= 0) {
      return;
    }

    const bounds = computeObjectBounds(doc.scene, objectId);
    if (!bounds) {
      return;
    }

    runtime.viewport.fitTo(bounds, runtime.cssWidth, runtime.cssHeight, FIT_MARGIN_PX);
    const excess = runtime.viewport.zoomPercent / MAX_OBJECT_ZOOM_PERCENT;
    if (excess > 1) {
      runtime.viewport.zoomAt({ xPx: runtime.cssWidth / 2, yPx: runtime.cssHeight / 2 }, 1 / excess);
    }
    setZoomPercent(runtime.viewport.zoomPercent);
  }

  /**
   * The recorded scene body, re-recorded only when the document, theme, or
   * effective stroke parameters change (the min-px clamp depends on zoom, so
   * a zoom step re-records; pans, hovers and selection replay for free).
   */
  function scenePicture(
    runtime: StageRuntime,
    scene: Parameters<typeof drawSceneContent>[2],
    palette: ReturnType<typeof getScenePalette>,
    options: SceneDrawOptions,
  ): SkPicture | null {
    const key = `${viewerState.get().docRevision}:${themeState.get().theme}:${options.minWidthMm.toFixed(5)}:${options.widthScale}:${options.hidePaper === true}`;
    if (runtime.picture && runtime.pictureKey === key) {
      return runtime.picture;
    }

    runtime.picture?.delete();
    runtime.picture = null;
    const recorder = new runtime.ck.PictureRecorder();
    const b = scene.bounds;
    const pad = 20;
    const canvas = recorder.beginRecording(
      runtime.ck.LTRBRect(b.minX - pad, b.minY - pad, b.maxX + pad, b.maxY + pad),
    );
    drawSceneContent(runtime.ck, canvas, scene, palette, runtime.fonts, options);
    runtime.picture = recorder.finishRecordingAsPicture();
    recorder.delete();
    runtime.pictureKey = key;
    return runtime.picture;
  }

  function runViewCommand(cmd: ViewCommand): void {
    const runtime = runtimeRef.current;
    if (!runtime || runtime.cssWidth <= 0) {
      return;
    }

    const center = { xPx: runtime.cssWidth / 2, yPx: runtime.cssHeight / 2 };
    switch (cmd.kind) {
      case "fit": {
        const bounds = getLoadedDocument()?.scene.bounds ?? SHEET_BOUNDS;
        runtime.viewport.fitTo(bounds, runtime.cssWidth, runtime.cssHeight, FIT_MARGIN_PX);
        break;
      }
      case "zoom":
        runtime.viewport.zoomAt(center, cmd.factor);
        break;
      case "zoom100":
        runtime.viewport.zoomAt(center, 100 / Math.max(runtime.viewport.zoomPercent, 1e-6));
        break;
      case "centerAt": {
        const current = runtime.viewport.toDrawing(center);
        runtime.viewport.panBy(
          (current.xMm - cmd.xMm) * runtime.viewport.scale,
          (current.yMm - cmd.yMm) * runtime.viewport.scale,
        );
        break;
      }
    }
    setZoomPercent(runtime.viewport.zoomPercent);
    redraw();
  }

  function rebuildSurface(): void {
    const runtime = runtimeRef.current;
    const canvasEl = canvasRef.current;
    const containerEl = containerRef.current;
    if (!runtime || !canvasEl || !containerEl) {
      return;
    }

    const rect = containerEl.getBoundingClientRect();
    runtime.cssWidth = rect.width;
    runtime.cssHeight = rect.height;
    runtime.dpr = window.devicePixelRatio || 1;
    canvasEl.width = Math.max(1, Math.round(rect.width * runtime.dpr));
    canvasEl.height = Math.max(1, Math.round(rect.height * runtime.dpr));
    runtime.surface?.delete();
    runtime.surface = runtime.ck.MakeCanvasSurface(canvasEl);
    // A callback queued on the deleted surface never fires — clear the flag
    // or redraw() would coalesce forever.
    runtime.drawPending = false;
    if (!runtime.didInitialFit && rect.width > 0 && !getLoadedDocument()) {
      runtime.viewport.fitTo(SHEET_BOUNDS, rect.width, rect.height, FIT_MARGIN_PX);
      runtime.didInitialFit = true;
      setZoomPercent(runtime.viewport.zoomPercent);
    }
    redraw();
  }

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-once lifecycle; redraw/rebuildSurface only touch refs and stores.
  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | null = null;
    let detachInput: (() => void) | null = null;
    let seenRevision = viewerState.get().docRevision;
    let seenZoomSeq = selectionState.get().zoomSeq;
    let seenViewCmdSeq = viewerState.get().viewCmdSeq;

    const unsubTheme = themeState.subscribe(() => redraw());
    const unsubRendering = renderingState.subscribe(() => redraw());
    const unsubTrace = traceState.subscribe(() => redraw());
    const unsubHighlight = highlightState.subscribe(() => redraw());
    const unsubUnderlay = underlayState.subscribe(() => redraw());
    const unsubViewer = viewerState.subscribe(() => {
      const { docRevision, viewCmdSeq, viewCmd } = viewerState.get();
      if (docRevision !== seenRevision) {
        seenRevision = docRevision;
        redraw();
      }
      if (viewCmdSeq !== seenViewCmdSeq) {
        seenViewCmdSeq = viewCmdSeq;
        if (viewCmd) {
          runViewCommand(viewCmd);
        }
      }
    });
    const unsubSelection = selectionState.subscribe(() => {
      const { zoomSeq, zoomTargetId } = selectionState.get();
      if (zoomSeq !== seenZoomSeq) {
        seenZoomSeq = zoomSeq;
        zoomToObject(zoomTargetId);
      }
      redraw();
    });

    Promise.all([loadCanvasKit(), loadFontData()])
      .then(([ck, fontData]) => {
        const containerEl = containerRef.current;
        const canvasEl = canvasRef.current;
        if (disposed || !containerEl || !canvasEl) {
          return;
        }

        runtimeRef.current = {
          ck,
          surface: null,
          fonts: createSceneFonts(ck, fontData),
          viewport: new Viewport(),
          cssWidth: 0,
          cssHeight: 0,
          dpr: 1,
          didInitialFit: false,
          fittedRevision: 0,
          picture: null,
          pictureKey: "",
          underlayImage: null,
          underlayRevision: 0,
          drawPending: false,
        };
        observer = new ResizeObserver(() => rebuildSurface());
        observer.observe(containerEl);
        detachInput = attachStageInput(canvasEl, runtimeRef, redraw);
        rebuildSurface();
      })
      .catch((err: unknown) => {
        // Without CanvasKit or the bundled fonts the stage cannot exist —
        // surface the failure instead of leaving a silently blank canvas.
        console.error("Canvas stage init failed", err);
        setViewerError("Could not initialize the drawing engine (wasm/font load failed).");
      });

    return () => {
      disposed = true;
      unsubTheme();
      unsubRendering();
      unsubTrace();
      unsubHighlight();
      unsubUnderlay();
      unsubViewer();
      unsubSelection();
      observer?.disconnect();
      detachInput?.();
      runtimeRef.current?.underlayImage?.delete();
      runtimeRef.current?.picture?.delete();
      runtimeRef.current?.fonts?.dispose();
      runtimeRef.current?.surface?.delete();
      runtimeRef.current = null;
    };
  }, []);

  return { containerRef, canvasRef };
}
