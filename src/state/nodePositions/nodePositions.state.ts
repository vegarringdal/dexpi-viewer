import { createStore } from "../../lib/createStore.ts";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type NodePositionKindSettings = Readonly<{
  enabled: boolean;
  colorHex: string;
  /** Multiplies the marker's base size; 1 = default. */
  scale: number;
  /** Outline width in drawing mm, clamped up by the usual min-px rule. */
  widthMm: number;
}>;

export type NodePositionsState = Readonly<{
  /**
   * Per node-position kind, keyed "file:PipingNodePosition" /
   * "profile:Piping". Kinds the user has never touched are absent and fall
   * back to the source's defaults — the list of rows comes from the loaded
   * document, not from here, so a new profile's new kind still shows up.
   */
  kinds: Readonly<Record<string, NodePositionKindSettings>>;
}>;

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const nodePositionsState = createStore<NodePositionsState>({ kinds: {} });
