import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDiscProfile } from "./discProfile.ts";
import { sceneToSvg } from "./exportSvg.ts";
import { flattenScene } from "./flattenScene.ts";
import { parseDexpiDocument } from "./parseDocument.ts";
import type { DexpiDocument, SceneGraph } from "./types.ts";

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
    expect(rules.has("SCH-001")).toBe(true); // duplicate id
    expect(rules.has("SCH-002")).toBe(true); // dangling #Ghost / #NoSuchShape
    expect(rules.has("GFX-001")).toBe(true); // unknown catalogue shape
    expect(rules.has("CON-001")).toBe(true); // pipes without connections
    expect(rules.has("GFX-003")).toBe(true); // no diagram extent
    // errors sort before warnings
    const severities = doc?.issues.map((i) => i.severity) ?? [];
    expect(severities.indexOf("warning")).toBeGreaterThan(severities.lastIndexOf("error") === -1 ? -1 : 0);
  });

  it("matches (and now exceeds) the reference viewer's findings on the reference P&ID", () => {
    // Historic parity targets (DEXPIViewer): missing ExportDateTime +
    // invalid "NominalCapacity(Volume)" template attribute, 2 orphaned
    // nodes. Model-driven validation (M10) generalizes the first into
    // MDL-003 and additionally finds 8 Shapes missing their required
    // SymbolRegistrationNumber — genuine DEXPI 2.0 spec findings the
    // hand-written rules never covered.
    const xml = readFileSync(join(__dirname, "../../../refrences/reference_pid.xml"), "utf-8");
    const doc = parseDexpiDocument(xml).data;
    const errors = doc?.issues.filter((i) => i.severity === "error") ?? [];
    expect(errors.filter((i) => i.ruleId === "META-002").length).toBe(1);
    expect(errors.some((i) => i.message.includes("NominalCapacity(Volume)"))).toBe(true);

    const model = errors.filter((i) => i.ruleId === "MDL-003");
    expect(model.some((i) => i.message.includes("ExportDateTime"))).toBe(true);
    expect(model.filter((i) => i.message.includes("SymbolRegistrationNumber")).length).toBe(8);
    expect(errors.length).toBe(10);

    const orphanIds = (doc?.issues ?? []).filter((i) => i.ruleId === "CON-002").map((i) => i.objectId);
    expect(orphanIds.sort()).toEqual(["PipingNode60", "PipingNode61"]);
  });

  it("flags the reference P&ID's spare nozzles but no diameter mismatches", () => {
    const xml = readFileSync(join(__dirname, "../../../refrences/reference_pid.xml"), "utf-8");
    const doc = parseDexpiDocument(xml).data;
    const issues = doc?.issues ?? [];
    const spares = issues.filter((i) => i.ruleId === "CON-003");
    expect(spares.map((i) => i.objectId).sort()).toEqual(["Nozzle17", "Nozzle18", "Nozzle19"]);
    expect(spares.every((i) => i.severity === "info")).toBe(true);

    // The file's DN changes all run through PipeReducers, which live inside
    // segments — segment endpoint references must not be flagged.
    expect(issues.filter((i) => i.ruleId === "CON-004")).toEqual([]);
  });
});

/** The fixture always parses; failing loudly beats exporting an empty sheet. */
function sceneOf(doc: DexpiDocument | undefined): SceneGraph {
  if (!doc) {
    throw new Error("the reference P&ID fixture did not parse");
  }

  return doc.scene;
}

describe("exporters", () => {
  const xml = readFileSync(join(__dirname, "../../../refrences/reference_pid.xml"), "utf-8");
  const doc = parseDexpiDocument(xml).data;

  it("sceneToSvg emits a complete standalone SVG", () => {
    const svg = sceneToSvg(sceneOf(doc));
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

describe("V02 profile-symbol references (DISC_EXAMPLE-14-13)", () => {
  const xml = readFileSync(
    join(__dirname, "../../../refrences/discdexpi-2026pack/Blueprint/DISC_EXAMPLE-14/DISC_EXAMPLE-14-13.xml"),
    "utf-8",
  );

  it("without a profile: aggregated warnings, never one finding per reference", () => {
    const doc = parseDexpiDocument(xml).data;
    if (!doc) {
      throw new Error("parse failed");
    }

    const profileFindings = doc.issues.filter((i) => i.message.includes("DiscProfile/"));
    expect(profileFindings.length).toBeGreaterThan(0);
    // 125 raw placements collapse to one finding per distinct symbol.
    expect(profileFindings.length).toBeLessThan(50);
    for (const finding of profileFindings) {
      expect(finding.ruleId).toBe("GFX-001");
      expect(finding.severity).toBe("warning");
      expect(finding.message).toContain("no DISC profile is loaded");
    }
  });

  it("with the official 0.6.3 profile: every symbol reference resolves", () => {
    const profileXml = readFileSync(
      join(__dirname, "../../../refrences/discdexpi-2026pack/Profile/xml/DiscProfile.xml"),
      "utf-8",
    );
    const profile = parseDiscProfile(profileXml).data;
    if (!profile) {
      throw new Error("profile parse failed");
    }

    const doc = parseDexpiDocument(xml, profile).data;
    if (!doc) {
      throw new Error("parse failed");
    }

    expect(doc.issues.filter((i) => i.message.includes("DiscProfile/"))).toEqual([]);

    // The sheet's "/Border" is a well-known representation shape with no
    // published geometry — a warning, never an error.
    const border = doc.issues.filter((i) => i.message.includes("/Border"));
    expect(border.length).toBe(1);
    expect(border[0]?.severity).toBe("warning");
  });
});
