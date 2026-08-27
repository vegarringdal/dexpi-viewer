import { describe, expect, it } from "vitest";
import { parseDiscProfile } from "./discProfile.ts";
import { DEFAULT_HEAT_TRACE_LATERAL_OFFSET_MM, offsetPolyline } from "./heatTracing.ts";
import { parseDexpiDocument } from "./parseDocument.ts";
import type { CirclePrim, PolyLinePrim, PrimNode } from "./types.ts";

// -----------------------------------------------------------------------------
// Fixtures — heat tracing is main-file data: HeatTracingType on the piping
// segment; the pipe inside inherits the classification. The HeatTracingBreak
// is a logical property break, never drawn. Pipe1 runs left→right at y=10,
// Pipe2 (untraced) at y=20, Pipe3 (traced) runs bottom→top at x=45.
// Sig1 (logical signal nested in the traced Seg1) and Sig2 (a signal
// carrying HeatTracingType directly — a modelling error) draw connectors at
// y=30/y=35 and must never get an overlay: eligibility filters both direct
// classifications and inherited descendants.
// -----------------------------------------------------------------------------

const MAIN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Model name="Main">
  <Object id="Seg1" type="Plant/Piping.PipingNetworkSegment">
    <Data property="HeatTracingType"><DataReference data="Plant/Enumerations.HeatTracingTypeClassification.HeatTracingSystem"/></Data>
    <Data property="HeatTracingTypeRepresentation"><String>ET</String></Data>
    <Components property="Items">
      <Object id="Pipe1" type="Plant/Piping.Pipe"/>
      <Object id="Break1" type="DiscProfile/InformationModel.HeatTracingBreak"/>
      <Object id="Sig1" type="Plant/Instrumentation.MeasuringLineFunction"/>
    </Components>
  </Object>
  <Object id="Sig2" type="Plant/Instrumentation.SignalConveyingFunction">
    <Data property="HeatTracingType"><DataReference data="Plant/Enumerations.HeatTracingTypeClassification.HeatTracingSystem"/></Data>
  </Object>
  <Object id="Seg2" type="Plant/Piping.PipingNetworkSegment">
    <Components property="Items">
      <Object id="Pipe2" type="Plant/Piping.Pipe"/>
    </Components>
  </Object>
  <Object id="Seg3" type="Plant/Piping.PipingNetworkSegment">
    <Data property="HeatTracingType"><DataReference data="Plant/Enumerations.HeatTracingTypeClassification.HeatTracingSystem"/></Data>
    <Components property="Items">
      <Object id="Pipe3" type="Plant/Piping.Pipe"/>
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
      <Object type="Core/Diagram.RepresentationGroup">
        <References objects="#Pipe2" property="Represents"/>
        <Components property="Elements">
          <Object type="Core/Diagram.ConnectorLine">
            <Data property="InnerPoints">
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>0</Double></Data>
                <Data property="Y"><Double>20</Double></Data>
              </AggregatedDataValue>
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>40</Double></Data>
                <Data property="Y"><Double>20</Double></Data>
              </AggregatedDataValue>
            </Data>
          </Object>
        </Components>
      </Object>
      <Object type="Core/Diagram.RepresentationGroup">
        <References objects="#Pipe3" property="Represents"/>
        <Components property="Elements">
          <Object type="Core/Diagram.ConnectorLine">
            <Data property="InnerPoints">
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>45</Double></Data>
                <Data property="Y"><Double>0</Double></Data>
              </AggregatedDataValue>
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>45</Double></Data>
                <Data property="Y"><Double>40</Double></Data>
              </AggregatedDataValue>
            </Data>
          </Object>
        </Components>
      </Object>
      <Object type="Core/Diagram.RepresentationGroup">
        <References objects="#Sig1" property="Represents"/>
        <Components property="Elements">
          <Object type="Core/Diagram.ConnectorLine">
            <Data property="InnerPoints">
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>0</Double></Data>
                <Data property="Y"><Double>30</Double></Data>
              </AggregatedDataValue>
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>40</Double></Data>
                <Data property="Y"><Double>30</Double></Data>
              </AggregatedDataValue>
            </Data>
          </Object>
        </Components>
      </Object>
      <Object type="Core/Diagram.RepresentationGroup">
        <References objects="#Sig2" property="Represents"/>
        <Components property="Elements">
          <Object type="Core/Diagram.ConnectorLine">
            <Data property="InnerPoints">
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>0</Double></Data>
                <Data property="Y"><Double>35</Double></Data>
              </AggregatedDataValue>
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>40</Double></Data>
                <Data property="Y"><Double>35</Double></Data>
              </AggregatedDataValue>
            </Data>
          </Object>
        </Components>
      </Object>
    </Components>
  </Object>
