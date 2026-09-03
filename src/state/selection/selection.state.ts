import { createStore } from "../../lib/createStore.ts";

export type SelectionState = Readonly<{
  /** Primary selection (anchor for range-select; what Properties/Connections show). */
  selectedId: string | null;
  /** Full multi-selection in click order; always contains selectedId when set. */
  selectedIds: readonly string[];
  hoveredId: string | null;
  /** Objects to zoom the canvas to (union bounds); `zoomSeq` bumps to re-trigger. */
  zoomTargetIds: readonly string[];
  zoomSeq: number;
}>;

export const selectionState = createStore<SelectionState>({
  selectedId: null,
  selectedIds: [],
  hoveredId: null,
  zoomTargetIds: [],
  zoomSeq: 0,
});
