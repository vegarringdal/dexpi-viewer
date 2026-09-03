import { useEffect, useMemo, useRef, useState } from "react";
import { type GraphLayout, layoutGraph } from "../../../lib/graph/layeredLayout.ts";
import {
  buildSemanticGraph,
  capGraph,
  extractEgoGraph,
  filterGraphKinds,
  type GraphEdgeKind,
  type HardwareKind,
  resolveOwningNode,
  type SemanticGraph,
  type SemanticNode,
} from "../../../lib/graph/semanticGraph.ts";
import {
  requestZoomToObjects,
  setHoveredObject,
  setSelectedObject,
  toggleSelectedObject,
} from "../../../state/selection/selection.actions.ts";
import { selectionState } from "../../../state/selection/selection.state.ts";
import { getLoadedDocument } from "../../../state/viewer/viewer.actions.ts";
import { viewerState } from "../../../state/viewer/viewer.state.ts";
import { topologyGraphState } from "./topologyGraph.state.ts";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type TopologyGraphView =
  | Readonly<{ status: "noFile" }>
  | Readonly<{ status: "noSelection" }>
  | Readonly<{
      status: "ready";
      layout: GraphLayout;
      nodes: ReadonlyMap<string, SemanticNode>;
      /** The ego graph's root node; null in document mode. */
      rootId: string | null;
      shownCount: number;
      totalCount: number;
    }>;

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Whole-document mode soft cap — beyond this the panel shows a coverage note. */
export const WHOLE_DOCUMENT_NODE_CAP = 400;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Mirrors toggleSelectedObject to predict the primary id after a ctrl-toggle. */
function predictToggledPrimary(id: string): string | null {
  const { selectedIds } = selectionState.get();
  if (!selectedIds.includes(id)) {
    return id;
  }

  const remaining = selectedIds.filter((x) => x !== id);
  return remaining[remaining.length - 1] ?? null;
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

/**
 * All topology-graph business logic: builds the semantic graph for the loaded
 * document, derives the visible slice (ego neighborhood or capped whole
 * document), lays it out, and syncs selection both ways. A plain click on a
 * graph node re-roots the neighborhood around it, exactly like an external
 * selection; only ctrl/cmd-toggles must NOT recenter/relayout (that would
 * break multi-select mid-gesture), so the recenter effect is guarded the
 * same way TopologyPanel guards its reveal-scroll.
 */
export function useTopologyGraph(): Readonly<{
  view: TopologyGraphView;
  handleNodeClick: (id: string, isToggle: boolean) => void;
  handleNodeDoubleClick: (id: string) => void;
  handleNodeHover: (id: string | null) => void;
}> {
  const { file, docRevision } = viewerState.use();
  const { selectedId } = selectionState.use();
  const { mode, depth, kinds, hardware, gapScale } = topologyGraphState.use();
  const [centerId, setCenterId] = useState<string | null>(null);
  const selectionFromGraphRef = useRef(false);

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const hardwareSet = useMemo<ReadonlySet<HardwareKind>>(() => new Set(hardware), [hardware]);

  const baseGraph = useMemo<SemanticGraph | null>(() => {
    void docRevision;
    const doc = getLoadedDocument();
    return doc ? buildSemanticGraph(doc, hardwareSet) : null;
  }, [docRevision, hardwareSet]);

  const filtered = useMemo<SemanticGraph | null>(() => {
    return baseGraph ? filterGraphKinds(baseGraph, new Set<GraphEdgeKind>(kinds)) : null;
  }, [baseGraph, kinds]);

  // Document mode must not relayout when the selection moves.
  const egoCenterId = mode === "neighborhood" ? centerId : null;

  const visible = useMemo<Readonly<{
    graph: SemanticGraph;
    rootId: string | null;
    totalNodes: number;
  }> | null>(() => {
    if (!filtered) {
      return null;
    }

    if (mode === "document") {
      return { ...capGraph(filtered, WHOLE_DOCUMENT_NODE_CAP), rootId: null };
    }

    const plant = getLoadedDocument()?.plant;
    const lifted = egoCenterId !== null && plant ? resolveOwningNode(plant, egoCenterId, hardwareSet) : null;
    if (lifted === null) {
      return null;
    }

    // totalNodes = the ego's own size: a neighborhood is a subset by design,
    // so the panel's "Showing N of M" cap note must not fire here.
    const ego = extractEgoGraph(filtered, lifted, depth);
    return ego.nodes.size > 0 ? { graph: ego, rootId: lifted, totalNodes: ego.nodes.size } : null;
  }, [filtered, mode, depth, egoCenterId, hardwareSet]);

  const layout = useMemo<GraphLayout | null>(() => {
    return visible ? layoutGraph(visible.graph, { verticalGapScale: gapScale }) : null;
  }, [visible, gapScale]);

  let view: TopologyGraphView;
  if (!file || !baseGraph) {
    view = { status: "noFile" };
  } else if (!visible || !layout) {
    view = { status: "noSelection" };
  } else {
    view = {
      status: "ready",
      layout,
      nodes: visible.graph.nodes,
      rootId: visible.rootId,
      shownCount: visible.graph.nodes.size,
      totalCount: visible.totalNodes,
    };
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  const handleNodeClick = (id: string, isToggle: boolean): void => {
    if (isToggle) {
      if (predictToggledPrimary(id) !== selectionState.get().selectedId) {
        selectionFromGraphRef.current = true;
      }
      toggleSelectedObject(id);
      return;
    }

    // Recenter directly — the selection effect is a no-op when the clicked
    // node is already the primary selection (selectedId unchanged).
    setSelectedObject(id);
    setCenterId(id);
  };

  const handleNodeDoubleClick = (id: string): void => {
    requestZoomToObjects([id]);
  };

  const handleNodeHover = (id: string | null): void => {
    setHoveredObject(id);
  };

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  // External selections (tree, canvas, chips) recenter the neighborhood graph.
  useEffect(() => {
    if (selectionFromGraphRef.current) {
      selectionFromGraphRef.current = false;
      return;
    }

    setCenterId(selectedId);
  }, [selectedId]);

  // A fresh document starts from that document's selection (usually none).
  useEffect(() => {
    void docRevision;
    setCenterId(selectionState.get().selectedId);
  }, [docRevision]);

  return { view, handleNodeClick, handleNodeDoubleClick, handleNodeHover };
}
