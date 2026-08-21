import type { SemanticEdge, SemanticGraph, SemanticNode } from "./semanticGraph.ts";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type LayoutNode = Readonly<{
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  layer: number;
}>;

export type GraphLayout = Readonly<{
  nodes: ReadonlyMap<string, LayoutNode>;
  edges: readonly SemanticEdge[];
  width: number;
  height: number;
}>;

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

export const NODE_HEIGHT = 36;
/** Connection hardware (category "connection") renders as a one-line mini node. */
export const HARDWARE_NODE_HEIGHT = 22;
export const NODE_PADDING_X = 10;
/** Empirical average glyph advance for the 11px sans label line. */
export const CHAR_WIDTH_PX = 6.5;
/** The type line renders smaller, so its glyphs advance less. */
export const TYPE_CHAR_FACTOR = 0.85;

const NODE_MIN_WIDTH = 64;
const NODE_MAX_WIDTH = 200;
const HARDWARE_MIN_WIDTH = 36;
const HARDWARE_MAX_WIDTH = 120;
const LAYER_GAP = 64;
const NODE_GAP = 14;
const BARYCENTER_SWEEPS = 4;
const EDGE_BEND_MIN_PX = 24;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function nodeWidth(node: SemanticNode): number {
  if (node.category === "connection") {
    const contentPx = CHAR_WIDTH_PX * TYPE_CHAR_FACTOR * node.label.length;
    return Math.min(HARDWARE_MAX_WIDTH, Math.max(HARDWARE_MIN_WIDTH, 2 * NODE_PADDING_X + contentPx));
  }

  const contentPx = CHAR_WIDTH_PX * Math.max(node.label.length, node.typeName.length * TYPE_CHAR_FACTOR);
  return Math.min(NODE_MAX_WIDTH, Math.max(NODE_MIN_WIDTH, 2 * NODE_PADDING_X + contentPx));
}

function nodeHeight(node: SemanticNode): number {
  return node.category === "connection" ? HARDWARE_NODE_HEIGHT : NODE_HEIGHT;
}

