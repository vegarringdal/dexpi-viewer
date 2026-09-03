import { createStore } from "../../lib/createStore.ts";

export type DiagramRevealState = Readonly<{
  /** A Diagram Tree node id to select/reveal — real or a synthetic
   *  positional XPath. Deliberately separate from the app's global
   *  `selectionState`: this must reveal the EXACT node clicked elsewhere
   *  (e.g. in Inspect), which is often a different, deeper node than
   *  whatever `nearestRepresentedId` resolves for global selection. */
  requestedId: string | null;
  /** Bumped on every request so re-requesting the same id still re-fires. */
  nonce: number;
}>;

export const diagramRevealState = createStore<DiagramRevealState>({
  requestedId: null,
  nonce: 0,
});
