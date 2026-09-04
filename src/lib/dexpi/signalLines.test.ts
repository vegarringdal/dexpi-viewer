import { afterEach, describe, expect, it } from "vitest";
import type { ProfileLineStroke } from "./discProfile.ts";
import { parseDexpiDocument } from "./parseDocument.ts";
import { setPreferBuiltinSignalStyle, signalLineStyle } from "./signalLines.ts";
import type { CirclePrim, PolyLinePrim, SceneNode } from "./types.ts";

// -----------------------------------------------------------------------------
// Semantic signal-line styling — the official DISC renderings override the
// authored LongDash stroke by the represented object's type and synthesize
// mark glyphs (see signalLines.ts). Synthetic fixture: three straight lines,
// each authored LongDash.
// -----------------------------------------------------------------------------

const LONG_DASH_STROKE = `<Data property="Stroke">
  <AggregatedDataValue type="Core/Diagram.Stroke">
    <Data property="DashStyle"><DataReference data="Core/Diagram.DashStyle.LongDash"/></Data>
    <Data property="Width"><Double>0.25</Double></Data>
  </AggregatedDataValue>
</Data>`;

const nodePosition = (id: string, x: number, y: number): string =>
  `<Object id="${id}" type="Plant/Diagram.InstrumentationNodePosition">
    <Data property="Position">
      <AggregatedDataValue type="Core/Diagram.Point">
        <Data property="X"><Double>${x}</Double></Data>
        <Data property="Y"><Double>${y}</Double></Data>
      </AggregatedDataValue>
    </Data>
  </Object>`;

const connectorGroup = (representsId: string, sourceId: string, targetId: string): string =>
  `<Object type="Core/Diagram.RepresentationGroup">
    <References objects="#${representsId}" property="Represents"/>
    <Components property="Elements">
      <Object type="Core/Diagram.ConnectorLine">
        <References objects="#${sourceId}" property="Source"/>
        ${LONG_DASH_STROKE}
        <References objects="#${targetId}" property="Target"/>
      </Object>
    </Components>
  </Object>`;

const MAIN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Model name="Main">
  <Object id="MLF1" type="Plant/Instrumentation.MeasuringLineFunction"/>
  <Object id="SCF1" type="Plant/Instrumentation.SignalConveyingFunction">
    <Data property="DiscProfile/SignalConveyingFunctionTypeRepresentation"><String>ElectricalSignalConveying</String></Data>
  </Object>
  <Object id="SCF2" type="Plant/Instrumentation.SignalConveyingFunction">
    <Data property="DiscProfile/SignalConveyingFunctionTypeRepresentation"><String>BusSignalConveying</String></Data>
  </Object>
  <Object id="SCF3" type="Plant/Instrumentation.SignalConveyingFunction">
    <Data property="DiscProfile/SignalConveyingFunctionTypeRepresentation"><String>SignalConveying</String></Data>
  </Object>
  <Object id="SCF4" type="Plant/Instrumentation.SignalConveyingFunction">
    <Data property="DiscProfile/SignalConveyingFunctionTypeRepresentation"><String>FutureSignalConveying</String></Data>
  </Object>
  <Object id="SCF5" type="Plant/Instrumentation.SignalConveyingFunction">
    <Data property="DiscProfile/SignalConveyingFunctionTypeRepresentation"><String>HydraulicSignalConveying</String></Data>
  </Object>
  <Object id="SCF6" type="Plant/Instrumentation.SignalConveyingFunction">
    <Data property="DiscProfile/SignalConveyingFunctionTypeRepresentation"><String>ElectromagneticUnguidedSignalConveying</String></Data>
  </Object>
  <Object id="D1" type="Core/Diagram.Diagram">
    <Data property="MinX"><Double>0</Double></Data>
    <Data property="MinY"><Double>0</Double></Data>
    <Data property="MaxX"><Double>100</Double></Data>
    <Data property="MaxY"><Double>100</Double></Data>
    <Components property="Groups">
      ${connectorGroup("MLF1", "NP1", "NP2")}
      ${connectorGroup("SCF1", "NP3", "NP4")}
      ${connectorGroup("SCF2", "NP5", "NP6")}
      ${connectorGroup("SCF3", "NP7", "NP8")}
      ${connectorGroup("SCF4", "NP9", "NP10")}
      ${connectorGroup("SCF5", "NP11", "NP12")}
      ${connectorGroup("SCF6", "NP13", "NP14")}
      <Object type="Core/Diagram.RepresentationGroup">
        <Components property="NodePositions">
          ${nodePosition("NP1", 0, 10)}
          ${nodePosition("NP2", 20, 10)}
          ${nodePosition("NP3", 0, 20)}
          ${nodePosition("NP4", 20, 20)}
          ${nodePosition("NP5", 0, 30)}
          ${nodePosition("NP6", 9, 30)}
          ${nodePosition("NP7", 0, 40)}
          ${nodePosition("NP8", 20, 40)}
          ${nodePosition("NP9", 0, 50)}
          ${nodePosition("NP10", 20, 50)}
          ${nodePosition("NP11", 0, 60)}
          ${nodePosition("NP12", 20, 60)}
          ${nodePosition("NP13", 0, 70)}
          ${nodePosition("NP14", 20, 70)}
        </Components>
      </Object>
    </Components>
  </Object>
