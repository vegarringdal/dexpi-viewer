import { describe, expect, it } from "vitest";
import { buildPlantModel, fullPlantModel } from "../dexpi/plantModel.ts";
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
    expect(stub?.card.broken).toBe(false);
    expect(stub?.card.rows).toEqual([{ name: "Abbreviation", value: "MCC", tone: "normal" }]);
  });

  it("shows unresolvable reference targets as broken error cards instead of hiding them", () => {
    const noInstances = buildObjectDiagram(plant, "PIF1");
    const stub = (noInstances?.neighbors ?? []).find((n) => n.relation === "profile");
    expect(stub?.card.broken).toBe(true);
    expect(stub?.card.severity).toBe("error");
    expect(stub?.card.issueRows.length).toBe(1);
  });

  it("carries validation findings onto cards as severity + issue rows", () => {
    const issuesById = new Map([
      [
        "PIF1",
        [
          { ruleId: "CON-001", severity: "warning" as const, message: "missing target", objectId: "PIF1" },
          { ruleId: "SCH-001", severity: "error" as const, message: "duplicate id", objectId: "PIF1" },
        ],
      ],
    ]);
    const diagram = buildObjectDiagram(plant, "PIF1", instances, 1, issuesById);
    expect(diagram?.center.severity).toBe("error");
    expect(diagram?.center.issueRows).toEqual(["CON-001: missing target", "SCH-001: duplicate id"]);
  });

  it("renders findings that name a property as red rows instead of message rows", () => {
    const issuesById = new Map([
      [
        "PIF1",
        [
          {
            ruleId: "META-002",
            severity: "error" as const,
            message: 'AttributeName "TIPS: UnitCode" is not a valid or reachable attribute…',
            objectId: "PIF1",
            attributeName: "TIPS: UnitCode",
          },
          {
            ruleId: "MDL-002",
            severity: "warning" as const,
            message: "Data property is not defined for this class",
            objectId: "PIF1",
            attributeName: "DiscProfile/TagType",
          },
        ],
      ],
    ]);
    const diagram = buildObjectDiagram(plant, "PIF1", instances, 1, issuesById);
    const rows = diagram?.center.rows ?? [];

    // Named-but-absent property → a red "(missing)" row carrying the message.
    const missing = rows.find((r) => r.name === "TIPS: UnitCode");
    expect(missing?.value).toBe("(missing)");
    expect(missing?.tone).toBe("issue");
    expect(missing?.tooltip).toContain("META-002");

    // Existing attribute row turns red in place, keeping its value.
    const tagType = rows.find((r) => r.name === "DiscProfile/TagType");
    expect(tagType?.value).toBe("FE");
    expect(tagType?.tone).toBe("issue");

    // Neither finding is duplicated as a ⚠ message row.
    expect(diagram?.center.issueRows).toEqual([]);
    expect(diagram?.center.severity).toBe("error");
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

describe("undefined-valued data properties", () => {
  it("shows properties the file carries with <Undefined/> values instead of hiding them", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Model name="Main">
  <Object id="PIF9" type="Plant/Instrumentation.ProcessInstrumentationFunction">
    <Data property="DiscProfile/ItemTag"><Undefined/></Data>
    <Data property="Vendor/CustomThing"><String>hello</String></Data>
  </Object>
</Model>`;
    const plant = buildPlantModel(rootOf(xml));
    const diagram = buildObjectDiagram(plant, "PIF9");
    const rows = diagram?.center.rows ?? [];
    expect(rows).toContainEqual({ name: "Vendor/CustomThing", value: "hello", tone: "normal" });
    expect(rows).toContainEqual({ name: "DiscProfile/ItemTag", value: "(undefined)", tone: "undefined" });
  });
});

describe("drawing mode (fullPlantModel)", () => {
  const DRAWING_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Model name="Main">
  <Object type="Core/EngineeringModel">
    <Components property="ConceptualModel">
      <Object id="Valve1" type="Plant/Piping.BallValve"/>
    </Components>
    <Components property="Diagram">
      <Object type="Core/Diagram.Diagram">
        <Components property="Groups">
          <Object type="Core/Diagram.RepresentationGroup">
            <References objects="#Valve1" property="Represents"/>
            <Components property="Elements">
              <Object type="Core/Diagram.Label">
                <Components property="Elements">
                  <Object type="Core/Diagram.AttributeRepresentation">
                    <Data property="AttributeName"><String>TagName</String></Data>
                    <References objects="#Valve1" property="Object"/>
                  </Object>
                </Components>
              </Object>
            </Components>
          </Object>
        </Components>
      </Object>
    </Components>
  </Object>
</Model>`;
  const root = rootOf(DRAWING_XML);

  it("keeps drawing objects out of the base model but in the full model, memoized", () => {
    const base = buildPlantModel(root);
    expect(base.byId.has("Valve1")).toBe(true);
    expect([...base.byId.values()].some((n) => n.type.startsWith("Core/Diagram"))).toBe(false);

    const full = fullPlantModel(root);
    expect(full.byId.has("Valve1")).toBe(true);
    expect([...full.byId.values()].some((n) => n.type === "Core/Diagram.RepresentationGroup")).toBe(true);
    expect(fullPlantModel(root)).toBe(full);
  });

  it("gives id-less drawing objects synthetic XPath ids and links them via Represents", () => {
    const full = fullPlantModel(root);
    const incoming = full.referencedBy.get("Valve1") ?? [];
    const represents = incoming.find((r) => r.property === "Represents");
    expect(represents?.fromId.startsWith("/Model/")).toBe(true);

    const diagram = buildObjectDiagram(full, "Valve1");
    const group = diagram?.neighbors.find((n) => n.card.subtitle === "Core/Diagram.RepresentationGroup");
    expect(group?.side).toBe("in");
    expect(group?.property).toBe("Represents");
    expect(group?.card.navigable).toBe(true);
  });

  it("centers on a synthetic drawing object and walks into its labels", () => {
    const full = fullPlantModel(root);
    const groupId = (full.referencedBy.get("Valve1") ?? []).find((r) => r.property === "Represents")?.fromId;
    if (!groupId) {
      throw new Error("Represents edge missing");
    }

    const diagram = buildObjectDiagram(full, groupId, undefined, 2);
    expect(diagram?.center.subtitle).toBe("Core/Diagram.RepresentationGroup");
    const subtitles = (diagram?.neighbors ?? []).map((n) => n.card.subtitle);
    expect(subtitles).toContain("Core/Diagram.Label");
    expect(subtitles).toContain("Core/Diagram.AttributeRepresentation");
  });
});