</Model>`;

/** Minimal DISC profile: one symbol (required by the parser) + a heat-trace LineStroke. */
const PROFILE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Model name="Profile">
  <Object id="Sym1" name="ValveX" type="Profile/Symbol">
    <Components property="Variants">
      <Object type="Profile/SymbolVariant">
        <Components property="Primitives">
          <Object type="Core/Diagram.PolyLine">
            <Data property="Points">
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>0</Double></Data>
                <Data property="Y"><Double>0</Double></Data>
              </AggregatedDataValue>
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>4</Double></Data>
                <Data property="Y"><Double>0</Double></Data>
              </AggregatedDataValue>
            </Data>
          </Object>
        </Components>
      </Object>
    </Components>
  </Object>
  <Object id="Strokes1" type="Profile/AggregatedStroke">
    <Components property="SimpleStrokes">
      <Object id="PipeStroke" type="Profile/LineStroke">
        <Data property="LateralOffset"><Double>0</Double></Data>
        <Data property="Width"><Double>0.5</Double></Data>
      </Object>
      <Object id="TraceStroke" type="Profile/LineStroke">
        <Data property="Color">
          <AggregatedDataValue type="Core/Diagram.Color">
            <Data property="R"><Integer>0</Integer></Data>
            <Data property="G"><Integer>0</Integer></Data>
            <Data property="B"><Integer>255</Integer></Data>
          </AggregatedDataValue>
        </Data>
        <Data property="DashArray">
          <Double>1</Double>
          <Double>1</Double>
        </Data>
        <Data property="LateralOffset"><Double>-2</Double></Data>
        <Data property="LineRounding"><DataReference data="Profile/LineRounding.Butt"/></Data>
        <Data property="Offset"><Double>0.5</Double></Data>
        <Data property="Width"><Double>0.35</Double></Data>
      </Object>
    </Components>
  </Object>
</Model>`;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

type PolylineNode = PrimNode & Readonly<{ prim: PolyLinePrim }>;

function connectorPolylines(xml: string, profileXml: string | null = null): PolylineNode[] {
  const profile = profileXml ? (parseDiscProfile(profileXml).data ?? null) : null;
  const doc = parseDexpiDocument(xml, profile).data;
  return (doc?.scene.nodes ?? []).flatMap((n): PolylineNode[] =>
    n.kind === "prim" && n.role === "connector" && n.prim.kind === "polyline" ? [{ ...n, prim: n.prim }] : [],
  );
}

// -----------------------------------------------------------------------------
// offsetPolyline geometry
// -----------------------------------------------------------------------------

describe("offsetPolyline", () => {
  it("displaces a horizontal run vertically, to the right of the drawing direction", () => {
    // Heading +x in the y-down drawing space, so visual right is +y.
    const result = offsetPolyline(
      [
        { x: 0, y: 10 },
        { x: 40, y: 10 },
      ],
      1.5,
    );
    expect(result).toEqual([
      { x: 0, y: 11.5 },
      { x: 40, y: 11.5 },
    ]);
  });

  it("displaces a vertical run horizontally", () => {
    // Heading +y (down on screen), so visual right is -x.
    const result = offsetPolyline(
      [
        { x: 45, y: 0 },
        { x: 45, y: 40 },
      ],
      1.5,
    );
    expect(result).toEqual([
      { x: 43.5, y: 0 },
      { x: 43.5, y: 40 },
    ]);
  });

  it("puts a negative offset on the left side", () => {
    const result = offsetPolyline(
      [
        { x: 0, y: 10 },
        { x: 40, y: 10 },
      ],
      -2,
    );
    expect(result[0]?.y).toBeCloseTo(8);
    expect(result[1]?.y).toBeCloseTo(8);
  });

  it("joins a right-angle bend with a single continuous miter vertex", () => {
    // Right then down-screen: both offset segments must meet exactly at (9, 1).
    const result = offsetPolyline(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      1,
    );
    expect(result).toHaveLength(3);
    expect(result[0]?.x).toBeCloseTo(0);
    expect(result[0]?.y).toBeCloseTo(1);
    expect(result[1]?.x).toBeCloseTo(9);
    expect(result[1]?.y).toBeCloseTo(1);
    expect(result[2]?.x).toBeCloseTo(9);
    expect(result[2]?.y).toBeCloseTo(10);
  });

  it("clamps near-reversal bends instead of spiking", () => {
    const result = offsetPolyline(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 0.5 },
      ],
      1,
    );
    const bend = result[1];
    const distance = Math.hypot((bend?.x ?? 0) - 10, (bend?.y ?? 0) - 0);
    expect(distance).toBeLessThanOrEqual(4 + 1e-9);
  });

  it("drops coincident points and returns empty for degenerate input", () => {
    expect(offsetPolyline([{ x: 5, y: 5 }], 1)).toEqual([]);
    expect(
      offsetPolyline(
        [
          { x: 5, y: 5 },
          { x: 5, y: 5 },
        ],
        1,
      ),
    ).toEqual([]);
  });
});

