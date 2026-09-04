import { describe, expect, it } from "vitest";
import { collectNodePositionKinds } from "./nodePositionKinds.ts";
import type { NodePositionMarker } from "./types.ts";

function marker(source: "file" | "profile", kind: string): NodePositionMarker {
  return { source, kind, point: { x: 0, y: 0 } };
}

describe("collectNodePositionKinds", () => {
  it("counts each source/kind pair separately", () => {
    const rows = collectNodePositionKinds([
      marker("file", "PipingNodePosition"),
      marker("file", "PipingNodePosition"),
      marker("profile", "Piping"),
    ]);

    expect(rows).toEqual([
      { source: "file", kind: "PipingNodePosition", count: 2 },
      { source: "profile", kind: "Piping", count: 1 },
    ]);
  });

  it("puts file kinds before profile kinds, each by descending count", () => {
    const rows = collectNodePositionKinds([
      marker("profile", "Auxiliary"),
      marker("profile", "Piping"),
      marker("profile", "Piping"),
      marker("file", "InstrumentationNodePosition"),
      marker("file", "PipingNodePosition"),
      marker("file", "PipingNodePosition"),
    ]);

    expect(rows.map((r) => `${r.source}:${r.kind}`)).toEqual([
      "file:PipingNodePosition",
      "file:InstrumentationNodePosition",
      "profile:Piping",
      "profile:Auxiliary",
    ]);
  });

  it("returns nothing for a drawing with no node positions", () => {
    expect(collectNodePositionKinds([])).toEqual([]);
  });
});
