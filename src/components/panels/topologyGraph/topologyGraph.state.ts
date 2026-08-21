import { createStore } from "../../../lib/createStore.ts";
import type { GraphEdgeKind, HardwareKind } from "../../../lib/graph/semanticGraph.ts";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type TopologyGraphMode = "neighborhood" | "document";

export type TopologyGraphState = Readonly<{
  mode: TopologyGraphMode;
  /** Ego-graph radius in hops (neighborhood mode). */
  depth: number;
  /** Enabled edge kinds, in canonical order. */
  kinds: readonly GraphEdgeKind[];
  /** Connection-hardware families shown as mini nodes, in canonical order. */
  hardware: readonly HardwareKind[];
  /** Vertical node-gap multiplier for a more spread-out layout. */
  gapScale: number;
  /** Tint the backgrounds of the selection's direct flow/signal neighbours. */
  highlightLinked: boolean;
}>;

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const GRAPH_EDGE_KINDS: readonly GraphEdgeKind[] = ["flow", "containment", "reference"];

export const GRAPH_HARDWARE_KINDS: readonly HardwareKind[] = ["nozzle", "chamber", "pipingNode", "port"];

export const topologyGraphState = createStore<TopologyGraphState>({
  mode: "neighborhood",
  depth: 2,
  kinds: GRAPH_EDGE_KINDS,
  hardware: [],
  gapScale: 1,
  highlightLinked: true,
});
