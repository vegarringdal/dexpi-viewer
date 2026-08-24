import { setPreferBuiltinSignalStyle as applySignalStylePreference } from "../../lib/dexpi/signalLines.ts";
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
      selectionTextRect:
        typeof candidate.selectionTextRect === "boolean"
          ? candidate.selectionTextRect
          : DEFAULT_RENDERING_STATE.selectionTextRect,
      preferBuiltinSignalStyle:
        typeof candidate.preferBuiltinSignalStyle === "boolean"
          ? candidate.preferBuiltinSignalStyle
          : DEFAULT_RENDERING_STATE.preferBuiltinSignalStyle,
    });
    setUnitDisplayMode(renderingState.get().unitDisplay);
    applySignalStylePreference(renderingState.get().preferBuiltinSignalStyle);
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

export function setSelectionTextRect(selectionTextRect: boolean): void {
  renderingState.set({ selectionTextRect });
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

/**
 * Signal styling bakes into the scene at parse time, so flipping the
 * profile-vs-builtin preference re-parses the current document.
 */
export function setPreferBuiltinSignalStyle(preferBuiltinSignalStyle: boolean): void {
  renderingState.set({ preferBuiltinSignalStyle });
  applySignalStylePreference(preferBuiltinSignalStyle);
  persist();
  reparseCurrentDocument();
}

export function resetRenderingSettings(): void {
  const previous = renderingState.get();
  const parseBakedChanged =
    previous.unitDisplay !== DEFAULT_RENDERING_STATE.unitDisplay ||
    previous.preferBuiltinSignalStyle !== DEFAULT_RENDERING_STATE.preferBuiltinSignalStyle;
  renderingState.set(DEFAULT_RENDERING_STATE);
  setUnitDisplayMode(DEFAULT_RENDERING_STATE.unitDisplay);
  applySignalStylePreference(DEFAULT_RENDERING_STATE.preferBuiltinSignalStyle);
  persist();
  if (parseBakedChanged) {
    reparseCurrentDocument();
  }
}