// -----------------------------------------------------------------------------
// Overlays in the scene graph
// -----------------------------------------------------------------------------

describe("heat tracing overlays", () => {
  const connectors = connectorPolylines(MAIN_XML);

  it("adds a dashed overlay for the heat-traced segments' pipes only", () => {
    expect(connectors.filter((n) => n.objectId === "Pipe1")).toHaveLength(2);
    expect(connectors.filter((n) => n.objectId === "Pipe2")).toHaveLength(1);
    expect(connectors.filter((n) => n.objectId === "Pipe3")).toHaveLength(2);
  });

  it("keeps the base pipe untouched and dashes only the overlay", () => {
    const [base, overlay] = connectors.filter((n) => n.objectId === "Pipe1");
    expect(base?.prim.stroke.dash).toHaveLength(0);
    expect(base?.prim.points.every((p) => p.y === 10)).toBe(true);
    expect(overlay?.prim.stroke.dash.length).toBeGreaterThan(0);
  });

  it("offsets the horizontal overlay vertically by the default lateral offset", () => {
    const [, overlay] = connectors.filter((n) => n.objectId === "Pipe1");
    for (const p of overlay?.prim.points ?? []) {
      expect(p.y).toBeCloseTo(10 + DEFAULT_HEAT_TRACE_LATERAL_OFFSET_MM);
    }
  });

  it("offsets the vertical overlay horizontally by the default lateral offset", () => {
    const [, overlay] = connectors.filter((n) => n.objectId === "Pipe3");
    for (const p of overlay?.prim.points ?? []) {
      expect(p.x).toBeCloseTo(45 - DEFAULT_HEAT_TRACE_LATERAL_OFFSET_MM);
    }
  });

  it("never draws HeatTracingBreak objects", () => {
    const doc = parseDexpiDocument(MAIN_XML).data;
    expect((doc?.scene.nodes ?? []).some((n) => n.objectId === "Break1")).toBe(false);
  });

  it("gives no overlay to a logical signal nested below the heat-traced segment", () => {
    // Sig1 sits inside Seg1's Items, but eligibility filters inherited
    // descendants too — only its single base connector renders.
    const sig1 = connectors.filter((n) => n.objectId === "Sig1");
    expect(sig1).toHaveLength(1);
    expect(sig1[0]?.prim.stroke.dash).toHaveLength(0);
  });

  it("ignores HeatTracingType data placed directly on a logical signal", () => {
    const sig2 = connectors.filter((n) => n.objectId === "Sig2");
    expect(sig2).toHaveLength(1);
    expect(sig2[0]?.prim.stroke.dash).toHaveLength(0);
  });
});

// -----------------------------------------------------------------------------
// Profile-defined heat-trace stroke
// -----------------------------------------------------------------------------

