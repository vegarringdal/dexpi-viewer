import { describe, expect, it } from "vitest";
import {
  applySeverityOverrides,
  categoryOfRule,
  type ValidationIssue,
  validateDocument,
} from "./validation.ts";

function rootOf(xml: string): Element {
  return new DOMParser().parseFromString(xml, "text/xml").documentElement;
}

function rulesOf(issues: readonly ValidationIssue[]): Set<string> {
  return new Set(issues.map((i) => i.ruleId));
}

describe("schema lexical rules (SCH-003/SCH-004)", () => {
  it("flags ids and reference tokens that violate the XSD patterns", () => {
    const issues = validateDocument(
      rootOf(`<Model name="M">
        <Object id="9bad" type="Plant/Piping.Pipe"/>
        <Object id="Ok" type="Plant/Piping.Pipe">
          <References objects="not-a-token" property="TargetItem"/>
        </Object>
      </Model>`),
    );
    const byRule = rulesOf(issues);
    expect(byRule.has("SCH-003")).toBe(true);
    expect(byRule.has("SCH-004")).toBe(true);
  });

  it("accepts #id, /Name and Model/Name.Name reference forms", () => {
    const issues = validateDocument(
      rootOf(`<Model name="M">
        <Object id="A" type="Plant/Piping.Pipe">
          <References objects="#A /Border DiscProfile/InformationModel.Valve" property="SourceItem"/>
        </Object>
      </Model>`),
    );
    expect(rulesOf(issues).has("SCH-004")).toBe(false);
  });
});

describe("unconnected nozzles (CON-003)", () => {
  const NOZZLE = `<Object id="Tank" type="Plant/ProcessEquipment.Tank">
    <Components property="Nozzles">
      <Object id="N1" type="Plant/ProcessEquipment.Nozzle">
        <Components property="Nodes">
          <Object id="PN1" type="Plant/Piping.PipingNode"/>
        </Components>
      </Object>
    </Components>
  </Object>`;

  it("reports a nozzle whose id and nodes are never flow targets", () => {
    const issues = validateDocument(rootOf(`<Model name="M">${NOZZLE}</Model>`));
    const findings = issues.filter((i) => i.ruleId === "CON-003");
    expect(findings.map((i) => i.objectId)).toEqual(["N1"]);
    expect(findings[0]?.severity).toBe("info");
  });

  it("stays silent when the nozzle's node is a connection target", () => {
    const issues = validateDocument(
      rootOf(`<Model name="M">${NOZZLE}
        <Object id="Pipe1" type="Plant/Piping.Pipe">
          <References objects="#N1" property="TargetItem"/>
          <References objects="#PN1" property="TargetNode"/>
        </Object>
      </Model>`),
    );
    expect(rulesOf(issues).has("CON-003")).toBe(false);
  });
});

const DN_NODE = (id: string, dn: string): string => `<Object id="${id}" type="Plant/Piping.PipingNode">
  <Data property="NominalDiameterNumericalValueRepresentation"><String>${dn}</String></Data>
</Object>`;

describe("nominal diameter mismatch (CON-004)", () => {
  it("flags a connection joining nodes with different diameters", () => {
    const issues = validateDocument(
      rootOf(`<Model name="M">
        ${DN_NODE("PN1", "80")}
        ${DN_NODE("PN2", "50")}
        <Object id="Pipe1" type="Plant/Piping.Pipe">
          <References objects="#PN1" property="SourceNode"/>
          <References objects="#PN2" property="TargetNode"/>
        </Object>
      </Model>`),
    );
    const findings = issues.filter((i) => i.ruleId === "CON-004");
    expect(findings.length).toBe(1);
    expect(findings[0]?.message).toContain("PN1 = 80");
    expect(findings[0]?.message).toContain("PN2 = 50");
  });

  it("skips segment endpoint references (a PipeReducer inside legitimately changes DN)", () => {
    const issues = validateDocument(
      rootOf(`<Model name="M">
        ${DN_NODE("PN1", "80")}
        ${DN_NODE("PN2", "50")}
        <Object id="Seg1" type="Plant/Piping.PipingNetworkSegment">
          <References objects="#PN1" property="SourceNode"/>
          <References objects="#PN2" property="TargetNode"/>
        </Object>
      </Model>`),
    );
    expect(rulesOf(issues).has("CON-004")).toBe(false);
  });

  it("never compares a text representation against a numeric one", () => {
    const issues = validateDocument(
      rootOf(`<Model name="M">
        <Object id="PN1" type="Plant/Piping.PipingNode">
          <Data property="NominalDiameterRepresentation"><String>14&#8243;</String></Data>
        </Object>
        ${DN_NODE("PN2", "350")}
        <Object id="Pipe1" type="Plant/Piping.Pipe">
          <References objects="#PN1" property="SourceNode"/>
          <References objects="#PN2" property="TargetNode"/>
        </Object>
      </Model>`),
    );
    expect(rulesOf(issues).has("CON-004")).toBe(false);
  });
});

describe("piping class change (CON-005)", () => {
  const TWO_SEGMENTS = (breakItem: string): string => `<Model name="M">
    <Object id="SegA" type="Plant/Piping.PipingNetworkSegment">
      <Data property="PipingClassCode"><String>AD750</String></Data>
      <References objects="#Tee1" property="TargetItem"/>
    </Object>
    <Object id="SegB" type="Plant/Piping.PipingNetworkSegment">
      <Data property="PipingClassCode"><String>AS200</String></Data>
      <Components property="Items">
        <Object id="Tee1" type="Plant/Piping.PipeTee"/>
        ${breakItem}
      </Components>
    </Object>
  </Model>`;

  it("reports a class change between segments with no PropertyBreak", () => {
    const issues = validateDocument(rootOf(TWO_SEGMENTS("")));
    const findings = issues.filter((i) => i.ruleId === "CON-005");
    expect(findings.length).toBe(1);
    expect(findings[0]?.severity).toBe("info");
    expect(findings[0]?.message).toContain("AD750");
    expect(findings[0]?.message).toContain("AS200");
  });

  it("stays silent when either segment contains a PropertyBreak", () => {
    const issues = validateDocument(
      rootOf(TWO_SEGMENTS('<Object id="PB1" type="Plant/Piping.PropertyBreak"/>')),
    );
    expect(rulesOf(issues).has("CON-005")).toBe(false);
  });
});

describe("applySeverityOverrides", () => {
  const ISSUES: readonly ValidationIssue[] = [
    { ruleId: "SCH-001", severity: "error", message: "dup", objectId: "A" },
    { ruleId: "CON-003", severity: "info", message: "spare", objectId: "N1" },
    { ruleId: "CON-004", severity: "warning", message: "dn", objectId: "P1" },
  ];

  it("drops ignored rules and re-sorts after remapping severities", () => {
    const result = applySeverityOverrides([...ISSUES], { "SCH-001": "ignore", "CON-003": "error" });
    expect(result.map((i) => i.ruleId)).toEqual(["CON-003", "CON-004"]);
    expect(result[0]?.severity).toBe("error");
  });

  it("returns findings unchanged without overrides", () => {
    const result = applySeverityOverrides([...ISSUES], {});
    expect(result.map((i) => i.severity)).toEqual(["error", "warning", "info"]);
  });
});

describe("categoryOfRule", () => {
  it("derives the category from the rule id prefix", () => {
    expect(categoryOfRule("SCH-001")).toBe("schema");
    expect(categoryOfRule("GFX-002")).toBe("graphics");
    expect(categoryOfRule("CON-004")).toBe("connectivity");
    expect(categoryOfRule("META-001")).toBe("metadata");
  });
});
