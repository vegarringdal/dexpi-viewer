import { describe, expect, it } from "vitest";
import { parseDexpiDocument } from "./parseDocument.ts";

// -----------------------------------------------------------------------------
// Fixture — heat tracing is main-file data: HeatTracingType on the piping
// segment; the pipe inside inherits the classification. The HeatTracingBreak
// is a logical property break, never drawn.
// -----------------------------------------------------------------------------

const MAIN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Model name="Main">
  <Object id="Seg1" type="Plant/Piping.PipingNetworkSegment">
    <Data property="HeatTracingType"><DataReference data="Plant/Enumerations.HeatTracingTypeClassification.HeatTracingSystem"/></Data>
    <Data property="HeatTracingTypeRepresentation"><String>ET</String></Data>
    <Components property="Items">
      <Object id="Pipe1" type="Plant/Piping.Pipe"/>
    </Components>
  </Object>
  <Object id="Seg2" type="Plant/Piping.PipingNetworkSegment">
    <Components property="Items">
      <Object id="Pipe2" type="Plant/Piping.Pipe"/>
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
    </Components>
  </Object>
</Model>`;

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe("heat tracing overlays", () => {
  const doc = parseDexpiDocument(MAIN_XML).data;
  const connectors = (doc?.scene.nodes ?? []).flatMap((n) =>
    n.kind === "prim" && n.role === "connector" && n.prim.kind === "polyline" ? [n] : [],
  );

  it("adds a dashed overlay for the heat-traced segment's pipe only", () => {
    const pipe1 = connectors.filter((n) => n.objectId === "Pipe1");
    const pipe2 = connectors.filter((n) => n.objectId === "Pipe2");
    // Base geometry + overlay for the traced pipe; untraced pipe stays single.
    expect(pipe1).toHaveLength(2);
    expect(pipe2).toHaveLength(1);
  });

  it("keeps the base pipe untouched and dashes only the overlay", () => {
    const [base, overlay] = connectors.filter((n) => n.objectId === "Pipe1");
    expect(base?.prim.kind === "polyline" && base.prim.stroke.dash).toHaveLength(0);
    expect(overlay?.prim.kind === "polyline" && overlay.prim.stroke.dash.length).toBeGreaterThan(0);
  });
});
