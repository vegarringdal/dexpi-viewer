import { describe, expect, it } from "vitest";
import { parseDiscProfile } from "./discProfile.ts";
import { parseDexpiDocument } from "./parseDocument.ts";

// -----------------------------------------------------------------------------
// Fixtures
// -----------------------------------------------------------------------------

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
      <Object type="Profile/SymbolVariant">
        <Components property="Condition">
          <Object type="Profile/PropertyValueCondition">
            <Data property="Property"><String>DiscProfile.InformationModel.OperatedValveExtension.ValvePosition</String></Data>
            <Data property="Value"><String>DiscProfile.InformationModel.ValvePosition.NormallyClose</String></Data>
          </Object>
        </Components>
        <Components property="Primitives">
          <Object type="Core/Diagram.Polygon">
            <Data property="FillStyle"><DataReference data="Core/Diagram.FillStyle.Solid"/></Data>
            <Data property="Points">
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>0</Double></Data>
                <Data property="Y"><Double>0</Double></Data>
              </AggregatedDataValue>
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>4</Double></Data>
                <Data property="Y"><Double>4</Double></Data>
              </AggregatedDataValue>
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>0</Double></Data>
                <Data property="Y"><Double>4</Double></Data>
              </AggregatedDataValue>
            </Data>
          </Object>
        </Components>
      </Object>
    </Components>
  </Object>
</Model>`;

const MAIN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Model name="Main">
  <Object id="ValveClosed" type="Plant/Piping.BallValve">
    <Data property="ValvePosition"><DataReference data="DiscProfile/InformationModel.ValvePosition.NormallyClose"/></Data>
  </Object>
  <Object id="ValvePlain" type="Plant/Piping.BallValve"/>
  <Object id="D1" type="Core/Diagram.Diagram">
    <Data property="MinX"><Double>0</Double></Data>
    <Data property="MinY"><Double>0</Double></Data>
    <Data property="MaxX"><Double>50</Double></Data>
    <Data property="MaxY"><Double>50</Double></Data>
    <Components property="Groups">
      <Object type="Core/Diagram.RepresentationGroup">
        <References objects="#ValveClosed" property="Represents"/>
        <Components property="Elements">
          <Object type="Profile/SymbolUsage">
            <References objects="DiscProfile/ValveX" property="Symbol"/>
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
        <References objects="#ValvePlain" property="Represents"/>
        <Components property="Elements">
          <Object type="Profile/SymbolUsage">
            <References objects="DiscProfile/ValveX" property="Symbol"/>
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

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe("parseDiscProfile", () => {
  it("rejects XML without a symbol catalogue", () => {
    const result = parseDiscProfile('<Model name="x"><Object id="a" type="Plant/PlantModel"/></Model>');
    expect(result.error?.msg).toContain("DISC profile");
  });

  it("parses symbols with variants and conditions (bare names)", () => {
    const profile = parseDiscProfile(PROFILE_XML).data;
    const symbol = profile?.symbols.get("DiscProfile/ValveX");
    expect(symbol?.variants).toHaveLength(2);
    expect(symbol?.variants[0]?.condition).toBeNull();
    expect(symbol?.variants[1]?.condition).toEqual({
      attributeName: "ValvePosition",
      literalValue: "NormallyClose",
    });
    expect(profile?.symbols.has("ValveX")).toBe(true);
  });
});

describe("profile symbol resolution in the scene graph", () => {
  const profile = parseDiscProfile(PROFILE_XML).data ?? null;
  const doc = parseDexpiDocument(MAIN_XML, profile).data;

  it("picks the conditional variant when the instance attribute matches", () => {
    const uses = (doc?.scene.nodes ?? []).flatMap((n) => (n.kind === "use" ? [n] : []));
    expect(uses).toHaveLength(2);

    const closed = uses.find((u) => u.objectId === "ValveClosed");
    const plain = uses.find((u) => u.objectId === "ValvePlain");
    expect(closed?.shapeId).toBe("DiscProfile/ValveX#v1");
    expect(plain?.shapeId).toBe("DiscProfile/ValveX#v0");
  });

  it("registers the used variants as shapes with their primitives", () => {
    expect(doc?.scene.shapes.get("DiscProfile/ValveX#v1")?.primitives[0]?.kind).toBe("polygon");
    expect(doc?.scene.shapes.get("DiscProfile/ValveX#v0")?.primitives[0]?.kind).toBe("polyline");
  });

  it("without the profile, the usages are skipped but the document still parses", () => {
    const bare = parseDexpiDocument(MAIN_XML).data;
    expect((bare?.scene.nodes ?? []).filter((n) => n.kind === "use")).toHaveLength(0);
  });
});
