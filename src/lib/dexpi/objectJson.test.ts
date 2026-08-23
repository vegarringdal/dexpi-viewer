import { describe, expect, it } from "vitest";
import { objectElementToJson } from "./objectJson.ts";
import { buildPlantModel } from "./plantModel.ts";

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<Model name="Main">
  <Object id="Line1" type="Core/Diagram.ConnectorLine">
    <Data property="InnerPoints">
      <AggregatedDataValue type="Core/Diagram.Point">
        <Data property="X"><Double>361</Double></Data>
        <Data property="Y"><Double>36</Double></Data>
      </AggregatedDataValue>
      <AggregatedDataValue type="Core/Diagram.Point">
        <Data property="X"><Double>380</Double></Data>
        <Data property="Y"><Double>60</Double></Data>
      </AggregatedDataValue>
    </Data>
    <Data property="LineType"><DataReference data="Core/Enumerations.LineType.Solid"/></Data>
    <Data property="Note"><Undefined/></Data>
    <References objects="#Pipe1 #Pipe2" property="Represents"/>
    <Components property="Elements">
      <Object type="Core/Diagram.Label">
        <Data property="Text"><String>hello</String></Data>
      </Object>
    </Components>
  </Object>
</Model>`;

function rootOf(xml: string): Element {
  return new DOMParser().parseFromString(xml, "text/xml").documentElement;
}

describe("objectElementToJson", () => {
  const root = rootOf(XML);
  const model = buildPlantModel(root, true);

  it("keeps full fidelity: typed values, arrays for multi-valued data, nested aggregates", () => {
    const el = model.elementsById.get("Line1");
    if (!el) {
      throw new Error("element not tracked");
    }

    expect(objectElementToJson(el)).toEqual({
      type: "Core/Diagram.ConnectorLine",
      id: "Line1",
      data: {
        InnerPoints: [
          { type: "Core/Diagram.Point", data: { X: 361, Y: 36 } },
          { type: "Core/Diagram.Point", data: { X: 380, Y: 60 } },
        ],
        LineType: { $ref: "Core/Enumerations.LineType.Solid" },
        Note: null,
      },
      references: { Represents: ["Pipe1", "Pipe2"] },
      components: {
        Elements: [{ type: "Core/Diagram.Label", data: { Text: "hello" } }],
      },
    });
  });

  it("formats every value of a multi-valued property into the display row", () => {
    const line = model.byId.get("Line1");
    const innerPoints = line?.attributes.find((a) => a.name === "InnerPoints");
    expect(innerPoints?.value).toBe("(361, 36) (380, 60)");
  });
});