describe("profile heat-trace stroke", () => {
  it("parses the LineStroke with a non-zero LateralOffset from the profile", () => {
    const profile = parseDiscProfile(PROFILE_XML).data;
    expect(profile?.heatTraceStroke).toEqual({
      color: { r: 0, g: 0, b: 255 },
      dashArray: [1, 1],
      lateralOffsetMm: -2,
      rounding: "Butt",
      dashOffsetMm: 0.5,
      widthMm: 0.35,
    });
  });

  it("draws the overlay with the profile's offset, side and style", () => {
    const connectors = connectorPolylines(MAIN_XML, PROFILE_XML);
    const [, overlay] = connectors.filter((n) => n.objectId === "Pipe1");
    // Negative offset = visual left of the drawing direction = -y for a +x run.
    for (const p of overlay?.prim.points ?? []) {
      expect(p.y).toBeCloseTo(8);
    }
    expect(overlay?.prim.stroke).toEqual({
      color: { r: 0, g: 0, b: 255 },
      width: 0.35,
      dash: [1, 1],
      dashOffset: 0.5,
      rounding: "Butt",
    });
  });
});

// -----------------------------------------------------------------------------
// Inline-symbol overlays (valves, fittings)
// -----------------------------------------------------------------------------

const VALVE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Model name="Main">
  <Object id="Seg1" type="Plant/Piping.PipingNetworkSegment">
    <Data property="HeatTracingType"><DataReference data="Plant/Enumerations.HeatTracingTypeClassification.HeatTracingSystem"/></Data>
    <Components property="Items">
      <Object id="Valve1" type="Plant/Piping.GlobeValve"/>
      <Object id="Valve2" type="Plant/Piping.GlobeValve"/>
    </Components>
  </Object>
  <Object id="Seg2" type="Plant/Piping.PipingNetworkSegment">
    <Components property="Items">
      <Object id="Valve3" type="Plant/Piping.GlobeValve"/>
    </Components>
  </Object>
  <Object id="Cat1" type="Core/Diagram.ShapeCatalogue">
    <Components property="Shapes">
      <Object id="ValveShape" type="Core/Diagram.Shape">
        <Components property="Primitives">
          <Object type="Core/Diagram.PolyLine">
            <Data property="Points">
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>-2</Double></Data>
                <Data property="Y"><Double>-1</Double></Data>
              </AggregatedDataValue>
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>2</Double></Data>
                <Data property="Y"><Double>1</Double></Data>
              </AggregatedDataValue>
            </Data>
          </Object>
        </Components>
      </Object>
    </Components>
  </Object>
  <Object id="D1" type="Core/Diagram.Diagram">
    <Data property="MinX"><Double>0</Double></Data>
    <Data property="MinY"><Double>0</Double></Data>
    <Data property="MaxX"><Double>50</Double></Data>
    <Data property="MaxY"><Double>50</Double></Data>
    <Components property="Groups">
      <Object type="Core/Diagram.RepresentationGroup">
        <References objects="#Valve1" property="Represents"/>
        <Components property="Elements">
          <Object type="Core/Diagram.ShapeUsage">
            <References objects="#ValveShape" property="Shape"/>
            <Data property="Position">
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>10</Double></Data>
                <Data property="Y"><Double>10</Double></Data>
              </AggregatedDataValue>
            </Data>
          </Object>
        </Components>
      </Object>
      <Object type="Core/Diagram.RepresentationGroup">
        <References objects="#Valve2" property="Represents"/>
        <Components property="Elements">
          <Object type="Core/Diagram.ShapeUsage">
            <References objects="#ValveShape" property="Shape"/>
            <Data property="Rotation"><Double>90</Double></Data>
            <Data property="Position">
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>30</Double></Data>
                <Data property="Y"><Double>10</Double></Data>
              </AggregatedDataValue>
            </Data>
          </Object>
        </Components>
      </Object>
      <Object type="Core/Diagram.RepresentationGroup">
        <References objects="#Valve3" property="Represents"/>
        <Components property="Elements">
          <Object type="Core/Diagram.ShapeUsage">
            <References objects="#ValveShape" property="Shape"/>
            <Data property="Position">
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

