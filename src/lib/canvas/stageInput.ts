import type { RefObject } from "react";
import {
  setHoveredObject,
  setSelectedObject,
  toggleSelectedObject,
} from "../../state/selection/selection.actions.ts";
import { getLoadedDocument, setCursorPosition, setZoomPercent } from "../../state/viewer/viewer.actions.ts";
import { hitTestScene } from "../dexpi/hitTest.ts";
import type { StageRuntime } from "./useCanvasStage.ts";

const WHEEL_ZOOM_FACTOR = 1.1;
/** Pointer movement below this (CSS px) still counts as a click. */
const CLICK_SLOP_PX = 4;
/** Hit-test tolerance around lines, CSS px. */
const HIT_TOLERANCE_PX = 4;

function hitObjectIdAt(runtime: StageRuntime, xPx: number, yPx: number): string | null {
  const doc = getLoadedDocument();
  if (!doc) {
    return null;
  }

  const mm = runtime.viewport.toDrawing({ xPx, yPx });
  const tolerance = HIT_TOLERANCE_PX / Math.max(runtime.viewport.scale, 1e-9);
  const node = hitTestScene(doc.scene, { x: mm.xMm, y: mm.yMm }, tolerance);
  return node?.objectId ?? null;
}

/**
 * Wires pan (drag), zoom-to-cursor (wheel), hover/click hit-testing and
 * cursor-position tracking onto the stage canvas. A press that moves less
 * than CLICK_SLOP_PX selects the object under the pointer (or clears the
 * selection on empty paper); ctrl/cmd-click toggles the object in the
 * multi-selection instead. Returns the detach function.
 */
export function attachStageInput(
  canvasEl: HTMLCanvasElement,
  runtimeRef: RefObject<StageRuntime | null>,
  redraw: () => void,
): () => void {
  let panPointerId: number | null = null;
  let isDragging = false;
  let downX = 0;
  let downY = 0;
  let lastX = 0;
  let lastY = 0;

  const handlePointerDown = (e: PointerEvent): void => {
    panPointerId = e.pointerId;
    isDragging = false;
    downX = e.clientX;
    downY = e.clientY;
    lastX = e.clientX;
    lastY = e.clientY;
    canvasEl.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: PointerEvent): void => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }

    const rect = canvasEl.getBoundingClientRect();
    const xPx = e.clientX - rect.left;
    const yPx = e.clientY - rect.top;

    if (panPointerId === e.pointerId) {
      if (!isDragging && Math.hypot(e.clientX - downX, e.clientY - downY) > CLICK_SLOP_PX) {
        isDragging = true;
      }
      if (isDragging) {
        runtime.viewport.panBy(e.clientX - lastX, e.clientY - lastY);
        lastX = e.clientX;
        lastY = e.clientY;
        redraw();
      }
    } else {
      setHoveredObject(hitObjectIdAt(runtime, xPx, yPx));
    }

    const mm = runtime.viewport.toDrawing({ xPx, yPx });
    setCursorPosition({ xMm: mm.xMm, yMm: mm.yMm });
  };

  const handlePointerUp = (e: PointerEvent): void => {
    if (panPointerId !== e.pointerId) {
      return;
    }

    panPointerId = null;
    const runtime = runtimeRef.current;
    if (isDragging || !runtime) {
      return;
    }

    const rect = canvasEl.getBoundingClientRect();
    const hitId = hitObjectIdAt(runtime, e.clientX - rect.left, e.clientY - rect.top);
    if ((e.ctrlKey || e.metaKey) && hitId) {
      toggleSelectedObject(hitId);
      return;
    }

    setSelectedObject(hitId);
  };

  const handlePointerCancel = (e: PointerEvent): void => {
    if (panPointerId === e.pointerId) {
      panPointerId = null;
    }
  };

  const handlePointerLeave = (): void => {
    setCursorPosition(null);
    setHoveredObject(null);
  };

  const handleWheel = (e: WheelEvent): void => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }

    e.preventDefault();
    const rect = canvasEl.getBoundingClientRect();
    const point = { xPx: e.clientX - rect.left, yPx: e.clientY - rect.top };
    const factor = e.deltaY < 0 ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR;
    runtime.viewport.zoomAt(point, factor);
    setZoomPercent(runtime.viewport.zoomPercent);
    redraw();
  };

  canvasEl.addEventListener("pointerdown", handlePointerDown);
  canvasEl.addEventListener("pointermove", handlePointerMove);
  canvasEl.addEventListener("pointerup", handlePointerUp);
  canvasEl.addEventListener("pointercancel", handlePointerCancel);
  canvasEl.addEventListener("pointerleave", handlePointerLeave);
  canvasEl.addEventListener("wheel", handleWheel, { passive: false });

  return () => {
    canvasEl.removeEventListener("pointerdown", handlePointerDown);
    canvasEl.removeEventListener("pointermove", handlePointerMove);
    canvasEl.removeEventListener("pointerup", handlePointerUp);
    canvasEl.removeEventListener("pointercancel", handlePointerCancel);
    canvasEl.removeEventListener("pointerleave", handlePointerLeave);
    canvasEl.removeEventListener("wheel", handleWheel);
  };
}
