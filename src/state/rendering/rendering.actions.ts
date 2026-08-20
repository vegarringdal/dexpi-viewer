import { setUnitDisplayMode, type UnitDisplayMode } from "../../lib/dexpi/values.ts";
import { reparseCurrentDocument } from "../viewer/viewer.actions.ts";
import { DEFAULT_RENDERING_STATE, type RenderingState, renderingState } from "./rendering.state.ts";

const RENDERING_STORAGE_KEY = "dexpi.rendering";

function persist(): void {
  localStorage.setItem(RENDERING_STORAGE_KEY, JSON.stringify(renderingState.get()));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Call once at startup; ignores missing/corrupt stored settings. */
export function applyStoredRenderingSettings(): void {
  const raw = localStorage.getItem(RENDERING_STORAGE_KEY);
  if (!raw) {
    return;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return;
    }

    const candidate: Partial<Record<keyof RenderingState, unknown>> = parsed;
    renderingState.set({
      minStrokePx: isFiniteNumber(candidate.minStrokePx)
        ? candidate.minStrokePx
        : DEFAULT_RENDERING_STATE.minStrokePx,
      strokeWidthScale: isFiniteNumber(candidate.strokeWidthScale)
        ? candidate.strokeWidthScale
        : DEFAULT_RENDERING_STATE.strokeWidthScale,
      showGrid:
        typeof candidate.showGrid === "boolean" ? candidate.showGrid : DEFAULT_RENDERING_STATE.showGrid,
      unitDisplay: candidate.unitDisplay === "name" ? "name" : DEFAULT_RENDERING_STATE.unitDisplay,
    });
    setUnitDisplayMode(renderingState.get().unitDisplay);
  } catch {
    localStorage.removeItem(RENDERING_STORAGE_KEY);
  }
}

export function setMinStrokePx(minStrokePx: number): void {
  renderingState.set({ minStrokePx });
  persist();
}

export function setStrokeWidthScale(strokeWidthScale: number): void {
  renderingState.set({ strokeWidthScale });
  persist();
}

export function setShowGrid(showGrid: boolean): void {
  renderingState.set({ showGrid });
  persist();
}

/**
 * Units render into label/attribute strings at parse time, so switching the
 * display mode re-parses the current document.
 */
export function setUnitDisplay(unitDisplay: UnitDisplayMode): void {
  renderingState.set({ unitDisplay });
  setUnitDisplayMode(unitDisplay);
  persist();
  reparseCurrentDocument();
}

export function resetRenderingSettings(): void {
  const modeChanged = renderingState.get().unitDisplay !== DEFAULT_RENDERING_STATE.unitDisplay;
  renderingState.set(DEFAULT_RENDERING_STATE);
  setUnitDisplayMode(DEFAULT_RENDERING_STATE.unitDisplay);
  persist();
  if (modeChanged) {
    reparseCurrentDocument();
  }
}
