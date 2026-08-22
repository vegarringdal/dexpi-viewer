import type { JSX } from "react";
import type { DiagramEdge } from "../../../lib/graph/objectDiagramLayout.ts";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type InspectEdgeViewProps = Readonly<{
  edge: DiagramEdge;
}>;

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const RELATION_CLASS: Readonly<Record<DiagramEdge["relation"], string>> = {
  reference: "stroke-slate-500",
  referencedBy: "stroke-slate-500",
  parent: "stroke-amber-700",
  child: "stroke-amber-700",
  profile: "stroke-violet-600",
};

const CONTAINMENT_DASH = "4 3";

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/** One labeled relation edge; containment dashes, profile stubs tint violet. */
export function InspectEdgeView({ edge }: InspectEdgeViewProps): JSX.Element {
  const isContainment = edge.relation === "parent" || edge.relation === "child";
  const midX = (edge.x1 + edge.x2) / 2;
  const midY = (edge.y1 + edge.y2) / 2;

  return (
    <g>
      <line
        x1={edge.x1}
        y1={edge.y1}
        x2={edge.x2}
        y2={edge.y2}
        strokeDasharray={isContainment ? CONTAINMENT_DASH : undefined}
        markerEnd="url(#inspect-arrow)"
        className={RELATION_CLASS[edge.relation]}
      />
      {edge.label.length > 0 && (
        <text x={midX} y={midY - 4} textAnchor="middle" className="fill-slate-400 text-[8px]">
          {edge.label}
        </text>
      )}
    </g>
  );
}
