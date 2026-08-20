import { createStore } from "../../lib/createStore.ts";

export type SelectionState = Readonly<{
  /** Primary selection (anchor for range-select; what Properties/Connections show). */
  selectedId: string | null;
  /** Full multi-selection in click order; always contains selectedId when set. */
  selectedIds: readonly string[];
  hoveredId: string | null;
  /** Object to zoom the canvas to; `zoomSeq` bumps to re-trigger. */
  zoomTargetId: string | null;
  zoomSeq: number;
}>;

export const selectionState = createStore<SelectionState>({
  selectedId: null,
  selectedIds: [],
  hoveredId: null,
  zoomTargetId: null,
  zoomSeq: 0,
});
