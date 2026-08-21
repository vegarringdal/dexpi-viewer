import type { JSX } from "react";
import { edgePath, type LayoutNode } from "../../../lib/graph/layeredLayout.ts";
import type { GraphEdgeKind, SemanticEdge } from "../../../lib/graph/semanticGraph.ts";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type GraphEdgeViewProps = Readonly<{
  edge: SemanticEdge;
  from: LayoutNode;
  to: LayoutNode;
  /** Touches the hovered or selected node. */
  isAccented: boolean;
}>;

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const KIND_STROKE: Readonly<Record<GraphEdgeKind, string>> = {
  flow: "stroke-slate-400",
  containment: "stroke-slate-600",
  reference: "stroke-amber-700/70",
};

const KIND_DASH: Readonly<Record<GraphEdgeKind, string | undefined>> = {
  flow: undefined,
  containment: "4 3",
  reference: "1.5 3",
};

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/** One typed edge: flow solid + arrowhead, containment dashed, reference dotted. */
export function GraphEdgeView({ edge, from, to, isAccented }: GraphEdgeViewProps): JSX.Element {
  const stroke = isAccented ? "stroke-blue-500" : KIND_STROKE[edge.kind];
  const marker =
    edge.kind === "flow" ? `url(#${isAccented ? "graph-arrow-accent" : "graph-arrow-flow"})` : undefined;

  return (
    <path
      d={edgePath(from, to)}
      fill="none"
      strokeWidth={1}
      strokeDasharray={KIND_DASH[edge.kind]}
      markerEnd={marker}
      data-tooltip={edge.label}
      className={stroke}
    />
  );
}
