import type { DexpiDocument } from "../lib/dexpi/types.ts";
import { fail, ok, type Result } from "../lib/result.ts";
import { getLoadedDocument } from "../state/viewer/viewer.actions.ts";
import { viewerState } from "../state/viewer/viewer.state.ts";

// -----------------------------------------------------------------------------
// Pieces every export needs: the loaded document, and the file name to save as.
// -----------------------------------------------------------------------------

export function requireDocument(): Result<DexpiDocument> {
  const doc = getLoadedDocument();
  return doc ? ok(doc) : fail("No document loaded.");
}

/** The loaded file's name without its .xml suffix — the stem of every export. */
export function baseName(): string {
  const name = viewerState.get().file?.name ?? "dexpi-drawing";
  return name.replace(/\.xml$/i, "");
}