describe("inline symbol heat-trace overlays", () => {
  const doc = parseDexpiDocument(VALVE_XML).data;
  const symbolOverlays = (doc?.scene.nodes ?? []).flatMap((n) =>
    n.kind === "prim" && n.role === "symbol" && n.prim.kind === "polyline" ? [n] : [],
  );

  it("draws a dashed side-line for traced valves only", () => {
    expect(symbolOverlays.filter((n) => n.objectId === "Valve1")).toHaveLength(1);
    expect(symbolOverlays.filter((n) => n.objectId === "Valve2")).toHaveLength(1);
    expect(symbolOverlays.filter((n) => n.objectId === "Valve3")).toHaveLength(0);
  });

  it("places the line below a horizontal placement and beside a vertical one", () => {
    const horizontal = symbolOverlays.find((n) => n.objectId === "Valve1");
    const vertical = symbolOverlays.find((n) => n.objectId === "Valve2");
    const [h1, h2] = horizontal?.prim.kind === "polyline" ? horizontal.prim.points : [];
    const [v1, v2] = vertical?.prim.kind === "polyline" ? vertical.prim.points : [];
    // Horizontal: constant y under the symbol (bounds maxY 11 + offset 1.5).
    expect(h1?.y).toBeCloseTo(12.5);
    expect(h2?.y).toBeCloseTo(12.5);
    // Vertical: constant x to the right of the symbol.
    expect(v1?.x).toBeDefined();
    expect(v1?.x).toBeCloseTo(v2?.x ?? Number.NaN);
    expect((v1?.x ?? 0) > 30).toBe(true);
    const dashed = horizontal?.prim.kind === "polyline" ? horizontal.prim.stroke.dash : [];
    expect(dashed.length).toBeGreaterThan(0);
  });
});

// -----------------------------------------------------------------------------
// PropertyBreak exclusion (2026-08-27 director's call — see DESIGN.md)
// -----------------------------------------------------------------------------

const PROPERTY_BREAK_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Model name="Main">
  <Object id="Seg1" type="Plant/Piping.PipingNetworkSegment">
    <Data property="HeatTracingType"><DataReference data="Plant/Enumerations.HeatTracingTypeClassification.HeatTracingSystem"/></Data>
    <Components property="Items">
      <Object id="Valve1" type="Plant/Piping.GlobeValve"/>
      <Object id="Break1" type="Plant/Piping.PropertyBreak">
        <Data property="DiscProfile/BreakValue1"><String>AP110</String></Data>
        <Data property="DiscProfile/BreakValue2"><String>AP310</String></Data>
      </Object>
    </Components>
  </Object>
  <Object id="Cat1" type="Core/Diagram.ShapeCatalogue">
    <Components property="Shapes">
      <Object id="ValveShape" type="Core/Diagram.Shape">
        <Components property="Primitives">
          <Object type="Core/Diagram.PolyLine">
            <Data property="Points">
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>-2</Double></Data>
                <Data property="Y"><Double>-1</Double></Data>
              </AggregatedDataValue>
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>2</Double></Data>
                <Data property="Y"><Double>1</Double></Data>
              </AggregatedDataValue>
            </Data>
          </Object>
        </Components>
      </Object>
      <Object id="BreakWingShape" type="Core/Diagram.Shape">
        <Components property="Primitives">
          <Object type="Core/Diagram.Polygon">
            <Data property="FillStyle"><DataReference data="Core/Diagram.FillStyle.Solid"/></Data>
            <Data property="Points">
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>1.1</Double></Data>
                <Data property="Y"><Double>-9.6</Double></Data>
              </AggregatedDataValue>
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>1.1</Double></Data>
                <Data property="Y"><Double>-10.4</Double></Data>
              </AggregatedDataValue>
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>0</Double></Data>
                <Data property="Y"><Double>-10</Double></Data>
              </AggregatedDataValue>
            </Data>
          </Object>
        </Components>
      </Object>
    </Components>
  </Object>
  <Object id="D1" type="Core/Diagram.Diagram">
    <Data property="MinX"><Double>0</Double></Data>
    <Data property="MinY"><Double>0</Double></Data>
    <Data property="MaxX"><Double>50</Double></Data>
    <Data property="MaxY"><Double>50</Double></Data>
    <Components property="Groups">
      <Object type="Core/Diagram.RepresentationGroup">
        <References objects="#Valve1" property="Represents"/>
        <Components property="Elements">
          <Object type="Core/Diagram.ShapeUsage">
            <References objects="#ValveShape" property="Shape"/>
            <Data property="Position">
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>10</Double></Data>
                <Data property="Y"><Double>10</Double></Data>
              </AggregatedDataValue>
            </Data>
          </Object>
        </Components>
      </Object>
      <Object type="Core/Diagram.RepresentationGroup">
        <References objects="#Break1" property="Represents"/>
        <Components property="Elements">
          <Object type="Core/Diagram.ShapeUsage">
            <References objects="#BreakWingShape" property="Shape"/>
            <Data property="Position">
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>30</Double></Data>
                <Data property="Y"><Double>10</Double></Data>
              </AggregatedDataValue>
            </Data>
          </Object>
        </Components>
      </Object>
    </Components>
  </Object>
