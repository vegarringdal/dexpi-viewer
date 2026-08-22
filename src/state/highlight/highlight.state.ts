import { createStore } from "../../lib/createStore.ts";
import type { ClassificationGroup, HighlightMode } from "../../lib/dexpi/classification.ts";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type HighlightState = Readonly<{
  mode: HighlightMode;
  /** Groups for the current mode against the loaded document. */
  groups: readonly ClassificationGroup[];
  /** Group keys the user toggled off in the legend. */
  hiddenKeys: readonly string[];
}>;

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const highlightState = createStore<HighlightState>({
  mode: "off",
  groups: [],
  hiddenKeys: [],
});
