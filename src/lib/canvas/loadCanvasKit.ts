import type { CanvasKit } from "canvaskit-wasm";
import CanvasKitInit from "canvaskit-wasm";
import wasmUrl from "canvaskit-wasm/bin/canvaskit.wasm?url";

let canvasKitPromise: Promise<CanvasKit> | null = null;

/** Loads the CanvasKit wasm module once; every caller shares the instance. */
export function loadCanvasKit(): Promise<CanvasKit> {
  if (!canvasKitPromise) {
    canvasKitPromise = CanvasKitInit({ locateFile: () => wasmUrl });
  }

  return canvasKitPromise;
}
