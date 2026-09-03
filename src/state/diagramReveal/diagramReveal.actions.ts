import { diagramRevealState } from "./diagramReveal.state.ts";

/** Asks the Diagram Tree panel to select and scroll to `id` (one of its
 *  own node ids, real or synthetic) — the exact node, independent of
 *  whatever global selection separately resolves to. */
export function requestDiagramReveal(id: string): void {
  diagramRevealState.set({ requestedId: id, nonce: diagramRevealState.get().nonce + 1 });
}

/** Drops a stale request (e.g. a fresh document loaded before it fired). */
export function clearDiagramReveal(): void {
  diagramRevealState.set({ requestedId: null });
}
