import { PanelBody } from "@tredespace/ui/dockable";
import { type JSX, useState } from "react";
import { GraphLegend } from "./GraphLegend.tsx";
import { GraphToolbar } from "./GraphToolbar.tsx";
import { GraphViewport } from "./GraphViewport.tsx";
import { usePinOnRecenter } from "./usePinOnRecenter.ts";
import { useSvgPanZoom } from "./useSvgPanZoom.ts";
import { useTopologyGraph } from "./useTopologyGraph.ts";

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * Semantic-network view of the loaded document: plant objects as nodes with
 * flow, containment and reference edges. Business logic lives in
 * useTopologyGraph; this shell only picks the view state to render.
 */
export function TopologyGraphPanel(): JSX.Element {
  const { view, handleNodeClick, handleNodeDoubleClick, handleNodeHover } = useTopologyGraph();
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const isReady = view.status === "ready";
  const panZoom = useSvgPanZoom(isReady ? view.layout.width : 0, isReady ? view.layout.height : 0);
  const handleNodeClickPinned = usePinOnRecenter(
    view,
    panZoom.transform,
    panZoom.setViewTransform,
    panZoom.getViewportSize,
    handleNodeClick,
  );

  if (view.status === "noFile") {
    return (
      <PanelBody className="flex h-full items-center justify-center p-4 text-center text-slate-500 text-xs">
        Open a DEXPI file to get started.
      </PanelBody>
    );
  }

  return (
    <PanelBody className="flex h-full flex-col gap-2 p-2">
      <GraphToolbar
        onFit={panZoom.fitToContent}
        onZoom={panZoom.zoomBy}
        isHelpOpen={isHelpOpen}
        onToggleHelp={() => setIsHelpOpen((open) => !open)}
      />
      <div className="relative flex min-h-0 flex-1 flex-col gap-2">
        {view.status === "noSelection" ? (
          <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-center text-slate-500 text-xs">
            Select an object in the drawing or the Explorer tree.
          </div>
        ) : (
          <>
            {view.shownCount < view.totalCount && (
              <div className="shrink-0 text-amber-500 text-xs">
                Showing {view.shownCount} of {view.totalCount} objects — use Neighborhood mode or edge
                filters.
              </div>
            )}
            <GraphViewport
              layout={view.layout}
              nodes={view.nodes}
              containerRef={panZoom.containerRef}
              transform={panZoom.transform}
              onPointerDown={panZoom.handlePointerDown}
              onPointerMove={panZoom.handlePointerMove}
              onPointerUp={panZoom.handlePointerUp}
              onNodeClick={handleNodeClickPinned}
              onNodeDoubleClick={handleNodeDoubleClick}
              onNodeHover={handleNodeHover}
            />
          </>
        )}
        {isHelpOpen && <GraphLegend />}
      </div>
    </PanelBody>
  );
}
