import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildClassificationGroups } from "./classification.ts";
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

function parse(xml: string): DexpiDocument {
  const result = parseDexpiDocument(xml);
  if (!result.data) {
    throw new Error(result.error?.msg ?? "parse failed");
  }

  return result.data;
}

const HEAT_TRACED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Model name="Main">
  <Object id="Seg1" type="Plant/Piping.PipingNetworkSegment">
    <Data property="HeatTracingType"><DataReference data="Plant/Enumerations.HeatTracingTypeClassification.HeatTracingSystem"/></Data>
    <Components property="Items">
      <Object id="Pipe1" type="Plant/Piping.Pipe"/>
    </Components>
  </Object>
  <Object id="D1" type="Core/Diagram.Diagram">
    <Data property="MinX"><Double>0</Double></Data>
    <Data property="MinY"><Double>0</Double></Data>
    <Data property="MaxX"><Double>50</Double></Data>
    <Data property="MaxY"><Double>50</Double></Data>
    <Components property="Groups">
      <Object type="Core/Diagram.RepresentationGroup">
        <References objects="#Pipe1" property="Represents"/>
        <Components property="Elements">
          <Object type="Core/Diagram.ConnectorLine">
            <Data property="InnerPoints">
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>0</Double></Data>
                <Data property="Y"><Double>10</Double></Data>
              </AggregatedDataValue>
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>40</Double></Data>
                <Data property="Y"><Double>10</Double></Data>
              </AggregatedDataValue>
            </Data>
          </Object>
        </Components>
      </Object>
    </Components>
  </Object>
</Model>`;

describe("buildClassificationGroups (reference P&ID)", () => {
  const doc = load("reference_pid.xml");

  it("groups by effective FluidCode with ancestor inheritance", () => {
    const groups = buildClassificationGroups(doc, "fluidCode");
    expect(new Set(groups.map((g) => g.key))).toEqual(new Set(["MNc", "MNb", "QSa", "QSb", "WKa", "WKb"]));
    expect(groups[0]?.key).toBe("MNc");

    // A child without its own FluidCode inherits the nearest ancestor's value.
    const carrier = [...doc.plant.byId.values()].find(
      (n) =>
        n.attributes.some((a) => a.name === "FluidCode") &&
        n.children.some((c) => !c.attributes.some((a) => a.name === "FluidCode")),
    );
    if (!carrier) {
      throw new Error("fixture has no FluidCode carrier with attribute-less children");
    }

    const code = carrier.attributes.find((a) => a.name === "FluidCode")?.value ?? "";
    const child = carrier.children.find((c) => !c.attributes.some((a) => a.name === "FluidCode"));
    expect(groups.find((g) => g.key === code)?.objectIds).toContain(child?.id);
  });

  it("groups by PipingClassCode", () => {
    const groups = buildClassificationGroups(doc, "pipingClass");
    expect(groups.map((g) => g.key)).toEqual(["75HB13", "73HG12"]);
  });

  it("groups signal & instrument-line objects per semantics, one color each", () => {
    const groups = buildClassificationGroups(doc, "signal");
    expect(groups.length).toBeGreaterThanOrEqual(1);
    const ids = groups.flatMap((g) => g.objectIds);
    expect(ids.length).toBeGreaterThanOrEqual(9);
    // Reference P&ID carries no SignalConveyingFunctionTypeRepresentation,
    // so groups fall back to the bare class names.
    for (const group of groups) {
      expect(group.key.length).toBeGreaterThan(0);
    }
    for (const id of ids) {
      const typeName = doc.plant.byId.get(id)?.typeName ?? "";
      expect(
        typeName.includes("Signal") ||
          typeName.endsWith("MeasuringLineFunction") ||
          typeName.endsWith("ActuatingFunction"),
      ).toBe(true);
    }
  });

  it("splits DISC signals by their type representation", () => {
    const discXml = readFileSync(
      join(
        __dirname,
        "../../../refrences/discdexpi-2026pack/Blueprint/DISC_EXAMPLE-14/DISC_EXAMPLE-14-08.xml",
      ),
      "utf-8",
    );
    const discDoc = parseDexpiDocument(discXml).data;
    if (!discDoc) {
      throw new Error("parse failed");
    }

    const keys = buildClassificationGroups(discDoc, "signal").map((g) => g.key);
    expect(keys).toContain("SignalConveying");
    expect(keys).toContain("ElectricalSignalConveying");
    expect(keys).toContain("BusSignalConveying");
  });

  it("heatTrace is empty for this fixture and off always is", () => {
    expect(buildClassificationGroups(doc, "heatTrace")).toEqual([]);
    expect(buildClassificationGroups(doc, "off")).toEqual([]);
  });
});

describe("buildClassificationGroups (heat trace + Process model)", () => {
  it("exposes the scene's heat-traced ids as one group", () => {
    const doc = parse(HEAT_TRACED_XML);
    expect(doc.scene.heatTracedIds.size).toBeGreaterThan(0);
    const groups = buildClassificationGroups(doc, "heatTrace");
    expect(groups.length).toBe(1);
    expect(new Set(groups[0]?.objectIds)).toEqual(doc.scene.heatTracedIds);
    expect(groups[0]?.objectIds).toContain("Pipe1");
  });

  it("is honestly empty on the Tennessee Eastman Process model", () => {
    const doc = load("examples/dexpi-2.0/TennesseeEastman-vpd-enriched.xml");
    expect(buildClassificationGroups(doc, "fluidCode")).toEqual([]);
    expect(buildClassificationGroups(doc, "signal")).toEqual([]);
  });
});
