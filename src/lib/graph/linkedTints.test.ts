import { describe, expect, it } from "vitest";
import { computeLinkedTints } from "./linkedTints.ts";
import type { SemanticEdge, SemanticNode } from "./semanticGraph.ts";

function makeNodes(entries: ReadonlyArray<readonly [string, string]>): Map<string, SemanticNode> {
  const nodes = new Map<string, SemanticNode>();
  for (const [id, typeName] of entries) {
    nodes.set(id, { id, label: id, typeName, category: "other", attributes: [] });
  }
  return nodes;
}

describe("computeLinkedTints", () => {
  const nodes = makeNodes([
    ["sel", "ProcessEquipment.Tank"],
    ["up", "Piping.Pipe"],
    ["down", "Piping.Pipe"],
    ["sig", "Instrumentation.SignalConveyingFunction"],
    ["ref", "Piping.Pipe"],
  ]);
  const edges: readonly SemanticEdge[] = [
    { from: "up", to: "sel", kind: "flow" },
    { from: "sel", to: "down", kind: "flow" },
    { from: "sel", to: "sig", kind: "flow" },
    { from: "sel", to: "ref", kind: "reference" },
  ];

  it("classifies direct flow neighbours by direction and signal kind", () => {
    const tints = computeLinkedTints(edges, nodes, "sel");
    expect(tints.get("up")).toBe("upstream");
    expect(tints.get("down")).toBe("downstream");
    expect(tints.get("sig")).toBe("signal");
  });

  it("ignores non-flow edges and unrelated nodes", () => {
    const tints = computeLinkedTints(edges, nodes, "sel");
    expect(tints.has("ref")).toBe(false);
    expect(tints.has("sel")).toBe(false);
  });

  it("returns nothing without a selection", () => {
    expect(computeLinkedTints(edges, nodes, null).size).toBe(0);
  });
});
