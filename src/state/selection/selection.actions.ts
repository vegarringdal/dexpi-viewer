import { selectionState } from "./selection.state.ts";

export function setSelectedObject(selectedId: string | null): void {
  selectionState.set({ selectedId, selectedIds: selectedId ? [selectedId] : [] });
}

/** Ctrl/cmd-click: adds the object to the selection, or removes it again. */
export function toggleSelectedObject(objectId: string): void {
  const { selectedIds } = selectionState.get();
  if (selectedIds.includes(objectId)) {
    const next = selectedIds.filter((id) => id !== objectId);
    selectionState.set({ selectedIds: next, selectedId: next[next.length - 1] ?? null });
    return;
  }

  selectionState.set({ selectedIds: [...selectedIds, objectId], selectedId: objectId });
}

/** Shift-click range: replaces the selection; `primary` is the clicked object. */
export function setSelectedObjects(selectedIds: readonly string[], primary: string): void {
  selectionState.set({ selectedIds: [...selectedIds], selectedId: primary });
}

export function setHoveredObject(hoveredId: string | null): void {
  selectionState.set({ hoveredId });
}

/** Asks the canvas stage to zoom to the object's drawn geometry. */
export function requestZoomToObject(objectId: string): void {
  selectionState.set({ zoomTargetId: objectId, zoomSeq: selectionState.get().zoomSeq + 1 });
}

export function clearSelection(): void {
  selectionState.set({ selectedId: null, selectedIds: [], hoveredId: null });
}
