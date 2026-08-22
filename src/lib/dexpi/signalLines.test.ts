import { describe, expect, it } from "vitest";
import { parseDexpiDocument } from "./parseDocument.ts";
import type { CirclePrim, PolylinePrim, SceneNode } from "./types.ts";

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
        </Components>
      </Object>
    </Components>
  </Object>
</Model>`;

function nodesFor(objectId: string): SceneNode[] {
  const doc = parseDexpiDocument(MAIN_XML).data;
  return (doc?.scene.nodes ?? []).filter((n) => n.kind === "prim" && n.objectId === objectId);
}

function linesOf(nodes: SceneNode[]): PolylinePrim[] {
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

  it("draws a hydraulic line solid (fluid-filled, like a measuring line)", () => {
    const nodes = nodesFor("SCF5");
    const [line] = linesOf(nodes);
    expect(line?.stroke.dash).toEqual([]);
    expect(nodes.length).toBe(1);
  });

  it("draws an electrical line solid with bracket marks every 6.5mm from 2.5mm in", () => {
    const lines = linesOf(nodesFor("SCF1"));
    expect(lines[0]?.stroke.dash).toEqual([]);
    const brackets = lines.slice(1);
    expect(brackets.map((b) => b.points[1]?.x)).toEqual([2.5, 9, 15.5]);
    // Glyph frame follows the line direction; arms extend along travel.
    expect(brackets[0]?.points).toEqual([
      { x: 3.75, y: 18.75 },
      { x: 2.5, y: 18.75 },
      { x: 2.5, y: 21.25 },
      { x: 3.75, y: 21.25 },
    ]);
  });

  it("draws a bus line dashed 2.75/4.75 with a circle mark 5mm in", () => {
    const nodes = nodesFor("SCF2");
    const [line] = linesOf(nodes);
    expect(line?.stroke.dash).toEqual([2.75, 4.75]);
    const circles = nodes.flatMap((n): CirclePrim[] =>
      n.kind === "prim" && n.prim.kind === "circle" ? [n.prim] : [],
    );
    expect(circles.length).toBe(1);
    expect(circles[0]?.center).toEqual({ x: 5, y: 30 });
    expect(circles[0]?.radius).toBe(1.25);
  });
});
