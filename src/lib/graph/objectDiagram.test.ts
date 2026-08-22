import { describe, expect, it } from "vitest";
import { buildPlantModel } from "../dexpi/plantModel.ts";
import { buildObjectDiagram } from "./objectDiagram.ts";
import { layoutObjectDiagram } from "./objectDiagramLayout.ts";

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<Model name="Main">
  <Object id="Loop1" type="Plant/Instrumentation.InstrumentationLoopFunction">
    <References objects="#PIF1" property="ProcessInstrumentationFunctions"/>
    <References objects="#System1" property="PlantSystem"/>
  </Object>
  <Object id="Tank1" type="Plant/ProcessEquipment.Tank">
    <Components property="Nozzles">
      <Object id="PIF1" type="Plant/Instrumentation.ProcessInstrumentationFunction">
        <Data property="DiscProfile/TagType"><String>FE</String></Data>
        <References objects="#Plant1" property="ParentStructure"/>
        <References objects="DiscProfile/InformationModel.Codes.MotorControlCenter" property="DiscProfile/TypeCode"/>
        <Components property="SignalConveyingFunctions">
          <Object id="SCF1" type="Plant/Instrumentation.SignalConveyingFunction"/>
        </Components>
      </Object>
    </Components>
  </Object>
  <Object id="Plant1" type="Plant/PlantStructure.ProcessPlant">
    <Data property="ProcessPlantIdentificationCode"><String>D</String></Data>
    <References objects="#System1" property="Systems"/>
  </Object>
  <Object id="System1" type="Plant/PlantStructure.PlantSystem"/>
</Model>`;

function rootOf(xml: string): Element {
  return new DOMParser().parseFromString(xml, "text/xml").documentElement;
}

describe("buildObjectDiagram", () => {
  const plant = buildPlantModel(rootOf(XML));
  const instances = new Map([
    ["InformationModel.Codes.MotorControlCenter", new Map([["Abbreviation", "MCC"]])],
  ]);
  const diagram = buildObjectDiagram(plant, "PIF1", instances);

  it("centers the object with its full raw data", () => {
    expect(diagram?.center.id).toBe("PIF1");
    expect(diagram?.center.rows.some((r) => r.name.includes("TagType") && r.value === "FE")).toBe(true);
  });

  it("collects incoming relations: containment parent and referenced-by with property names", () => {
    const incoming = (diagram?.neighbors ?? []).filter((n) => n.side === "in");
    expect(incoming.some((n) => n.relation === "parent" && n.card.id === "Tank1")).toBe(true);
    expect(
      incoming.some(
        (n) =>
          n.relation === "referencedBy" &&
          n.card.id === "Loop1" &&
          n.property === "ProcessInstrumentationFunctions" &&
          n.fromKey === "center",
      ),
    ).toBe(true);
  });

  it("collects outgoing references, children, and profile-instance stubs", () => {
    const outgoing = (diagram?.neighbors ?? []).filter((n) => n.side === "out");
    expect(
      outgoing.some(
        (n) => n.relation === "reference" && n.card.id === "Plant1" && n.property === "ParentStructure",
      ),
    ).toBe(true);
    expect(outgoing.some((n) => n.relation === "child" && n.card.id === "SCF1")).toBe(true);
    const stub = outgoing.find((n) => n.relation === "profile");
    expect(stub?.card.navigable).toBe(false);
    expect(stub?.card.rows).toEqual([{ name: "Abbreviation", value: "MCC" }]);
  });

  it("expands level 2 outward, chaining edges to the level-1 card", () => {
    const deep = buildObjectDiagram(plant, "PIF1", instances, 2);
    const system = deep?.neighbors.find((n) => n.card.id === "System1");
    expect(system?.side).toBe("out");
    expect(system?.level).toBe(2);
    expect(system?.property).toBe("Systems");
    const plant1 = deep?.neighbors.find((n) => n.card.id === "Plant1");
    expect(system?.fromKey).toBe(plant1?.key);
  });

  it("places every object once — first side/level to reach it wins", () => {
    const deep = buildObjectDiagram(plant, "PIF1", instances, 3);
    const ids = (deep?.neighbors ?? []).map((n) => n.card.id).filter((id) => id.length > 0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("returns null for unknown ids", () => {
    expect(buildObjectDiagram(plant, "Nope")).toBeNull();
  });
});

describe("layoutObjectDiagram", () => {
  const plant = buildPlantModel(rootOf(XML));

  it("places deeper levels further out and labels edges", () => {
    const diagram = buildObjectDiagram(plant, "PIF1", undefined, 2);
    if (!diagram) {
      throw new Error("no diagram");
    }

    const layout = layoutObjectDiagram(diagram);
    for (const neighbor of diagram.neighbors) {
      const placed = layout.neighbors.find((p) => p.key === neighbor.key);
      if (!placed) {
        throw new Error(`unplaced ${neighbor.key}`);
      }

      if (neighbor.side === "in") {
        expect(placed.x).toBeLessThan(layout.center.x);
      } else {
        expect(placed.x).toBeGreaterThan(layout.center.x);
      }
      if (neighbor.level === 2) {
        expect(Math.abs(placed.x - layout.center.x)).toBeGreaterThan(
          Math.abs(
            (layout.neighbors.find((p) => p.key.startsWith(`${neighbor.side}1:`))?.x ?? 0) - layout.center.x,
          ),
        );
      }
    }
    expect(layout.edges.some((e) => e.label === "ParentStructure")).toBe(true);
    // Cards show ALL rows: height grows with the full row count.
    expect(layout.center.height).toBeGreaterThan(30 + layout.center.card.rows.length * 12);
  });
});
