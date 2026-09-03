import { inspectRevealState } from "./inspectReveal.state.ts";

/** Asks the Inspect panel to center its graph on `id` directly — the
 *  exact node, independent of whatever global selection resolves to. */
export function requestInspectReveal(id: string): void {
  inspectRevealState.set({ requestedId: id, nonce: inspectRevealState.get().nonce + 1 });
}

/** Drops a stale request (e.g. a fresh document loaded before it fired). */
export function clearInspectReveal(): void {
  inspectRevealState.set({ requestedId: null });
}
