import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isPassThroughType } from "../dexpi/connectivity.ts";
import { parseDexpiDocument } from "../dexpi/parseDocument.ts";
import type { DexpiDocument } from "../dexpi/types.ts";
import {
  buildSemanticGraph,
  capGraph,
  classifyHardware,
  extractEgoGraph,
  filterGraphKinds,
  type HardwareKind,
  resolveOwningNode,
  type SemanticGraph,
} from "./semanticGraph.ts";

function load(relative: string): DexpiDocument {
  const xml = readFileSync(join(__dirname, "../../../refrences", relative), "utf-8");
  const result = parseDexpiDocument(xml);
  if (!result.data) {
    throw new Error(result.error?.msg ?? "parse failed");
  }

  return result.data;
}

function idByLabel(doc: DexpiDocument, label: string): string {
  for (const node of doc.plant.byId.values()) {
    if (node.label === label) {
      return node.id;
    }
  }
  throw new Error(`no plant node labelled ${label}`);
}

function flowNeighbors(graph: SemanticGraph, id: string): Set<string> {
  const neighbors = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.kind !== "flow") {
      continue;
    }

    if (edge.from === id) {
      neighbors.add(edge.to);
    }
    if (edge.to === id) {
      neighbors.add(edge.from);
    }
  }
  return neighbors;
}

describe("buildSemanticGraph (reference P&ID)", () => {
  const doc = load("reference_pid.xml");
  const graph = buildSemanticGraph(doc);

  it("collapses connection hardware — no pass-through node appears in the graph", () => {
    for (const id of graph.nodes.keys()) {
      expect(isPassThroughType(doc.objectTypes.get(id) ?? "")).toBe(false);
    }
    expect(graph.nodes.size).toBeGreaterThan(20);
  });

  it("lifts a nozzle to its owning equipment", () => {
    const nozzle = [...doc.plant.byId.values()].find((n) => n.typeName === "ProcessEquipment.Nozzle");
    if (!nozzle) {
      throw new Error("fixture has no nozzle");
    }

    const owner = resolveOwningNode(doc.plant, nozzle.id);
    expect(owner).not.toBeNull();
    expect(owner).not.toBe(nozzle.id);
    expect(graph.nodes.has(owner ?? "")).toBe(true);
  });

  it("every edge endpoint is a graph node and no edge is a self-loop", () => {
    for (const edge of graph.edges) {
      expect(graph.nodes.has(edge.from)).toBe(true);
      expect(graph.nodes.has(edge.to)).toBe(true);
      expect(edge.from).not.toBe(edge.to);
    }
  });

  it("flow edges around the tank match a direct connectivity computation", () => {
    const tank = idByLabel(doc, "T4750");
    const own = new Set([tank, ...(doc.connectivity.bridges.get(tank) ?? [])]);
    const expected = new Set<string>();
    for (const point of own) {
      for (const neighbor of doc.connectivity.forward.get(point) ?? []) {
        const lifted = resolveOwningNode(doc.plant, neighbor);
        if (lifted !== null && lifted !== tank) {
          expected.add(lifted);
        }
      }
      for (const neighbor of doc.connectivity.backward.get(point) ?? []) {
        const lifted = resolveOwningNode(doc.plant, neighbor);
        if (lifted !== null && lifted !== tank) {
          expected.add(lifted);
        }
      }
    }
    expect(flowNeighbors(graph, tank)).toEqual(expected);
    expect(expected.size).toBeGreaterThan(0);
  });

  it("no reference edge duplicates a flow relation property", () => {
    const flowProps = ["Source", "SourceItem", "SourceNode", "Target", "TargetItem", "TargetNode"];
    for (const edge of graph.edges) {
      if (edge.kind === "reference") {
        expect(flowProps).not.toContain(edge.label ?? "");
      }
    }
  });

  it("containment links a piping network system to its segments", () => {
    const system = [...doc.plant.byId.values()].find((n) => n.typeName === "Piping.PipingNetworkSystem");
    if (!system) {
      throw new Error("fixture has no piping network system");
    }

    const segment = system.children.find((c) => c.typeName === "Piping.PipingNetworkSegment");
    if (!segment) {
      throw new Error("system has no segment child");
    }

    expect(
      graph.edges.some((e) => e.kind === "containment" && e.from === system.id && e.to === segment.id),
    ).toBe(true);
  });

  it("builds deterministically", () => {
    const again = buildSemanticGraph(doc);
    expect([...again.nodes.keys()]).toEqual([...graph.nodes.keys()]);
    expect(again.edges).toEqual(graph.edges);
  });
});

