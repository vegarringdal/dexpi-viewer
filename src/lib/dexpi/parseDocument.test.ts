import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDexpiDocument } from "./parseDocument.ts";
import { setUnitDisplayMode } from "./values.ts";

// -----------------------------------------------------------------------------
// Fixtures
// -----------------------------------------------------------------------------

const EXAMPLE_PATH = join(
  __dirname,
  "../../../refrences/examples/dexpi-2.0/TennesseeEastman-vpd-enriched.xml",
);
const REFERENCE_PID_PATH = join(__dirname, "../../../refrences/reference_pid.xml");

function wrapModel(inner: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Model name="Test">${inner}</Model>`;
}

const MINIMAL_DIAGRAM = wrapModel(`
  <Object id="D1" type="Core/Diagram.Diagram">
    <Data property="MinX"><Double>0</Double></Data>
    <Data property="MinY"><Double>0</Double></Data>
    <Data property="MaxX"><Double>100</Double></Data>
    <Data property="MaxY"><Double>50</Double></Data>
    <Components property="Groups">
      <Object id="G1" type="Core/Diagram.RepresentationGroup">
        <References objects="#EQ1" property="Represents" />
        <Components property="Elements">
          <Object id="P1" type="Core/Diagram.PolyLine">
            <Data property="Points">
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>10</Double></Data>
                <Data property="Y"><Double>20</Double></Data>
              </AggregatedDataValue>
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>30</Double></Data>
                <Data property="Y"><Double>40</Double></Data>
              </AggregatedDataValue>
            </Data>
            <Data property="Stroke">
              <AggregatedDataValue type="Core/Diagram.Stroke">
                <Data property="Width"><Double>0.5</Double></Data>
                <Data property="DashStyle"><DataReference data="Core/Diagram.DashStyle.Dash" /></Data>
                <Data property="Color">
                  <AggregatedDataValue type="Core/Diagram.Color">
                    <Data property="R"><Integer>255</Integer></Data>
                    <Data property="G"><Integer>0</Integer></Data>
                    <Data property="B"><Integer>0</Integer></Data>
                  </AggregatedDataValue>
                </Data>
              </AggregatedDataValue>
            </Data>
          </Object>
        </Components>
      </Object>
    </Components>
  </Object>
`);

// -----------------------------------------------------------------------------
// Synthetic fixtures
// -----------------------------------------------------------------------------

describe("parseDexpiDocument (synthetic)", () => {
  it("rejects malformed XML as a Result error", () => {
    const result = parseDexpiDocument("<Model><broken");
    expect(result.error).toBeDefined();
  });

  it("rejects a non-Model root", () => {
    const result = parseDexpiDocument("<PlantModel></PlantModel>");
    expect(result.error?.msg).toContain("PlantModel");
  });

  it("rejects a model without drawable content", () => {
    const result = parseDexpiDocument(wrapModel('<Object id="X" type="Process/Process.Stream" />'));
    expect(result.error?.msg).toContain("no drawable");
  });

  it("parses a polyline with stroke, dash, color and Represents tagging", () => {
    const result = parseDexpiDocument(MINIMAL_DIAGRAM);
    expect(result.error).toBeUndefined();
    const scene = result.data?.scene;
    expect(scene?.nodes).toHaveLength(1);

    const node = scene?.nodes[0];
    if (node?.kind !== "prim" || node.prim.kind !== "polyline") {
      throw new Error("expected a polyline prim node");
    }

    expect(node.objectId).toBe("EQ1");
    expect(node.prim.points).toEqual([
      { x: 10, y: 20 },
      { x: 30, y: 40 },
    ]);
    expect(node.prim.stroke.color).toEqual({ r: 255, g: 0, b: 0 });
    expect(node.prim.stroke.width).toBe(0.5);
    expect(node.prim.stroke.dash).toEqual([2, 1]);
  });

  it("uses the diagram's declared extent as bounds", () => {
    const result = parseDexpiDocument(MINIMAL_DIAGRAM);
    expect(result.data?.scene.bounds).toEqual({ minX: 0, minY: 0, maxX: 100, maxY: 50 });
  });
});

// -----------------------------------------------------------------------------
// Real-world fixture
// -----------------------------------------------------------------------------

describe("parseDexpiDocument (Tennessee Eastman)", () => {
  const xml = readFileSync(EXAMPLE_PATH, "utf-8");
  const result = parseDexpiDocument(xml);

  it("parses without error", () => {
    expect(result.error).toBeUndefined();
    expect(result.data).toBeDefined();
  });

  it("extracts metadata", () => {
    expect(result.data?.meta.originatingSystem).toBe("Model Broker for Diagrams");
  });

  it("collects the shape catalogue", () => {
    const shapes = result.data?.scene.shapes;
    expect(shapes?.size).toBeGreaterThanOrEqual(20);
    for (const shape of shapes?.values() ?? []) {
      expect(shape.primitives.length).toBeGreaterThan(0);
    }
  });

  it("collects a substantial scene with all element roles", () => {
    // 273 = every drawable inside the Diagram subtree (catalogue shape
    // definitions are in scene.shapes, not nodes): 50 polylines + 26
    // polygons + 79 texts + 43 connectors + 75 shape usages.
    const nodes = result.data?.scene.nodes ?? [];
    expect(nodes.length).toBe(273);

    const uses = nodes.filter((n) => n.kind === "use");
    expect(uses.length).toBeGreaterThanOrEqual(75);
    for (const use of uses) {
      expect(result.data?.scene.shapes.has(use.shapeId)).toBe(true);
    }

    const texts = nodes.filter((n) => n.kind === "prim" && n.prim.kind === "text");
    expect(texts.length).toBeGreaterThanOrEqual(75);
    expect(nodes.some((n) => n.role === "connector")).toBe(true);
    expect(nodes.some((n) => n.role === "label")).toBe(true);
  });

  it("uses the diagram extent as bounds", () => {
    const bounds = result.data?.scene.bounds;
    expect(bounds?.maxX).toBeCloseTo(907.113);
    expect(bounds?.maxY).toBeCloseTo(582.219);
  });

  it("builds the plant hierarchy with resolved labels and formatted values", () => {
    const plant = result.data?.plant;
    expect(plant?.roots.length).toBeGreaterThanOrEqual(1);
    expect(plant?.byId.size).toBeGreaterThan(100);

    const stream = plant?.byId.get("ProcessConnection_B0F596CA4D53F1A4805F79A784ADE4");
    expect(stream?.typeName).toBe("Process.Stream");
    expect(stream?.label).toBe("13");
    const volumeFlow = stream?.attributes.find((a) => a.name === "VolumeFlow");
    expect(volumeFlow?.value.startsWith("49.37 ")).toBe(true);

    for (const node of plant?.byId.values() ?? []) {
      expect(node.label.length).toBeGreaterThan(0);
    }
  });

  it("tags drawn nodes with the conceptual objects they represent", () => {
    const nodes = result.data?.scene.nodes ?? [];
    const tagged = nodes.filter((n) => n.objectId !== null);
    expect(tagged.length).toBeGreaterThan(100);
    const withKnownType = tagged.filter((n) => n.objectId && result.data?.objectTypes.has(n.objectId));
    expect(withKnownType.length).toBe(tagged.length);
  });
});

// -----------------------------------------------------------------------------
// Reference P&ID fixture (C01, Plant model)
// -----------------------------------------------------------------------------

describe("parseDexpiDocument (reference P&ID)", () => {
  const xml = readFileSync(REFERENCE_PID_PATH, "utf-8");
  const result = parseDexpiDocument(xml);

  it("parses without error", () => {
    expect(result.error).toBeUndefined();
  });

  it("stitches every ConnectorLine to drawable geometry via node positions", () => {
    // The file has 35 connector lines; 25 of them carry NO inner points and
    // exist only as Source/Target node-position references.
    const connectors = (result.data?.scene.nodes ?? []).filter((n) => n.role === "connector");
    expect(connectors.length).toBe(35);
    for (const node of connectors) {
      if (node.kind !== "prim" || node.prim.kind !== "polyline") {
        throw new Error("connector must be a polyline prim");
      }

      expect(node.prim.points.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("parses combined alignments (LeftBottom etc.)", () => {
    const texts = (result.data?.scene.nodes ?? []).flatMap((n) =>
      n.kind === "prim" && n.prim.kind === "text" ? [n.prim] : [],
    );
    expect(texts.some((t) => t.hAlign === "Left" && t.vAlign === "Bottom")).toBe(true);
    expect(texts.some((t) => t.hAlign === "Center" && t.vAlign === "Bottom")).toBe(true);
  });

  it("marks typed label groups (ValveLabel, NozzleStandardLabel…) as labels", () => {
    const labels = (result.data?.scene.nodes ?? []).filter((n) => n.role === "label");
    expect(labels.length).toBeGreaterThan(50);
  });

  it("builds the plant hierarchy with tag names", () => {
    const plant = result.data?.plant;
    const labels = [...(plant?.byId.values() ?? [])].map((n) => n.label);
    expect(labels.some((l) => /^P\d{4}/.test(l) || /^T\d{4}/.test(l))).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// Deeply nested group structure (spec: Groups composes GraphicsGroup, so
// RepresentationGroups nest arbitrarily and re-anchor Represents per level)
// -----------------------------------------------------------------------------

describe("nested representation groups", () => {
  it("finds a Label under nested RepresentationGroups, anchored to the innermost Represents", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Model name="Main">
  <Object id="Outer1" type="Plant/ProcessEquipment.Tank"/>
  <Object id="Inner1" type="Plant/ProcessEquipment.Nozzle"/>
  <Object id="D1" type="Core/Diagram.Diagram">
    <Data property="MinX"><Double>0</Double></Data>
    <Data property="MinY"><Double>0</Double></Data>
    <Data property="MaxX"><Double>50</Double></Data>
    <Data property="MaxY"><Double>50</Double></Data>
    <Components property="Groups">
      <Object type="Core/Diagram.RepresentationGroup">
        <References objects="#Outer1" property="Represents"/>
        <Components property="Groups">
          <Object type="Core/Diagram.RepresentationGroup">
            <References objects="#Inner1" property="Represents"/>
            <Components property="Groups">
              <Object type="Core/Diagram.Label">
                <Components property="Elements">
                  <Object type="Core/Diagram.Text">
                    <Data property="Value"><String>DEEP LABEL</String></Data>
                    <Data property="Position">
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
        </Components>
      </Object>
    </Components>
  </Object>
</Model>`;
    const doc = parseDexpiDocument(xml).data;
    const label = (doc?.scene.nodes ?? []).find(
      (n) => n.kind === "prim" && n.prim.kind === "text" && n.prim.value === "DEEP LABEL",
    );
    expect(label).toBeDefined();
    expect(label?.role).toBe("label");
    // The innermost RepresentationGroup's Represents wins, not the outer one.
    expect(label?.objectId).toBe("Inner1");
  });
});

