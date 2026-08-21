import { isFlowReferenceProperty, isPassThroughType } from "../dexpi/connectivity.ts";
import type { PlantAttribute, PlantModel, PlantNode } from "../dexpi/plantModel.ts";
import type { DexpiDocument } from "../dexpi/types.ts";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type GraphEdgeKind = "flow" | "containment" | "reference";

export type NodeCategory = "equipment" | "piping" | "instrumentation" | "process" | "connection" | "other";

/** Connection-hardware families that can optionally appear as graph nodes. */
export type HardwareKind = "nozzle" | "chamber" | "pipingNode" | "port";

export type SemanticNode = Readonly<{
  id: string;
  label: string;
  /** Bare class name, e.g. "Piping.Pipe". */
  typeName: string;
  category: NodeCategory;
  attributes: readonly PlantAttribute[];
}>;

export type SemanticEdge = Readonly<{
  from: string;
  to: string;
  kind: GraphEdgeKind;
  /** The References property name, on reference edges. */
  label?: string;
}>;

export type SemanticGraph = Readonly<{
  /** Insertion order = document order — the determinism anchor for layout. */
  nodes: ReadonlyMap<string, SemanticNode>;
  edges: readonly SemanticEdge[];
}>;

export type CappedGraph = Readonly<{
  graph: SemanticGraph;
  /** Node count before capping. */
  totalNodes: number;
}>;

// -----------------------------------------------------------------------------
// Classification
// -----------------------------------------------------------------------------

const CATEGORY_BY_PACKAGE: Readonly<Record<string, NodeCategory>> = {
  ProcessEquipment: "equipment",
  Piping: "piping",
  Instrumentation: "instrumentation",
  Process: "process",
};

function categoryOf(typeName: string): NodeCategory {
  const pkg = typeName.split(".")[0] ?? "";
  return CATEGORY_BY_PACKAGE[pkg] ?? "other";
}

/** The hardware family of a pass-through type; null for real plant objects. */
export function classifyHardware(type: string): HardwareKind | null {
  if (!isPassThroughType(type)) {
    return null;
  }

  const local = type.split(".").pop() ?? type;
  if (local === "Nozzle") {
    return "nozzle";
  }
  if (local === "Chamber") {
    return "chamber";
  }
  if (local.endsWith("Port")) {
    return "port";
  }
  return "pipingNode";
}

const NO_HARDWARE: ReadonlySet<HardwareKind> = new Set();

// -----------------------------------------------------------------------------
// Assembly
// -----------------------------------------------------------------------------

/**
 * The graph node an object belongs to: connection hardware (ports, nodes,
 * nozzles, chambers — possibly nested, e.g. Chamber → Nozzle) is lifted to the
 * nearest ancestor that is a graph node — a real plant object, or hardware of
 * a family in `shownHardware`. Returns null for ids unknown to the plant
 * model or hardware without a real owner.
 */
export function resolveOwningNode(
  plant: PlantModel,
  id: string,
  shownHardware: ReadonlySet<HardwareKind> = NO_HARDWARE,
): string | null {
  let node: PlantNode | undefined = plant.byId.get(id);
  while (node) {
    const hardware = classifyHardware(node.type);
    if (hardware === null || shownHardware.has(hardware)) {
      return node.id;
    }

    node = node.parentId !== null ? plant.byId.get(node.parentId) : undefined;
  }
  return null;
}

/**
 * Builds the semantic network over the plant model: one node per conceptual
 * object, with containment edges from the hierarchy, flow edges lifted from
 * the connectivity graph, and reference edges from the remaining References
 * properties. Connection hardware collapses into its owner, except the
 * families in `shownHardware`, which stay as their own (mini) nodes and are
 * stitched into the flow path towards their owner in the direction the flow
 * actually passes them. Dangling targets are dropped silently — the
 * Validation panel owns reporting them.
 */
export function buildSemanticGraph(
  doc: DexpiDocument,
  shownHardware: ReadonlySet<HardwareKind> = NO_HARDWARE,
): SemanticGraph {
  const { plant, connectivity } = doc;
  const nodes = new Map<string, SemanticNode>();
  const edges: SemanticEdge[] = [];
  const seenEdges = new Set<string>();
  const hardwareDepth = new Map<string, number>();

  const addEdge = (edge: SemanticEdge): void => {
    const key = `${edge.kind}|${edge.from}|${edge.to}`;
    if (edge.from !== edge.to && nodes.has(edge.from) && nodes.has(edge.to) && !seenEdges.has(key)) {
      seenEdges.add(key);
      edges.push(edge);
    }
  };

  const walk = (node: PlantNode, ancestorId: string | null, depth: number): void => {
    let ownId = ancestorId;
    const hardware = classifyHardware(node.type);
    if (hardware === null || shownHardware.has(hardware)) {
      nodes.set(node.id, {
        id: node.id,
        label: node.label,
        typeName: node.typeName,
        category: hardware === null ? categoryOf(node.typeName) : "connection",
        attributes: node.attributes,
      });
      if (hardware !== null) {
        hardwareDepth.set(node.id, depth);
      }
      ownId = node.id;
    }
    for (const child of node.children) {
      walk(child, ownId, depth + 1);
    }
  };
  for (const root of plant.roots) {
    walk(root, null, 0);
  }

  const walkContainment = (node: PlantNode, ancestorId: string | null): void => {
    const isKept = nodes.has(node.id);
    if (isKept && ancestorId !== null) {
      addEdge({ from: ancestorId, to: node.id, kind: "containment" });
    }
    for (const child of node.children) {
      walkContainment(child, isKept ? node.id : ancestorId);
    }
  };
  for (const root of plant.roots) {
    walkContainment(root, null);
  }

  for (const [from, targets] of connectivity.forward) {
    const liftedFrom = resolveOwningNode(plant, from, shownHardware);
    if (liftedFrom === null) {
      continue;
    }

    for (const to of targets) {
      const liftedTo = resolveOwningNode(plant, to, shownHardware);
      if (liftedTo !== null) {
        addEdge({ from: liftedFrom, to: liftedTo, kind: "flow" });
      }
    }
  }

  stitchHardwareToOwners(plant, shownHardware, hardwareDepth, edges, addEdge);

  for (const [id, node] of nodes) {
    if (node.category === "connection") {
      continue; // hardware carries no engineering references of its own
    }

    const plantNode = plant.byId.get(id);
    for (const reference of plantNode?.references ?? []) {
      if (isFlowReferenceProperty(reference.property)) {
        continue;
      }

      for (const target of reference.targets) {
        const lifted = resolveOwningNode(plant, target, shownHardware);
        if (lifted !== null) {
          addEdge({ from: id, to: lifted, kind: "reference", label: reference.property });
        }
      }
    }
  }

  return { nodes, edges };
}

