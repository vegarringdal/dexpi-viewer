import { decodeUnderlayFile } from "../../lib/canvas/underlaySource.ts";
import { fail, ok, type Result } from "../../lib/result.ts";
import { type UnderlayPlacement, underlayState } from "./underlay.state.ts";

// -----------------------------------------------------------------------------
// The decoded bitmap is a live handle, so it lives here, not in the store
// (see CLAUDE.md); the store carries bitmapRevision for subscribers.
// -----------------------------------------------------------------------------

let underlayBitmap: ImageBitmap | null = null;

export function getUnderlayBitmap(): ImageBitmap | null {
  return underlayBitmap;
}

/**
 * Loads an image/SVG/PDF as the drawing underlay, resetting the alignment
 * (fresh files start extent-fitted at 50% opacity, under the drawing).
 */
export async function loadUnderlayFile(file: File): Promise<Result<void>> {
  const decoded = await decodeUnderlayFile(file);
  if (!decoded.data) {
    return fail(decoded.error?.msg ?? "Could not decode the underlay.", decoded.error?.err);
  }

  underlayBitmap?.close();
  underlayBitmap = decoded.data;
  underlayState.set({
    name: file.name,
    visible: true,
    opacityPercent: 50,
    placement: "under",
    offsetXMm: 0,
    offsetYMm: 0,
    scalePercent: 100,
    tintHex: null,
    hideWhite: false,
    bitmapRevision: underlayState.get().bitmapRevision + 1,
  });
  return ok(undefined);
}

export function clearUnderlay(): void {
  underlayBitmap?.close();
  underlayBitmap = null;
  underlayState.set({ name: null, bitmapRevision: underlayState.get().bitmapRevision + 1 });
}

export function setUnderlayVisible(visible: boolean): void {
  underlayState.set({ visible });
}

export function setUnderlayOpacity(opacityPercent: number): void {
  underlayState.set({ opacityPercent: Math.min(100, Math.max(0, opacityPercent)) });
}

export function setUnderlayPlacement(placement: UnderlayPlacement): void {
  underlayState.set({ placement });
}

export function setUnderlayOffset(offsetXMm: number, offsetYMm: number): void {
  underlayState.set({ offsetXMm, offsetYMm });
}

export function setUnderlayScale(scalePercent: number): void {
  underlayState.set({ scalePercent: Math.max(1, scalePercent) });
}

/** null restores the underlay's original colors. */
export function setUnderlayTint(tintHex: string | null): void {
  underlayState.set({ tintHex });
}

export function setUnderlayHideWhite(hideWhite: boolean): void {
  underlayState.set({ hideWhite });
}