// -----------------------------------------------------------------------------
// PersistentIdentifiers
// -----------------------------------------------------------------------------

describe("persistent identifiers", () => {
  it("collects Context + Value pairs from a PersistentIdentifiers component", () => {
    // Neither bundled fixture carries any, so inject one per the spec model
    // (ConceptualObject --0..*--> PersistentIdentifier {Context, Value}).
    const xml = readFileSync(REFERENCE_PID_PATH, "utf-8").replace(
      /(<Object id="ActuatingSystem1"[^>]*>)/,
      `$1<Components property="PersistentIdentifiers">
        <Object id="Pid1" type="Core/PersistentIdentifier">
          <Data property="Context"><String>CFIHOS</String></Data>
          <Data property="Value"><String>urn:example:actsys:4712-02</String></Data>
        </Object>
      </Components>`,
    );
    const node = parseDexpiDocument(xml).data?.plant.byId.get("ActuatingSystem1");
    expect(node?.persistentIds).toEqual([{ name: "CFIHOS", value: "urn:example:actsys:4712-02" }]);
  });
});

// -----------------------------------------------------------------------------
// TextTemplate resolution
// -----------------------------------------------------------------------------

describe("template resolution (reference P&ID)", () => {
  const xml = readFileSync(REFERENCE_PID_PATH, "utf-8");
  const result = parseDexpiDocument(xml);

  it("resolves attribute templates to the same text the literals snapshot", () => {
    // The title block's ApproverName template must resolve from
    // PlantMetaData1's attribute — matching its baked literal.
    const texts = (result.data?.scene.nodes ?? []).flatMap((n) =>
      n.kind === "prim" && n.prim.kind === "text" ? [n.prim] : [],
    );
    expect(texts.some((t) => t.value === "A. P. Prover" && t.template !== undefined)).toBe(true);

    // Broad sanity: templated texts resolve non-empty in ~every case.
    const templated = texts.filter((t) => t.template !== undefined);
    expect(templated.length).toBeGreaterThan(100);
    const empty = templated.filter((t) => t.value.trim().length === 0);
    expect(empty.length).toBe(0);
  });

  it("keeps drawing labels in symbol mode regardless of the unit display setting", () => {
    const sceneTexts = (doc: ReturnType<typeof parseDexpiDocument>["data"]): string[] =>
      (doc?.scene.nodes ?? []).flatMap((n) =>
        n.kind === "prim" && n.prim.kind === "text" ? [n.prim.value] : [],
      );

    setUnitDisplayMode("name");
    try {
      const nameModeDoc = parseDexpiDocument(xml).data;
      expect(sceneTexts(nameModeDoc)).toEqual(sceneTexts(result.data));

      // The setting still applies to attribute formatting (Properties panel).
      const attrs = [...(nameModeDoc?.plant.byId.values() ?? [])].flatMap((n) => n.attributes);
      expect(attrs.some((a) => /DegreeCelsius|Bar\b|Kilowatt/.test(a.value))).toBe(true);
    } finally {
      setUnitDisplayMode("symbol");
    }
  });

  it("resolves a template even when the literal snapshot is stale", () => {
    // Tamper: change the label's literal snapshot but keep the ApproverName
    // attribute — the resolved value must win over the stale snapshot.
    const tampered = xml.replace(/(property="Text">\s*<String>)A\. P\. Prover/, "$1STALE SNAPSHOT");
    const doc = parseDexpiDocument(tampered).data;
    const texts = (doc?.scene.nodes ?? []).flatMap((n) =>
      n.kind === "prim" && n.prim.kind === "text" ? [n.prim] : [],
    );
    expect(texts.some((t) => t.value === "A. P. Prover")).toBe(true);
    expect(texts.some((t) => t.value === "STALE SNAPSHOT")).toBe(false);
  });
});
