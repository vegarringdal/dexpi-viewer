import type { SemanticEdge, SemanticNode } from "./semanticGraph.ts";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** How a node relates to the selected node through its direct flow edges. */
export type LinkTint = "upstream" | "downstream" | "signal";

// -----------------------------------------------------------------------------
// Computation
// -----------------------------------------------------------------------------

/** Signal/electrical connections (SignalConveyingFunction etc.) are logical
 *  links, not process flow — they get their own tint regardless of direction. */
function isSignalLink(a: SemanticNode | undefined, b: SemanticNode | undefined): boolean {
  return (a?.typeName.includes("Signal") ?? false) || (b?.typeName.includes("Signal") ?? false);
}

/**
 * The direct flow neighbours of `selectedId`, each classified for the
 * highlight tint: upstream (flows into the selection), downstream (the
 * selection flows into it), or signal (either endpoint is a signal-family
 * object). A neighbour that is both upstream and downstream (a tight loop)
 * keeps the first classification found in edge order — deterministic.
 */
export function computeLinkedTints(
  edges: readonly SemanticEdge[],
  nodes: ReadonlyMap<string, SemanticNode>,
  selectedId: string | null,
): ReadonlyMap<string, LinkTint> {
  const tints = new Map<string, LinkTint>();
  if (selectedId === null) {
    return tints;
  }

  for (const edge of edges) {
    if (edge.kind !== "flow") {
      continue;
    }

    const neighbor = edge.from === selectedId ? edge.to : edge.to === selectedId ? edge.from : null;
    if (neighbor === null || tints.has(neighbor)) {
      continue;
    }

    if (isSignalLink(nodes.get(edge.from), nodes.get(edge.to))) {
      tints.set(neighbor, "signal");
    } else {
      tints.set(neighbor, edge.to === selectedId ? "upstream" : "downstream");
    }
  }
  return tints;
}