</Model>`;

function nodesFor(objectId: string): SceneNode[] {
  const doc = parseDexpiDocument(MAIN_XML).data;
  return (doc?.scene.nodes ?? []).filter((n) => n.kind === "prim" && n.objectId === objectId);
}

function linesOf(nodes: SceneNode[]): PolyLinePrim[] {
  return nodes.flatMap((n) => (n.kind === "prim" && n.prim.kind === "polyline" ? [n.prim] : []));
}

describe("semantic signal-line styling", () => {
  it("draws a measuring line solid despite the authored LongDash", () => {
    const [line] = linesOf(nodesFor("MLF1"));
    expect(line?.stroke.dash).toEqual([]);
  });

  it("draws a plain signal line dashed 3/3", () => {
    const [line] = linesOf(nodesFor("SCF3"));
    expect(line?.stroke.dash).toEqual([3, 3]);
  });

  it("keeps the authored stroke for unknown subtype values", () => {
    const [line] = linesOf(nodesFor("SCF4"));
    expect(line?.stroke.dash).toEqual([2, 0.75]);
  });

  it("draws a hydraulic line solid with repeated L marks", () => {
    const nodes = nodesFor("SCF5");
    const lines = linesOf(nodes);
    expect(lines[0]?.stroke.dash).toEqual([]);
    // 20mm line, glyph cadence 2.5 + n*6.5 → 3 L glyphs (one stroke each).
    expect(lines.length).toBe(1 + 3);
  });

  it("draws an electrical line solid with italic-E marks every 6.5mm from 2.5mm in", () => {
    const lines = linesOf(nodesFor("SCF1"));
    expect(lines[0]?.stroke.dash).toEqual([]);
    // Each E is four strokes (spine + three arms) → 3 glyphs of 4.
    const glyphStrokes = lines.slice(1);
    expect(glyphStrokes.length).toBe(12);
    // First E's slanted spine, rotated to the (horizontal) line at y=20.
    expect(glyphStrokes[0]?.points).toEqual([
      { x: 2.35, y: 18.75 },
      { x: 1.75, y: 21.25 },
    ]);
  });

  it("draws a bus line solid with a circle mark 5mm in", () => {
    const nodes = nodesFor("SCF2");
    const [line] = linesOf(nodes);
    expect(line?.stroke.dash).toEqual([]);
    const circles = nodes.flatMap((n): CirclePrim[] =>
      n.kind === "prim" && n.prim.kind === "circle" ? [n.prim] : [],
    );
    expect(circles.length).toBe(1);
    expect(circles[0]?.center).toEqual({ x: 5, y: 30 });
    expect(circles[0]?.radius).toBe(1.25);
  });

  it("hides the electromagnetic-unguided line entirely — only squiggles draw", () => {
    const nodes = nodesFor("SCF6");
    const lines = linesOf(nodes);
    // No conductor: none of the polylines is the 20mm line itself.
    expect(lines.length).toBe(3);
    for (const squiggle of lines) {
      expect(squiggle.points.length).toBe(6);
    }
  });
});

// -----------------------------------------------------------------------------
// Style mapping + profile precedence (pure function level)
// -----------------------------------------------------------------------------

function signalEl(representation: string): Element {
  return new DOMParser().parseFromString(
    `<Object type="Plant/Instrumentation.SignalConveyingFunction">
      <Data property="SignalConveyingFunctionTypeRepresentation"><String>${representation}</String></Data>
    </Object>`,
    "text/xml",
  ).documentElement;
}

describe("signalLineStyle mapping (DISC decoration table)", () => {
  afterEach(() => setPreferBuiltinSignalStyle(false));

  const expected: ReadonlyArray<readonly [string, string | null, boolean]> = [
    ["SignalConveying", null, false],
    ["ElectricalSignalConveying", "E", false],
    ["HydraulicSignalConveying", "L", false],
    ["BusSignalConveying", "circle", false],
    ["PneumaticSignalConveying", "chevron", false],
    ["CapillarySignalConveying", "x", false],
    ["UndefinedSignalConveying", "slash", false],
    ["ElectromagneticGuidedSignalConveying", "squiggle", false],
    ["ElectromagneticUnguidedSignalConveying", "squiggle", true],
  ];

  it.each(expected)("%s → mark %s", (representation, mark, hideLine) => {
    const style = signalLineStyle(signalEl(representation));
    expect(style?.mark ?? null).toBe(mark);
    expect(style?.hideLine).toBe(hideLine);
    expect(style?.dash).toEqual(representation === "SignalConveying" ? [3, 3] : []);
  });

  it("profile LineStrokes override the built-in convention by default", () => {
    const stroke: ProfileLineStroke = {
      color: { r: 0.2, g: 0.2, b: 0.2 },
      dashArray: [1, 1],
      lateralOffsetMm: 0,
      rounding: null,
      dashOffsetMm: 0,
      widthMm: 0.5,
    };
    const strokes = new Map([["ElectricalSignalConveying", stroke]]);
    const fromProfile = signalLineStyle(signalEl("ElectricalSignalConveying"), strokes);
    expect(fromProfile).toEqual({
      dash: [1, 1],
      mark: null,
      hideLine: false,
      color: { r: 0.2, g: 0.2, b: 0.2 },
      width: 0.5,
    });

    // The setting forces the built-in convention back.
    setPreferBuiltinSignalStyle(true);
    const builtin = signalLineStyle(signalEl("ElectricalSignalConveying"), strokes);
    expect(builtin?.mark).toBe("E");
    expect(builtin?.dash).toEqual([]);
  });
});