/**
 * A shown hardware node is a way-station, not an endpoint: flow that enters
 * it continues into its owner, flow that leaves its owner passes out through
 * it. Adds the missing hardware↔owner flow edge in the direction implied by
 * the hardware's existing flow edges, processing deepest hardware first so
 * nested hardware (Nozzle inside Chamber) chains outward level by level.
 * Hardware with no flow at all (a spare nozzle) gets no stitch — containment
 * still shows where it belongs.
 */
function stitchHardwareToOwners(
  plant: PlantModel,
  shownHardware: ReadonlySet<HardwareKind>,
  hardwareDepth: ReadonlyMap<string, number>,
  edges: readonly SemanticEdge[],
  addEdge: (edge: SemanticEdge) => void,
): void {
  const byDepthDesc = [...hardwareDepth.keys()].sort(
    (a, b) => (hardwareDepth.get(b) ?? 0) - (hardwareDepth.get(a) ?? 0),
  );
  for (const id of byDepthDesc) {
    const parentId = plant.byId.get(id)?.parentId;
    const owner = parentId != null ? resolveOwningNode(plant, parentId, shownHardware) : null;
    if (owner === null) {
      continue;
    }

    let hasIncoming = false;
    let hasOutgoing = false;
    for (const edge of edges) {
      if (edge.kind !== "flow") {
        continue;
      }

      hasIncoming ||= edge.to === id && edge.from !== owner;
      hasOutgoing ||= edge.from === id && edge.to !== owner;
    }
    if (hasIncoming) {
      addEdge({ from: id, to: owner, kind: "flow" });
    }
    if (hasOutgoing) {
      addEdge({ from: owner, to: id, kind: "flow" });
    }
  }
}

// -----------------------------------------------------------------------------
// Views
// -----------------------------------------------------------------------------

/** The same nodes with only the given edge kinds. */
export function filterGraphKinds(graph: SemanticGraph, kinds: ReadonlySet<GraphEdgeKind>): SemanticGraph {
  return { nodes: graph.nodes, edges: graph.edges.filter((e) => kinds.has(e.kind)) };
}

/**
 * The neighborhood of `rootId`: undirected BFS over the graph's edges up to
 * `depth` hops (run this on an already kind-filtered graph so the depth
 * respects the edge toggles). Empty when the root is not a graph node.
 */
export function extractEgoGraph(graph: SemanticGraph, rootId: string, depth: number): SemanticGraph {
  if (!graph.nodes.has(rootId)) {
    return { nodes: new Map(), edges: [] };
  }

  const adjacency = new Map<string, string[]>();
  for (const edge of graph.edges) {
    adjacency.set(edge.from, [...(adjacency.get(edge.from) ?? []), edge.to]);
    adjacency.set(edge.to, [...(adjacency.get(edge.to) ?? []), edge.from]);
  }

  const visited = new Set<string>([rootId]);
  let frontier = [rootId];
  for (let hop = 0; hop < depth && frontier.length > 0; hop++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const neighbor of adjacency.get(id) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          next.push(neighbor);
        }
      }
    }
    frontier = next;
  }

  const nodes = new Map<string, SemanticNode>();
  for (const [id, node] of graph.nodes) {
    if (visited.has(id)) {
      nodes.set(id, node);
    }
  }
  return { nodes, edges: graph.edges.filter((e) => visited.has(e.from) && visited.has(e.to)) };
}

/** Deterministic size guard: keeps the first `maxNodes` nodes in document order. */
export function capGraph(graph: SemanticGraph, maxNodes: number): CappedGraph {
  const totalNodes = graph.nodes.size;
  if (totalNodes <= maxNodes) {
    return { graph, totalNodes };
  }

  const nodes = new Map<string, SemanticNode>();
  for (const [id, node] of graph.nodes) {
    if (nodes.size >= maxNodes) {
      break;
    }

    nodes.set(id, node);
  }
  return {
    graph: { nodes, edges: graph.edges.filter((e) => nodes.has(e.from) && nodes.has(e.to)) },
    totalNodes,
  };
}
