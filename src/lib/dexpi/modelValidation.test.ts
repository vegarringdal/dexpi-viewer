import { describe, expect, it } from "vitest";
import { detectDeclaredVersion } from "./metaModel.ts";
import { validateAgainstModel } from "./modelValidation.ts";

function rootOf(xml: string): Element {
  return new DOMParser().parseFromString(xml, "text/xml").documentElement;
}

function rules(xml: string, extensions?: ReadonlyMap<string, readonly string[]>): string[] {
  return validateAgainstModel(rootOf(xml), extensions).map((i) => i.ruleId);
}

describe("model-driven validation (MDL-*)", () => {
  it("flags unknown classes, but only inside the base model's namespaces", () => {
    const found = rules(`<Model name="M">
      <Object id="A" type="Plant/Piping.NotARealValve"/>
      <Object id="B" type="Vendor/Custom.Thing"/>
    </Model>`);
    expect(found.filter((r) => r === "MDL-001").length).toBe(1);
  });

  it("flags unknown and misspelled attributes, skipping namespaced extension names", () => {
    const found = validateAgainstModel(
      rootOf(`<Model name="M">
        <Object id="V1" type="Plant/Piping.GateValve">
          <Data property="ValvePostion"><String>x</String></Data>
          <Data property="DiscProfile/ItemTag"><String>ok</String></Data>
        </Object>
      </Model>`),
    );
    const unknown = found.filter((i) => i.ruleId === "MDL-002");
    expect(unknown.length).toBe(1);
    expect(unknown[0]?.message).toContain("ValvePostion");
  });

  it("flags missing required properties (generalizing the old META-001)", () => {
    const found = validateAgainstModel(
      rootOf(`<Model name="M">
        <Object type="Core/EngineeringModel">
          <Data property="OriginatingSystemName"><String>t</String></Data>
        </Object>
      </Model>`),
    );
    const missing = found.filter((i) => i.ruleId === "MDL-003").map((i) => i.message);
    expect(missing.some((m) => m.includes("ExportDateTime"))).toBe(true);
    expect(missing.some((m) => m.includes("OriginatingSystemVersion"))).toBe(true);
    expect(missing.some((m) => m.includes("OriginatingSystemName"))).toBe(false);
  });

  it("counts an <Undefined/> value as missing for a required property", () => {
    const found = validateAgainstModel(
      rootOf(`<Model name="M">
        <Object type="Core/EngineeringModel">
          <Data property="ExportDateTime"><Undefined/></Data>
          <Data property="OriginatingSystemName"><String>t</String></Data>
          <Data property="OriginatingSystemVendorName"><String>t</String></Data>
          <Data property="OriginatingSystemVersion"><String>t</String></Data>
        </Object>
      </Model>`),
    );
    expect(found.filter((i) => i.ruleId === "MDL-003").length).toBe(1);
  });

  it("flags illegal enumeration literals and wrong-enumeration references", () => {
    const found = validateAgainstModel(
      rootOf(`<Model name="M">
        <Object id="CA1" type="Plant/Instrumentation.ControlledActuator">
          <Data property="FailAction"><DataReference data="Plant/Enumerations.FailActionClassification.FailClosed"/></Data>
        </Object>
        <Object id="CA2" type="Plant/Instrumentation.ControlledActuator">
          <Data property="FailAction"><DataReference data="Plant/Enumerations.FailActionClassification.FailClose"/></Data>
        </Object>
      </Model>`),
    );
    const bad = found.filter((i) => i.ruleId === "MDL-004");
    expect(bad.length).toBe(1);
    expect(bad[0]?.message).toContain("FailClosed");
  });

  it("flags cardinality violations on [0..1] references", () => {
    const found = rules(`<Model name="M">
      <Object id="N1" type="Plant/Piping.PipingNode"/>
      <Object id="N2" type="Plant/Piping.PipingNode"/>
      <Object id="P1" type="Plant/Piping.Pipe">
        <References objects="#N1 #N2" property="SourceNode"/>
      </Object>
    </Model>`);
    expect(found.filter((r) => r === "MDL-006").length).toBe(1);
  });

  it("flags references whose target class is incompatible", () => {
    const found = rules(`<Model name="M">
      <Object id="T1" type="Plant/ProcessEquipment.Tank"/>
      <Object id="P1" type="Plant/Piping.Pipe">
        <References objects="#T1" property="SourceNode"/>
      </Object>
    </Model>`);
    expect(found.filter((r) => r === "MDL-007").length).toBe(1);
  });

  it("accepts extension-class targets whose profile ancestry reaches the required class", () => {
    const extensions = new Map([
      ["DiscProfile/InformationModel.WedgeGateValve", ["Plant/Piping.OperatedValve"]],
    ]);
    const xml = `<Model name="M">
      <Object id="W1" type="DiscProfile/InformationModel.WedgeGateValve"/>
      <Object id="P1" type="Plant/Piping.Pipe">
        <References objects="#W1" property="SourceItem"/>
      </Object>
    </Model>`;
    expect(rules(xml, extensions).filter((r) => r === "MDL-007").length).toBe(0);
    // Unknown extension (no profile loaded) is skipped, never guessed at.
    expect(rules(xml).filter((r) => r === "MDL-007").length).toBe(0);
  });

  it("reports a declared model version this build has no tables for (MDL-000)", () => {
    const xml = `<Model name="M">
      <Import prefix="Core" source="https://data.dexpi.org/models/2.1.0/Core.xml"/>
      <Object type="Core/EngineeringModel"/>
    </Model>`;
    expect(detectDeclaredVersion(rootOf(xml))).toBe("2.1");
    const found = validateAgainstModel(rootOf(xml));
    expect(found.some((i) => i.ruleId === "MDL-000" && i.message.includes("2.1"))).toBe(true);
  });
});