</Model>`;

describe("PropertyBreak heat-trace overlay exclusion", () => {
  const doc = parseDexpiDocument(PROPERTY_BREAK_XML).data;
  const overlays = (doc?.scene.nodes ?? []).filter((n) => n.kind === "prim" && n.role === "symbol");

  it("still overlays the traced valve sibling", () => {
    expect(overlays.filter((n) => n.objectId === "Valve1")).toHaveLength(1);
  });

  it("draws no overlay for the PropertyBreak, even though it inherits the segment's traced classification", () => {
    // Break1 has no HeatTracingType of its own — it's a logical
    // area/piping-class transition marker nested as a sibling Item, not
    // heat-traced hardware. The segment's own pipe-level lateral overlay
    // already runs through it uninterrupted; the break-wing symbol must
    // not get its own dashed mark on top.
    expect(overlays.filter((n) => n.objectId === "Break1")).toHaveLength(0);
  });
});

// -----------------------------------------------------------------------------
// Instrument overlays (encompassing ring, director's 2026-08-27 convention)
// -----------------------------------------------------------------------------

const INSTRUMENT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Model name="Main">
  <Object id="Psv1" type="Plant/Instrumentation.ProcessInstrumentationFunction">
    <Data property="HeatTracingType"><DataReference data="Plant/Enumerations.HeatTracingTypeClassification.HeatTracingSystem"/></Data>
  </Object>
  <Object id="Psv2" type="Plant/Instrumentation.ProcessInstrumentationFunction"/>
  <Object id="Psv3" type="Plant/Piping.SafetyValveOrFitting">
    <Data property="HeatTracingType"><DataReference data="Plant/Enumerations.HeatTracingTypeClassification.HeatTracingSystem"/></Data>
  </Object>
  <Object id="Psv4" type="Plant/Piping.SafetyValveOrFitting">
    <Data property="HeatTracingType"><DataReference data="Plant/Enumerations.HeatTracingTypeClassification.HeatTracingSystem"/></Data>
  </Object>
  <Object id="Cat1" type="Core/Diagram.ShapeCatalogue">
    <Components property="Shapes">
      <Object id="BalloonShape" type="Core/Diagram.Shape">
        <Components property="Primitives">
          <Object type="Core/Diagram.Circle">
            <Data property="Center">
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>0</Double></Data>
                <Data property="Y"><Double>0</Double></Data>
              </AggregatedDataValue>
            </Data>
            <Data property="Radius"><Double>5</Double></Data>
          </Object>
        </Components>
      </Object>
    </Components>
  </Object>
  <Object id="D1" type="Core/Diagram.Diagram">
    <Data property="MinX"><Double>0</Double></Data>
    <Data property="MinY"><Double>0</Double></Data>
    <Data property="MaxX"><Double>50</Double></Data>
    <Data property="MaxY"><Double>50</Double></Data>
    <Components property="Groups">
      <Object type="Core/Diagram.RepresentationGroup">
        <References objects="#Psv1" property="Represents"/>
        <Components property="Elements">
          <Object type="Core/Diagram.ShapeUsage">
            <References objects="#BalloonShape" property="Shape"/>
            <Data property="Position">
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>20</Double></Data>
                <Data property="Y"><Double>20</Double></Data>
              </AggregatedDataValue>
            </Data>
          </Object>
        </Components>
      </Object>
      <Object type="Core/Diagram.RepresentationGroup">
        <References objects="#Psv2" property="Represents"/>
        <Components property="Elements">
          <Object type="Core/Diagram.ShapeUsage">
            <References objects="#BalloonShape" property="Shape"/>
            <Data property="Position">
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>40</Double></Data>
                <Data property="Y"><Double>20</Double></Data>
              </AggregatedDataValue>
            </Data>
          </Object>
        </Components>
      </Object>
      <Object type="Core/Diagram.RepresentationGroup">
        <References objects="#Psv3" property="Represents"/>
        <Components property="Elements">
          <Object type="Core/Diagram.ShapeUsage">
            <References objects="#BalloonShape" property="Shape"/>
            <Data property="Position">
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>30</Double></Data>
                <Data property="Y"><Double>40</Double></Data>
              </AggregatedDataValue>
            </Data>
          </Object>
        </Components>
      </Object>
      <Object type="Core/Diagram.RepresentationGroup">
        <References objects="#Psv4" property="Represents"/>
        <Components property="Elements">
          <Object type="Core/Diagram.Label">
            <Components property="Elements">
              <Object type="Core/Diagram.ShapeUsage">
                <References objects="#BalloonShape" property="Shape"/>
                <Data property="Position">
                  <AggregatedDataValue type="Core/Diagram.Point">
                    <Data property="X"><Double>10</Double></Data>
                    <Data property="Y"><Double>40</Double></Data>
                  </AggregatedDataValue>
                </Data>
              </Object>
            </Components>
          </Object>
        </Components>
      </Object>
    </Components>
  </Object>
</Model>`;

