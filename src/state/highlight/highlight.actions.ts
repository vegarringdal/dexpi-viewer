import { buildClassificationGroups, type HighlightMode } from "../../lib/dexpi/classification.ts";
import { getLoadedDocument } from "../viewer/viewer.actions.ts";
import { viewerState } from "../viewer/viewer.state.ts";
import { highlightState } from "./highlight.state.ts";

// The mode is a user preference, so a new document recomputes the groups for
// it instead of clearing (an empty document simply yields no groups).
let seenDocRevision = viewerState.get().docRevision;
viewerState.subscribe(() => {
  const revision = viewerState.get().docRevision;
  if (revision !== seenDocRevision) {
    seenDocRevision = revision;
    setHighlightMode(highlightState.get().mode);
  }
});

/** Switches the classification and computes its groups for the loaded document. */
export function setHighlightMode(mode: HighlightMode): void {
  const doc = getLoadedDocument();
  highlightState.set({
    mode,
    groups: doc ? buildClassificationGroups(doc, mode) : [],
    hiddenKeys: [],
  });
}

/** Legend visibility toggle for one group's tint. */
export function toggleHighlightGroup(key: string): void {
  const { hiddenKeys } = highlightState.get();
  highlightState.set({
    hiddenKeys: hiddenKeys.includes(key) ? hiddenKeys.filter((k) => k !== key) : [...hiddenKeys, key],
  });
}

export function clearHighlight(): void {
  setHighlightMode("off");
}

/** Monochrome drawing toggle — content renders in ink/paper only. */
export function setHighlightMonochrome(monochrome: boolean): void {
  highlightState.set({ monochrome });
}

/** Fade non-highlighted content while a highlight mode is active. */
export function setHighlightDimOthers(dimOthers: boolean): void {
  highlightState.set({ dimOthers });
}
