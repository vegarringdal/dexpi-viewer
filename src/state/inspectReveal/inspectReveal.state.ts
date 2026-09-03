import { createStore } from "../../lib/createStore.ts";

export type InspectRevealState = Readonly<{
  /** A node id (real or a synthetic positional XPath) to center the
   *  Inspect panel's graph on directly — the mirror image of
   *  `diagramReveal`, for the Diagram Tree panel asking Inspect to show
   *  the exact row clicked, independent of whatever global selection
   *  separately resolves to (or finds nothing to resolve to at all). */
  requestedId: string | null;
  /** Bumped on every request so re-requesting the same id still re-fires. */
  nonce: number;
}>;

export const inspectRevealState = createStore<InspectRevealState>({
  requestedId: null,
  nonce: 0,
});
