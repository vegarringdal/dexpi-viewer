import { componentObjects, directChildrenByTag } from "./xml.ts";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type ConnectivityGraph = Readonly<{
  /** Flow edges: id → ids it flows INTO. */
  forward: ReadonlyMap<string, ReadonlySet<string>>;
  /** Flow edges reversed: id → ids that flow into it. */
  backward: ReadonlyMap<string, ReadonlySet<string>>;
  /** Undirected pass-through links (port/node/nozzle ↔ owning item). */
  bridges: ReadonlyMap<string, ReadonlySet<string>>;
}>;

export type TraceDirection = "upstream" | "downstream";

// -----------------------------------------------------------------------------
// Graph construction
// -----------------------------------------------------------------------------

/** References that mean "flow comes FROM the target" (target → owner). */
const SOURCE_PROPS = new Set(["Source", "SourceItem", "SourceNode", "Inlet", "UpstreamItem"]);
/** References that mean "flow goes TO the target" (owner → target). */
const TARGET_PROPS = new Set(["Target", "TargetItem", "TargetNode", "Outlet", "DownstreamItem"]);

/** Connection points that let flow pass through their owning item. */
export function isPassThroughType(type: string): boolean {
  const local = type.split(".").pop() ?? type;
  return local.endsWith("Port") || local.endsWith("Node") || local === "Nozzle" || local === "Chamber";
}

function addEdge(map: Map<string, Set<string>>, from: string, to: string): void {
  const set = map.get(from) ?? new Set<string>();
  set.add(to);
  map.set(from, set);
}

/**
 * Builds the flow-connectivity graph from the conceptual model: directed
 * edges from Source/Target-family references (pipes, streams, connector
 * items) plus undirected bridges between ports/nodes/nozzles and the item
 * that owns them, so a trace passes through equipment rather than stopping
 * at its boundary.
 */
export function buildConnectivity(root: Element): ConnectivityGraph {
  const forward = new Map<string, Set<string>>();
  const backward = new Map<string, Set<string>>();
  const bridges = new Map<string, Set<string>>();

  for (const el of root.querySelectorAll("Object[id]")) {
    const id = el.getAttribute("id");
    if (!id) {
      continue;
    }

    for (const refs of directChildrenByTag(el, "References")) {
      const property = refs.getAttribute("property") ?? "";
      const isSource = SOURCE_PROPS.has(property);
      const isTarget = TARGET_PROPS.has(property);
      if (!isSource && !isTarget) {
        continue;
      }

      for (const raw of (refs.getAttribute("objects") ?? "").split(/\s+/)) {
        const target = raw.startsWith("#") ? raw.slice(1) : raw;
        if (!target) {
          continue;
        }

        const [from, to] = isSource ? [target, id] : [id, target];
        addEdge(forward, from, to);
        addEdge(backward, to, from);
      }
    }

    for (const child of componentObjects(el)) {
      const childId = child.getAttribute("id");
      if (childId && isPassThroughType(child.getAttribute("type") ?? "")) {
        addEdge(bridges, id, childId);
        addEdge(bridges, childId, id);
      }
    }
  }

  return { forward, backward, bridges };
}

// -----------------------------------------------------------------------------
// Tracing
// -----------------------------------------------------------------------------

/**
 * Every object reachable from `originId` in the given flow direction
 * (origin included). Bridges are followed in both directions so the trace
 * runs through vessels, valves and pumps via their connection points.
 */
/**
 * Objects reachable from `originId` in BOTH flow directions — members of a
 * recirculation loop through the origin. Empty when the flow through the
 * origin is strictly one-way. The origin and its own connection points are
 * excluded.
 */
export function findLoopMembers(graph: ConnectivityGraph, originId: string): Set<string> {
  const up = traceConnectivity(graph, originId, "upstream");
  const down = traceConnectivity(graph, originId, "downstream");
  const own = new Set([originId, ...(graph.bridges.get(originId) ?? [])]);
  const loop = new Set<string>();
  for (const id of up) {
    if (down.has(id) && !own.has(id)) {
      loop.add(id);
    }
  }
  return loop;
}

export function traceConnectivity(
  graph: ConnectivityGraph,
  originId: string,
  direction: TraceDirection,
): Set<string> {
  const flow = direction === "downstream" ? graph.forward : graph.backward;
  const seen = new Set<string>([originId]);
  const queue = [originId];
  while (queue.length > 0) {
    const current = queue.pop();
    if (current === undefined) {
      break;
    }

    for (const next of flow.get(current) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
    for (const next of graph.bridges.get(current) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}
