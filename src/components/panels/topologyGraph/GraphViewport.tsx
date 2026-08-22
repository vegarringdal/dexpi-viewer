import type { JSX, PointerEvent as ReactPointerEvent, Ref } from "react";
import type { GraphLayout } from "../../../lib/graph/layeredLayout.ts";
import { computeLinkedTints } from "../../../lib/graph/linkedTints.ts";
import type { SemanticNode } from "../../../lib/graph/semanticGraph.ts";
import { selectionState } from "../../../state/selection/selection.state.ts";
import type { ViewTransform } from "../../hooks/useSvgPanZoom.ts";
import { GraphEdgeView } from "./GraphEdgeView.tsx";
import { GraphNodeView } from "./GraphNodeView.tsx";
import { topologyGraphState } from "./topologyGraph.state.ts";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type GraphViewportProps = Readonly<{
  layout: GraphLayout;
  nodes: ReadonlyMap<string, SemanticNode>;
  containerRef: Ref<HTMLDivElement>;
  transform: ViewTransform;
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onNodeClick: (id: string, isToggle: boolean) => void;
  onNodeDoubleClick: (id: string) => void;
  onNodeHover: (id: string | null) => void;
}>;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/** The pannable/zoomable SVG surface: edges under nodes, arrowhead defs. */
export function GraphViewport({
  layout,
  nodes,
  containerRef,
  transform,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onNodeClick,
  onNodeDoubleClick,
  onNodeHover,
}: GraphViewportProps): JSX.Element {
  const { selectedId, selectedIds, hoveredId } = selectionState.use();
  const { highlightLinked } = topologyGraphState.use();
  const selected = new Set(selectedIds);
  const tints = computeLinkedTints(layout.edges, nodes, highlightLinked ? selectedId : null);
  const isAccented = (from: string, to: string): boolean =>
    selected.has(from) || selected.has(to) || from === hoveredId || to === hoveredId;

  return (
    <div
      ref={containerRef}
      className="relative min-h-0 flex-1 cursor-grab touch-none select-none overflow-hidden rounded border border-slate-800 bg-slate-950/40"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <svg role="img" aria-label="Topology graph" className="h-full w-full">
        <defs>
          <marker
            id="graph-arrow-flow"
            viewBox="0 0 8 8"
            refX={7}
            refY={4}
            markerWidth={7}
            markerHeight={7}
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 8 4 L 0 8 z" className="fill-slate-400" />
          </marker>
          <marker
            id="graph-arrow-accent"
            viewBox="0 0 8 8"
            refX={7}
            refY={4}
            markerWidth={7}
            markerHeight={7}
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 8 4 L 0 8 z" className="fill-blue-500" />
          </marker>
        </defs>
        <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.scale})`}>
          {layout.edges.map((edge) => {
            const from = layout.nodes.get(edge.from);
            const to = layout.nodes.get(edge.to);
            if (!from || !to) {
              return null;
            }

            return (
              <GraphEdgeView
                key={`${edge.kind}|${edge.from}|${edge.to}`}
                edge={edge}
                from={from}
                to={to}
                isAccented={isAccented(edge.from, edge.to)}
              />
            );
          })}
          {[...layout.nodes.values()].map((placement) => {
            const node = nodes.get(placement.id);
            if (!node) {
              return null;
            }

            return (
              <GraphNodeView
                key={placement.id}
                node={node}
                placement={placement}
                isSelected={selected.has(placement.id)}
                isHovered={placement.id === hoveredId}
                linkTint={tints.get(placement.id)}
                onClick={onNodeClick}
                onDoubleClick={onNodeDoubleClick}
                onHover={onNodeHover}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}
