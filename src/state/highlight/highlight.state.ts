import { createStore } from "../../lib/createStore.ts";
import type { ClassificationGroup, HighlightMode } from "../../lib/dexpi/classification.ts";
import type { CustomHighlightFilter } from "../../lib/dexpi/customHighlightFilter.ts";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type HighlightState = Readonly<{
  mode: HighlightMode;
  /** Groups for the current mode against the loaded document. */
  groups: readonly ClassificationGroup[];
  /** Group keys the user toggled off in the legend. */
  hiddenKeys: readonly string[];
  /** Draw the whole scene in ink/paper so tints never collide with file colors. */
  monochrome: boolean;
  /** Fade everything OUTSIDE the highlighted groups so tints stand out. */
  dimOthers: boolean;
  /** User-defined filters for "custom" mode, in priority order (last wins overlaps). */
  customFilters: readonly CustomHighlightFilter[];
}>;

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const highlightState = createStore<HighlightState>({
  mode: "off",
  groups: [],
  hiddenKeys: [],
  monochrome: false,
  dimOthers: false,
  customFilters: [],
});