function isCircleSymbolOverlay(n: PrimNode): n is PrimNode & { prim: CirclePrim } {
  return n.role === "symbol" && n.prim.kind === "circle";
}

describe("instrument heat-trace overlays", () => {
  const doc = parseDexpiDocument(INSTRUMENT_XML).data;
  const circleOverlays = (doc?.scene.nodes ?? [])
    .filter((n): n is PrimNode => n.kind === "prim")
    .filter(isCircleSymbolOverlay);

  it("draws an encompassing ring for a traced instrument only", () => {
    expect(circleOverlays.filter((n) => n.objectId === "Psv1")).toHaveLength(1);
    expect(circleOverlays.filter((n) => n.objectId === "Psv2")).toHaveLength(0);
  });

  it("rings a traced Plant/Piping.SafetyValveOrFitting drawn with a round symbol (real DISC PSV shape)", () => {
    // The classification is shape-based, not class-based: a PSV modelled as
    // a physical piping component (not Plant/Instrumentation.*) still reads
    // as an instrument bubble when its catalogue symbol is round — matches
    // DISC_EXAMPLE-14-13's D-20/PSV-0002 (SafetyValveOrFitting1 + ND0248B).
    expect(circleOverlays.filter((n) => n.objectId === "Psv3")).toHaveLength(1);
  });

  it("rings a round tag balloon placed inside a Label group (real DISC PSV structure)", () => {
    // DISC_EXAMPLE-14-13's actual D-20/PSV-0002 balloon (ND0248B) sits
    // inside a Core/Diagram.Label group — it carries the tag text, so the
    // scene graph tags it role "label", not "symbol". The ring must still
    // apply: a round instrument bubble reads as one regardless of which
    // group wraps it. This was the actual reported bug (no ring rendered).
    expect(circleOverlays.filter((n) => n.objectId === "Psv4")).toHaveLength(1);
  });

  it("centers the ring on the symbol and sizes it just outside the bounds", () => {
    const ring = circleOverlays.find((n) => n.objectId === "Psv1");
    expect(ring?.prim.center.x).toBeCloseTo(20);
    expect(ring?.prim.center.y).toBeCloseTo(20);
    // Balloon radius 5 (bounds half-extent) + default lateral offset 1.5.
    expect(ring?.prim.radius).toBeCloseTo(6.5);
    expect(ring?.prim.fill.style).toBe("Transparent");
    expect(ring?.prim.stroke.dash.length).toBeGreaterThan(0);
  });
});

describe("heat-trace eligibility", () => {
  it("ignores HeatTracingType on a SignalConveyingFunction (signals are logical)", () => {
    // The 2.0 model defines HeatTracingType only on piping classes and
    // OfflineMeasuringElement — data on a signal function is a modelling
    // error and must not dash the signal line.
    const xml = MAIN_XML.replace(
      '<Object id="Seg2" type="Plant/Piping.PipingNetworkSegment">',
      `<Object id="SCF1" type="Plant/Instrumentation.SignalConveyingFunction">
    <Data property="HeatTracingType"><DataReference data="Plant/Enumerations.HeatTracingTypeClassification.HeatTracingSystem"/></Data>
  </Object>
  <Object id="Seg2" type="Plant/Piping.PipingNetworkSegment">`,
    );
    const doc = parseDexpiDocument(xml).data;
    expect(doc).toBeDefined();
    const overlays = (doc?.scene.nodes ?? []).filter((n) => n.kind === "prim" && n.objectId === "SCF1");
    expect(overlays).toHaveLength(0);
  });
});