describe("buildSemanticGraph with shown hardware (reference P&ID)", () => {
  const doc = load("reference_pid.xml");
  const NOZZLES: ReadonlySet<HardwareKind> = new Set(["nozzle"]);
  const graph = buildSemanticGraph(doc, NOZZLES);

  it("keeps nozzles as connection nodes and still hides other hardware", () => {
    const kept = [...graph.nodes.values()];
    const nozzles = kept.filter((n) => n.category === "connection");
    expect(nozzles.length).toBeGreaterThan(0);
    for (const node of nozzles) {
      expect(node.typeName.endsWith("Nozzle")).toBe(true);
    }
    for (const node of kept) {
      const hardware = classifyHardware(doc.objectTypes.get(node.id) ?? "");
      expect(hardware === null || hardware === "nozzle").toBe(true);
    }
  });

  it("stitches a flow-connected nozzle to its owning equipment in flow direction", () => {
    const nozzle = [...graph.nodes.values()].find(
      (n) =>
        n.category === "connection" &&
        graph.edges.some((e) => e.kind === "flow" && (e.from === n.id || e.to === n.id)),
    );
    if (!nozzle) {
      throw new Error("no flow-connected nozzle in fixture");
    }

    const owner = doc.plant.byId.get(nozzle.id)?.parentId;
    const lifted = owner != null ? resolveOwningNode(doc.plant, owner, NOZZLES) : null;
    expect(
      graph.edges.some(
        (e) =>
          e.kind === "flow" &&
          ((e.from === nozzle.id && e.to === lifted) || (e.from === lifted && e.to === nozzle.id)),
      ),
    ).toBe(true);
  });

  it("selection lifting keeps a shown nozzle as itself", () => {
    const nozzle = [...doc.plant.byId.values()].find((n) => n.typeName === "ProcessEquipment.Nozzle");
    if (!nozzle) {
      throw new Error("fixture has no nozzle");
    }

    expect(resolveOwningNode(doc.plant, nozzle.id, NOZZLES)).toBe(nozzle.id);
    expect(resolveOwningNode(doc.plant, nozzle.id)).not.toBe(nozzle.id);
  });

  it("default build is unchanged by the optional parameter", () => {
    const plain = buildSemanticGraph(doc);
    expect(plain.nodes).toEqual(buildSemanticGraph(doc, new Set()).nodes);
    expect([...plain.nodes.values()].every((n) => n.category !== "connection")).toBe(true);
  });
});

describe("graph views (reference P&ID)", () => {
  const doc = load("reference_pid.xml");
  const graph = buildSemanticGraph(doc);

  it("filterGraphKinds keeps nodes and drops other edge kinds", () => {
    const flowOnly = filterGraphKinds(graph, new Set(["flow"]));
    expect(flowOnly.nodes.size).toBe(graph.nodes.size);
    expect(flowOnly.edges.every((e) => e.kind === "flow")).toBe(true);
    expect(flowOnly.edges.length).toBeGreaterThan(0);
  });

  it("ego graph includes the root and grows monotonically with depth", () => {
    const pump = idByLabel(doc, "P4712");
    const depth1 = extractEgoGraph(graph, pump, 1);
    const depth2 = extractEgoGraph(graph, pump, 2);
    expect(depth1.nodes.has(pump)).toBe(true);
    for (const id of depth1.nodes.keys()) {
      expect(depth2.nodes.has(id)).toBe(true);
    }
    expect(depth2.nodes.size).toBeGreaterThan(depth1.nodes.size);
  });

  it("depth-1 flow-only ego equals the pump's direct flow neighbours plus itself", () => {
    const pump = idByLabel(doc, "P4712");
    const flowOnly = filterGraphKinds(graph, new Set(["flow"]));
    const ego = extractEgoGraph(flowOnly, pump, 1);
    const expected = new Set([pump, ...flowNeighbors(flowOnly, pump)]);
    expect(new Set(ego.nodes.keys())).toEqual(expected);
  });

  it("ego graph of an unknown root is empty", () => {
    const ego = extractEgoGraph(graph, "no-such-id", 2);
    expect(ego.nodes.size).toBe(0);
    expect(ego.edges.length).toBe(0);
  });

  it("capGraph caps deterministically and keeps edges internal", () => {
    const capped = capGraph(graph, 10);
    expect(capped.totalNodes).toBe(graph.nodes.size);
    expect(capped.graph.nodes.size).toBe(10);
    expect([...capped.graph.nodes.keys()]).toEqual([...graph.nodes.keys()].slice(0, 10));
    for (const edge of capped.graph.edges) {
      expect(capped.graph.nodes.has(edge.from)).toBe(true);
      expect(capped.graph.nodes.has(edge.to)).toBe(true);
    }
    expect(capGraph(graph, graph.nodes.size).graph).toBe(graph);
  });
});
