import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findLoopMembers, traceConnectivity } from "./connectivity.ts";
import { parseDexpiDocument } from "./parseDocument.ts";
import type { DexpiDocument } from "./types.ts";

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

describe("connectivity (Tennessee Eastman, Process model)", () => {
  const doc = load("examples/dexpi-2.0/TennesseeEastman-vpd-enriched.xml");

  it("traces downstream from a feed source through streams to other steps", () => {
    const origin = idByLabel(doc, "CWS");
    const downstream = traceConnectivity(doc.connectivity, origin, "downstream");
    expect(downstream.size).toBeGreaterThan(3);

    const types = [...downstream].map((id) => doc.objectTypes.get(id) ?? "");
    expect(types.some((t) => t === "Process/Process.Stream")).toBe(true);
  });

  it("upstream of a sink includes its feeding source", () => {
    const sink = idByLabel(doc, "CWR");
    const upstream = traceConnectivity(doc.connectivity, sink, "upstream");
    expect(upstream.has(idByLabel(doc, "CWS"))).toBe(true);
  });
});

describe("connectivity (reference P&ID, Plant model)", () => {
  const doc = load("reference_pid.xml");

  it("traces through pipes, nodes and equipment", () => {
    const tank = idByLabel(doc, "T4750");
    const downstream = traceConnectivity(doc.connectivity, tank, "downstream");
    expect(downstream.size).toBeGreaterThan(10);

    const types = [...downstream].map((id) => doc.objectTypes.get(id) ?? "");
    expect(types.some((t) => t.includes("Piping.Pipe"))).toBe(true);
  });

  it("upstream and downstream of a mid-network item both reach other objects", () => {
    const pump = idByLabel(doc, "P4712");
    const up = traceConnectivity(doc.connectivity, pump, "upstream");
    const down = traceConnectivity(doc.connectivity, pump, "downstream");
    expect(up.size).toBeGreaterThan(2);
    expect(down.size).toBeGreaterThan(2);
    expect(up.has(idByLabel(doc, "T4750"))).toBe(true);
  });

  it("detects the tank's recirculation loop but not the one-way feed side", () => {
    const loop = findLoopMembers(doc.connectivity, idByLabel(doc, "T4750"));
    // The loop runs tank → P4712 → H1008/PV back into the tank's inlets.
    expect(loop.has(idByLabel(doc, "P4712"))).toBe(true);
    expect(loop.has(idByLabel(doc, "H1008"))).toBe(true);
    // The feed chain (P4711, H1007) is strictly upstream — never on the loop.
    expect(loop.has(idByLabel(doc, "P4711"))).toBe(false);
    expect(loop.has(idByLabel(doc, "H1007"))).toBe(false);
  });
});
