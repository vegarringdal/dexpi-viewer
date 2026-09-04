import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDexpiDocument } from "../dexpi/parseDocument.ts";
import type { DexpiDocument } from "../dexpi/types.ts";
import { edgePath, layoutGraph, truncateLabel } from "./layeredLayout.ts";
import {
  buildSemanticGraph,
  type SemanticEdge,
  type SemanticGraph,
  type SemanticNode,
} from "./semanticGraph.ts";

function load(relative: string): DexpiDocument {
  const xml = readFileSync(join(__dirname, "../../../refrences", relative), "utf-8");
  const result = parseDexpiDocument(xml);
  if (!result.data) {
    throw new Error(result.error?.msg ?? "parse failed");
  }

  return result.data;
}

function makeGraph(ids: readonly string[], edges: readonly SemanticEdge[]): SemanticGraph {
  const nodes = new Map<string, SemanticNode>();
  for (const id of ids) {
    nodes.set(id, { id, label: id, typeName: "Piping.Pipe", category: "piping", attributes: [] });
  }
  return { nodes, edges };
}

describe("layoutGraph (hand-built graphs)", () => {
  it("orders flow layers left to right on an acyclic chain", () => {
    const graph = makeGraph(
      ["a", "b", "c", "d"],
      [
        { from: "a", to: "b", kind: "flow" },
        { from: "b", to: "c", kind: "flow" },
        { from: "a", to: "d", kind: "flow" },
        { from: "d", to: "c", kind: "flow" },
      ],
    );
    const layout = layoutGraph(graph);
    for (const edge of graph.edges) {
      const from = layout.nodes.get(edge.from);
      const to = layout.nodes.get(edge.to);
      expect((from?.layer ?? 0) < (to?.layer ?? 0)).toBe(true);
    }
  });

  it("terminates on a flow cycle and layers every node", () => {
    const graph = makeGraph(
      ["a", "b", "c"],
      [
        { from: "a", to: "b", kind: "flow" },
        { from: "b", to: "c", kind: "flow" },
        { from: "c", to: "a", kind: "flow" },
      ],
    );
    const layout = layoutGraph(graph);
    expect(layout.nodes.size).toBe(3);
  });

  it("places containment-only and isolated nodes", () => {
    const graph = makeGraph(
      ["parent", "child", "loner"],
      [{ from: "parent", to: "child", kind: "containment" }],
    );
    const layout = layoutGraph(graph);
    expect(layout.nodes.size).toBe(3);
    const parent = layout.nodes.get("parent");
    const child = layout.nodes.get("child");
    expect((parent?.layer ?? 0) < (child?.layer ?? 0)).toBe(true);
  });

  it("verticalGapScale spreads stacked nodes without changing the structure", () => {
    const graph = makeGraph(
      ["a", "b", "c"],
      [
        { from: "a", to: "b", kind: "flow" },
        { from: "a", to: "c", kind: "flow" },
      ],
    );
    const normal = layoutGraph(graph);
    const spread = layoutGraph(graph, { verticalGapScale: 4 });
    expect(spread.height).toBeGreaterThan(normal.height);
    for (const [id, node] of normal.nodes) {
      expect(spread.nodes.get(id)?.layer).toBe(node.layer);
    }
  });

  it("returns a zero-extent layout for the empty graph", () => {
    const layout = layoutGraph(makeGraph([], []));
    expect(layout.width).toBe(0);
    expect(layout.height).toBe(0);
    expect(layout.nodes.size).toBe(0);
  });
});

describe("layoutGraph (real fixtures)", () => {
  it("lays out the reference P&ID deterministically with finite, non-overlapping coordinates", () => {
    const doc = load("reference_pid.xml");
    const graph = buildSemanticGraph(doc);
    const layout = layoutGraph(graph);
    const again = layoutGraph(graph);
    expect([...again.nodes.entries()]).toEqual([...layout.nodes.entries()]);

    expect(layout.nodes.size).toBe(graph.nodes.size);
    const byLayer = new Map<number, Array<{ y: number; height: number }>>();
    for (const node of layout.nodes.values()) {
      for (const value of [node.x, node.y, node.width, node.height]) {
        expect(Number.isFinite(value)).toBe(true);
      }
      byLayer.set(node.layer, [...(byLayer.get(node.layer) ?? []), { y: node.y, height: node.height }]);
    }
    for (const column of byLayer.values()) {
      // Walk the column top-down: each box must start at or below the bottom
      // edge of the one before it, i.e. no two boxes in a layer overlap.
      let bottom = Number.NEGATIVE_INFINITY;
      for (const box of [...column].sort((a, b) => a.y - b.y)) {
        expect(box.y).toBeGreaterThanOrEqual(bottom);
        bottom = box.y + box.height;
      }
    }
  });

  it("terminates and layers everything on Tennessee Eastman (contains recirculation loops)", () => {
    const doc = load("examples/dexpi-2.0/TennesseeEastman-vpd-enriched.xml");
    const graph = buildSemanticGraph(doc);
    const layout = layoutGraph(graph);
    expect(layout.nodes.size).toBe(graph.nodes.size);
    expect(layout.width).toBeGreaterThan(0);
    expect(layout.height).toBeGreaterThan(0);
  });
});

describe("edge paths and labels", () => {
  it("edgePath never emits NaN, including backward edges", () => {
    const graph = makeGraph(
      ["a", "b"],
      [
        { from: "a", to: "b", kind: "flow" },
        { from: "b", to: "a", kind: "flow" },
      ],
    );
    const layout = layoutGraph(graph);
    for (const edge of layout.edges) {
      const from = layout.nodes.get(edge.from);
      const to = layout.nodes.get(edge.to);
      if (!from || !to) {
        throw new Error("edge endpoint missing from layout");
      }

      expect(edgePath(from, to)).not.toContain("NaN");
    }
  });

  it("truncateLabel keeps short text and ellipsizes long text", () => {
    expect(truncateLabel("Pipe1", 200)).toBe("Pipe1");
    const truncated = truncateLabel("a".repeat(100), 100);
    expect(truncated.endsWith("…")).toBe(true);
    expect(truncated.length).toBeLessThan(20);
  });
});
