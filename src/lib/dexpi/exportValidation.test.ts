import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sceneToSvg } from "./exportSvg.ts";
import { flattenScene } from "./flattenScene.ts";
import { parseDexpiDocument } from "./parseDocument.ts";

const BROKEN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Model name="Broken">
  <Object id="Dup" type="Plant/Piping.Pipe"/>
  <Object id="Dup" type="Plant/Piping.Pipe"/>
  <Object id="D1" type="Core/Diagram.Diagram">
    <Components property="Groups">
      <Object type="Core/Diagram.RepresentationGroup">
        <References objects="#Ghost" property="Represents"/>
        <Components property="Elements">
          <Object type="Core/Diagram.ShapeUsage">
            <References objects="#NoSuchShape" property="Shape"/>
          </Object>
          <Object type="Core/Diagram.PolyLine">
            <Data property="Points">
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>0</Double></Data>
                <Data property="Y"><Double>0</Double></Data>
              </AggregatedDataValue>
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>5</Double></Data>
                <Data property="Y"><Double>5</Double></Data>
              </AggregatedDataValue>
            </Data>
          </Object>
        </Components>
      </Object>
    </Components>
  </Object>
</Model>`;

describe("validateDocument", () => {
  it("reports duplicate ids, dangling references, unknown shapes and missing extent", () => {
    const doc = parseDexpiDocument(BROKEN_XML).data;
    const rules = new Set(doc?.issues.map((i) => i.ruleId));
    expect(rules.has("V01")).toBe(true); // duplicate id
    expect(rules.has("V02")).toBe(true); // dangling #Ghost / #NoSuchShape
    expect(rules.has("V03")).toBe(true); // unknown catalogue shape
    expect(rules.has("V05")).toBe(true); // pipes without connections
    expect(rules.has("V06")).toBe(true); // no diagram extent
    // errors sort before warnings
    const severities = doc?.issues.map((i) => i.severity) ?? [];
    expect(severities.indexOf("warning")).toBeGreaterThan(severities.lastIndexOf("error") === -1 ? -1 : 0);
  });

  it("matches the reference viewer's findings on the reference P&ID", () => {
    // Parity targets (from the DEXPIViewer validation run on this file):
    // 2 errors — missing ExportDateTime, invalid "NominalCapacity(Volume)"
    // template attribute on Tank1 — and 2 orphaned-node warnings.
    const xml = readFileSync(join(__dirname, "../../../refrences/reference_pid.xml"), "utf-8");
    const doc = parseDexpiDocument(xml).data;
    const errors = doc?.issues.filter((i) => i.severity === "error") ?? [];
    expect(errors.map((i) => i.ruleId).sort()).toEqual(["V08", "V09"]);
    expect(errors.some((i) => i.message.includes("ExportDateTime"))).toBe(true);
    expect(errors.some((i) => i.message.includes("NominalCapacity(Volume)"))).toBe(true);

    const orphanIds = (doc?.issues ?? []).filter((i) => i.ruleId === "V07").map((i) => i.objectId);
    expect(orphanIds.sort()).toEqual(["PipingNode60", "PipingNode61"]);
  });
});

describe("exporters", () => {
  const xml = readFileSync(join(__dirname, "../../../refrences/reference_pid.xml"), "utf-8");
  const doc = parseDexpiDocument(xml).data;

  it("sceneToSvg emits a complete standalone SVG", () => {
    const svg = sceneToSvg(
      doc?.scene ?? { nodes: [], shapes: new Map(), bounds: { minX: 0, minY: 0, maxX: 1, maxY: 1 } },
    );
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("<polyline");
    expect(svg).toContain("<text");
    expect(svg).toContain("</svg>");
    expect((svg.match(/<g transform=/g) ?? []).length).toBeGreaterThanOrEqual(60);
  });

  it("flattenScene resolves every usage into world primitives", () => {
    const scene = doc?.scene;
    if (!scene) {
      throw new Error("no scene");
    }

    const flat = flattenScene(scene);
    expect(flat.length).toBeGreaterThan(scene.nodes.length);
    expect(flat.every((p) => p.kind !== undefined)).toBe(true);
  });
});