/** Ellipsis-truncates for an SVG `<text>` of the given box width (no CSS ellipsis in SVG). */
export function truncateLabel(text: string, maxWidthPx: number, charWidthPx: number = CHAR_WIDTH_PX): string {
  const maxChars = Math.floor((maxWidthPx - 2 * NODE_PADDING_X) / charWidthPx);
  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, Math.max(1, maxChars - 1))}…`;
}

/**
 * Flow edges whose reversal makes the flow subgraph acyclic (recirculation
 * loops are real in P&ID data). Iterative DFS in node insertion order; an
 * edge into a node still on the DFS stack is a back edge. Keys are "from|to".
 */
function findFlowBackEdges(
  ids: readonly string[],
  flowOut: ReadonlyMap<string, readonly string[]>,
): Set<string> {
  const state = new Map<string, "active" | "done">();
  const backEdges = new Set<string>();

  for (const root of ids) {
    if (state.has(root)) {
      continue;
    }

    const stack: Array<{ id: string; next: number }> = [{ id: root, next: 0 }];
    state.set(root, "active");
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      if (!frame) {
        break;
      }

      const outs = flowOut.get(frame.id) ?? [];
      const to = outs[frame.next];
      frame.next++;
      if (to === undefined) {
        state.set(frame.id, "done");
        stack.pop();
        continue;
      }

      const toState = state.get(to);
      if (toState === "active") {
        backEdges.add(`${frame.id}|${to}`);
      } else if (toState === undefined) {
        state.set(to, "active");
        stack.push({ id: to, next: 0 });
      }
    }
  }
  return backEdges;
}

// -----------------------------------------------------------------------------
// Layout
// -----------------------------------------------------------------------------

export type LayoutOptions = Readonly<{
  /** Multiplies the vertical gap between stacked nodes (default 1). */
  verticalGapScale?: number;
}>;

/**
 * Deterministic layered layout, flow left→right: longest-path layering over
 * the (cycle-broken) flow edges, then containment/reference-adjacent
 * placement for non-flow nodes, isolated nodes in a spare last column,
 * barycenter crossing reduction, and per-column coordinates. All iteration
 * follows node insertion order (document order) — no randomness, stable
 * sorts only. Aims for a readable diagram, not graphviz parity: long edges
 * get no dummy nodes and may pass under other nodes.
 */
export function layoutGraph(graph: SemanticGraph, options: LayoutOptions = {}): GraphLayout {
  const nodeGap = NODE_GAP * Math.max(1, options.verticalGapScale ?? 1);
  const ids = [...graph.nodes.keys()];
  if (ids.length === 0) {
    return { nodes: new Map(), edges: graph.edges, width: 0, height: 0 };
  }

  const flowOut = new Map<string, string[]>();
  const containmentChildren = new Map<string, string[]>();
  const containmentParent = new Map<string, string>();
  const referenceNeighbors = new Map<string, string[]>();
  const allNeighbors = new Map<string, string[]>();
  const push = (map: Map<string, string[]>, key: string, value: string): void => {
    map.set(key, [...(map.get(key) ?? []), value]);
  };
  for (const edge of graph.edges) {
    push(allNeighbors, edge.from, edge.to);
    push(allNeighbors, edge.to, edge.from);
    if (edge.kind === "flow") {
      push(flowOut, edge.from, edge.to);
    } else if (edge.kind === "containment") {
      push(containmentChildren, edge.from, edge.to);
      containmentParent.set(edge.to, edge.from);
    } else {
      push(referenceNeighbors, edge.from, edge.to);
      push(referenceNeighbors, edge.to, edge.from);
    }
  }

  const backEdges = findFlowBackEdges(ids, flowOut);
  const acyclicOut = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  for (const [from, tos] of flowOut) {
    for (const to of tos) {
      if (!backEdges.has(`${from}|${to}`)) {
        push(acyclicOut, from, to);
        inDegree.set(to, (inDegree.get(to) ?? 0) + 1);
        inDegree.set(from, inDegree.get(from) ?? 0);
      }
    }
  }

  const layerOf = new Map<string, number>();
  const queue = ids.filter((id) => inDegree.get(id) === 0);
  for (const id of queue) {
    layerOf.set(id, 0);
  }
  for (let head = 0; head < queue.length; head++) {
    const from = queue[head];
    if (from === undefined) {
      break;
    }

    for (const to of acyclicOut.get(from) ?? []) {
      layerOf.set(to, Math.max(layerOf.get(to) ?? 0, (layerOf.get(from) ?? 0) + 1));
      const remaining = (inDegree.get(to) ?? 0) - 1;
      inDegree.set(to, remaining);
      if (remaining === 0) {
        queue.push(to);
      }
    }
  }

  // Fixpoint placement for non-flow nodes; when it stalls with containment
  // subtrees still unlayered (no flow anywhere near them), seed one subtree
  // root and continue, so pure hierarchies still fan out left→right.
  while (true) {
    for (let pass = 0; pass < ids.length; pass++) {
      let changed = false;
      for (const id of ids) {
        if (layerOf.has(id)) {
          continue;
        }

        const childLayers = (containmentChildren.get(id) ?? [])
          .map((c) => layerOf.get(c))
          .filter((l): l is number => l !== undefined);
        const parentLayer = layerOf.get(containmentParent.get(id) ?? "");
        const refLayers = (referenceNeighbors.get(id) ?? [])
          .map((n) => layerOf.get(n))
          .filter((l): l is number => l !== undefined);
        if (childLayers.length > 0) {
          layerOf.set(id, Math.min(...childLayers) - 1);
        } else if (parentLayer !== undefined) {
          layerOf.set(id, parentLayer + 1);
        } else if (refLayers.length > 0) {
          layerOf.set(id, Math.min(...refLayers));
        } else {
          continue;
        }
        changed = true;
      }
      if (!changed) {
        break;
      }
    }

    const seed = ids.find((id) => !layerOf.has(id) && (containmentChildren.get(id) ?? []).length > 0);
    if (seed === undefined) {
      break;
    }

    layerOf.set(seed, 0);
  }

  const layeredValues = [...layerOf.values()];
  const spareLayer = layeredValues.length > 0 ? Math.max(...layeredValues) + 1 : 0;
  for (const id of ids) {
    if (!layerOf.has(id)) {
      layerOf.set(id, spareLayer);
    }
  }
  const minLayer = Math.min(...layerOf.values());
  const layers: string[][] = [];
  for (const id of ids) {
    const layer = (layerOf.get(id) ?? 0) - minLayer;
    layerOf.set(id, layer);
    const bucket = layers[layer] ?? [];
    bucket.push(id);
    layers[layer] = bucket;
  }
  for (let i = 0; i < layers.length; i++) {
    layers[i] ??= [];
  }

  const orderIndex = new Map<string, number>();
  const reindex = (layer: readonly string[]): void => {
    for (const [index, id] of layer.entries()) {
      orderIndex.set(id, index);
    }
  };
  for (const layer of layers) {
    reindex(layer);
  }
  const sweep = (
    layerIds: string[],
    neighborSide: (ownLayer: number, otherLayer: number) => boolean,
  ): void => {
    const ownLayer = layerOf.get(layerIds[0] ?? "") ?? 0;
    const barycenters = new Map<string, number>();
    for (const id of layerIds) {
      const sideNeighbors = (allNeighbors.get(id) ?? []).filter((n) =>
        neighborSide(ownLayer, layerOf.get(n) ?? ownLayer),
      );
      const mean =
        sideNeighbors.length > 0
          ? sideNeighbors.reduce((sum, n) => sum + (orderIndex.get(n) ?? 0), 0) / sideNeighbors.length
          : (orderIndex.get(id) ?? 0);
      barycenters.set(id, mean);
    }
    layerIds.sort((a, b) => (barycenters.get(a) ?? 0) - (barycenters.get(b) ?? 0));
    reindex(layerIds);
  };
  for (let s = 0; s < BARYCENTER_SWEEPS; s++) {
    if (s % 2 === 0) {
      for (let i = 1; i < layers.length; i++) {
        sweep(layers[i] ?? [], (own, other) => other < own);
      }
    } else {
      for (let i = layers.length - 2; i >= 0; i--) {
        sweep(layers[i] ?? [], (own, other) => other > own);
      }
    }
  }

  const widths = new Map<string, number>();
  const heights = new Map<string, number>();
  for (const [id, node] of graph.nodes) {
    widths.set(id, nodeWidth(node));
    heights.set(id, nodeHeight(node));
  }
  const columnWidths = layers.map((layer) =>
    Math.max(NODE_MIN_WIDTH, ...layer.map((id) => widths.get(id) ?? 0)),
  );
  const columnHeights = layers.map((layer) =>
    layer.length > 0
      ? layer.reduce((sum, id) => sum + (heights.get(id) ?? NODE_HEIGHT), 0) + (layer.length - 1) * nodeGap
      : 0,
  );
  const totalHeight = Math.max(...columnHeights, 0);

  const nodes = new Map<string, LayoutNode>();
  let columnX = 0;
  layers.forEach((layer, layerIndex) => {
    const columnWidth = columnWidths[layerIndex] ?? NODE_MIN_WIDTH;
    let y = (totalHeight - (columnHeights[layerIndex] ?? 0)) / 2;
    for (const id of layer) {
      const width = widths.get(id) ?? NODE_MIN_WIDTH;
      const height = heights.get(id) ?? NODE_HEIGHT;
      nodes.set(id, {
        id,
        x: columnX + (columnWidth - width) / 2,
        y,
        width,
        height,
        layer: layerIndex,
      });
      y += height + nodeGap;
    }
    columnX += columnWidth + LAYER_GAP;
  });

  return { nodes, edges: graph.edges, width: columnX - LAYER_GAP, height: totalHeight };
}

// -----------------------------------------------------------------------------
// Edge routing
// -----------------------------------------------------------------------------

/**
 * A cubic bezier from the source's right mid-side to the target's left
 * mid-side; the horizontal control offset degrades same-layer and
 * right-to-left edges (broken cycles) into readable S-curves.
 */
export function edgePath(from: LayoutNode, to: LayoutNode): string {
  const x1 = from.x + from.width;
  const y1 = from.y + from.height / 2;
  const x2 = to.x;
  const y2 = to.y + to.height / 2;
  const bend = Math.max(EDGE_BEND_MIN_PX, Math.abs(x2 - x1) / 2);
  return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
}
