import { describe, expect, it } from "vitest";
import { parseDiscProfile } from "./discProfile.ts";
import { parseDexpiDocument } from "./parseDocument.ts";
import type { TextPrim } from "./types.ts";

// -----------------------------------------------------------------------------
// Fixtures — synthetic, format reconstructed from the prior-art viewer
// (the DISC profile spec is not publicly available).
// -----------------------------------------------------------------------------

const PROFILE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Model name="Profile">
  <Object id="Sym1" name="Balloon" type="Profile/Symbol">
    <Components property="Variants">
      <Object type="Profile/SymbolVariant">
        <Components property="Primitives">
          <Object type="Core/Diagram.Circle">
            <Data property="Center">
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>0</Double></Data>
                <Data property="Y"><Double>0</Double></Data>
              </AggregatedDataValue>
            </Data>
            <Data property="Radius"><Double>3</Double></Data>
          </Object>
        </Components>
        <Components property="LabelTemplates">
          <Object type="Profile/LabelTemplate">
            <Data property="Text"><String>&lt;TagName&gt;-&lt;NotModelled&gt;</String></Data>
            <Data property="Size"><Double>2.5</Double></Data>
            <Data property="Position">
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>0</Double></Data>
                <Data property="Y"><Double>1</Double></Data>
              </AggregatedDataValue>
            </Data>
          </Object>
          <Object type="Profile/LabelTemplate">
            <Data property="Text"><String>H=' &amp; SignalConveyingFunction:&lt;AlarmValue&gt;</String></Data>
          </Object>
          <Object type="Profile/LabelTemplate">
            <Data property="Text"><String>LL=' &amp; SignalConveyingFunction:&lt;AlarmValue&gt;</String></Data>
          </Object>
        </Components>
      </Object>
    </Components>
  </Object>
</Model>`;

const MAIN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Model name="Main">
  <Object id="PIF1" type="Plant/Instrumentation.ProcessInstrumentationFunction">
    <Data property="TagName"><String>PT-100</String></Data>
    <Components property="SignalConveyingFunctions">
      <Object id="SCF1" type="Plant/Instrumentation.SignalConveyingFunction">
        <Data property="PortStatus"><DataReference data="Plant/Instrumentation.PortStatusClassification.StatusHighPort"/></Data>
        <Data property="AlarmValue"><String>100</String></Data>
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
        <References objects="#PIF1" property="Represents"/>
        <Components property="Elements">
          <Object type="Profile/SymbolUsage">
            <References objects="DiscProfile/Balloon" property="Symbol"/>
            <Data property="Position">
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>10</Double></Data>
                <Data property="Y"><Double>20</Double></Data>
              </AggregatedDataValue>
            </Data>
          </Object>
        </Components>
      </Object>
    </Components>
  </Object>
</Model>`;

function overlayTexts(xml: string, profileXml: string = PROFILE_XML): TextPrim[] {
  const profile = parseDiscProfile(profileXml).data ?? null;
  const doc = parseDexpiDocument(xml, profile).data;
  return (doc?.scene.nodes ?? []).flatMap((n) =>
    n.kind === "prim" && n.prim.kind === "text" && n.role === "label" ? [n.prim] : [],
  );
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe("profile label overlays", () => {
  it("synthesizes overlay text at the instance position", () => {
    const texts = overlayTexts(MAIN_XML);
    // Multi-field line: TagName resolves, the unmodelled field renders blank
    // WITHOUT suppressing the rest of the line.
    const tag = texts.find((t) => t.value.startsWith("PT-100"));
    expect(tag?.value).toBe("PT-100-");
    expect(tag?.position).toEqual({ x: 10, y: 21 });
    expect(tag?.size).toBe(2.5);
  });

  it("resolves an alarm role-path by PortStatus and strips the formula syntax", () => {
    const texts = overlayTexts(MAIN_XML);
    expect(texts.some((t) => t.value === "H=100")).toBe(true);
  });

  it("suppresses an alarm template with no matching PortStatus child", () => {
    // The PIF has no StatusLowLowPort signal — the LL= template must vanish
    // entirely, not render a dangling "LL=".
    const texts = overlayTexts(MAIN_XML);
    expect(texts.some((t) => t.value.startsWith("LL"))).toBe(false);
  });

  it("renders NO overlays when the object carries an explicit diagram label", () => {
    // Director's rule: explicit Core/Diagram.Label text is authoritative —
    // never render the profile template output in addition to it.
    const explicitLabelGroup = `<Object type="Core/Diagram.Label">
        <References objects="#PIF1" property="Represents"/>
        <Components property="Elements">
          <Object type="Core/Diagram.Text">
            <Data property="Value"><String>PT-100 EXPLICIT</String></Data>
            <Data property="Position">
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>12</Double></Data>
                <Data property="Y"><Double>22</Double></Data>
              </AggregatedDataValue>
            </Data>
          </Object>
        </Components>
      </Object>
    </Components>`;
    const withLabel = MAIN_XML.replace(
      / {4}<\/Components>\s*<\/Object>\s*<\/Model>\s*$/,
      `    ${explicitLabelGroup}
  </Object>
</Model>`,
    );
    expect(withLabel).toContain("PT-100 EXPLICIT");
    const texts = overlayTexts(withLabel);
    expect(texts.some((t) => t.value === "PT-100 EXPLICIT")).toBe(true);
    expect(texts.some((t) => t.value.startsWith("PT-100-"))).toBe(false);
    expect(texts.some((t) => t.value === "H=100")).toBe(false);
  });

  it("prefers the <Attr>Representation twin over the base attribute", () => {
    // Spec: "…Representation … should also be referenced in the graphics" —
    // FailAction=FailRetainPosition pairs with FailActionRepresentation=FM,
    // and the drawing shows the readable code.
    const profileFailAction = PROFILE_XML.replace(
      "&lt;TagName&gt;-&lt;NotModelled&gt;",
      "&lt;FailAction&gt;",
    );
    const withRepresentation = MAIN_XML.replace(
      '<Data property="TagName"><String>PT-100</String></Data>',
      `<Data property="FailAction"><DataReference data="Plant/Enumerations.FailActionClassification.FailRetainPosition"/></Data>
    <Data property="FailActionRepresentation"><String>FM</String></Data>`,
    );
    const texts = overlayTexts(withRepresentation, profileFailAction);
    expect(texts.some((t) => t.value === "FM")).toBe(true);
    expect(texts.some((t) => t.value === "FailRetainPosition")).toBe(false);
  });

  it("splits a template with line breaks into one text per line", () => {
    // The line break in the template's own Text is a real formatting
    // instruction from the profile.
    const profileMultiline = PROFILE_XML.replace(
      "&lt;TagName&gt;-&lt;NotModelled&gt;",
      "L1\n&lt;TagName&gt;",
    );
    const texts = overlayTexts(MAIN_XML, profileMultiline);
    const l1 = texts.find((t) => t.value === "L1");
    const l2 = texts.find((t) => t.value === "PT-100");
    expect(l1).toBeDefined();
    expect(l2).toBeDefined();
    // The second line advances by size × spacing in local (here world) y-down.
    expect((l2?.position.y ?? 0) - (l1?.position.y ?? 0)).toBeCloseTo(2.5 * 1.4);
  });
});

// -----------------------------------------------------------------------------
// Property-break value labels — the DISC profile places two label positions
// around the break symbol (<BreakValue1> below, <BreakValue2> above); each
// renders only when its generic value is real, per labelPolicy.
// -----------------------------------------------------------------------------

describe("property-break value labels", () => {
  const BREAK_PROFILE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Model name="Profile">
  <Object id="SymB" name="ND0007" type="Profile/Symbol">
    <Components property="Variants">
      <Object type="Profile/SymbolVariant">
        <Components property="Primitives">
          <Object type="Core/Diagram.Circle">
            <Data property="Center">
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>0</Double></Data>
                <Data property="Y"><Double>0</Double></Data>
              </AggregatedDataValue>
            </Data>
            <Data property="Radius"><Double>1.5</Double></Data>
          </Object>
        </Components>
        <Components property="LabelTemplates">
          <Object type="Profile/LabelTemplate">
            <Data property="Text"><String>&lt;BreakValue1&gt;</String></Data>
            <Data property="Position">
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>0</Double></Data>
                <Data property="Y"><Double>4</Double></Data>
              </AggregatedDataValue>
            </Data>
          </Object>
          <Object type="Profile/LabelTemplate">
            <Data property="Text"><String>&lt;BreakValue2&gt;</String></Data>
            <Data property="Position">
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>0</Double></Data>
                <Data property="Y"><Double>-4</Double></Data>
              </AggregatedDataValue>
            </Data>
          </Object>
        </Components>
      </Object>
    </Components>
  </Object>
</Model>`;

  function breakMainXml(breakBody: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Model name="Main">
  <Object id="PB1" type="Plant/Piping.PropertyBreak">${breakBody}</Object>
  <Object id="D1" type="Core/Diagram.Diagram">
    <Data property="MinX"><Double>0</Double></Data>
    <Data property="MinY"><Double>0</Double></Data>
    <Data property="MaxX"><Double>50</Double></Data>
    <Data property="MaxY"><Double>50</Double></Data>
    <Components property="Groups">
      <Object type="Core/Diagram.RepresentationGroup">
        <References objects="#PB1" property="Represents"/>
        <Components property="Elements">
          <Object type="Profile/SymbolUsage">
            <References objects="DiscProfile/ND0007" property="Symbol"/>
            <Data property="Position">
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>20</Double></Data>
                <Data property="Y"><Double>20</Double></Data>
              </AggregatedDataValue>
            </Data>
          </Object>
        </Components>
      </Object>
    </Components>
  </Object>
</Model>`;
  }

  function breakLabels(breakBody: string): TextPrim[] {
    return overlayTexts(breakMainXml(breakBody), BREAK_PROFILE_XML);
  }

  it("renders both value labels at the profile-defined positions when both values are real", () => {
    const texts = breakLabels(`
      <Data property="DiscProfile/BreakValue1"><String>AP110</String></Data>
      <Data property="DiscProfile/BreakValue2"><String>AP310</String></Data>`);
    const v1 = texts.find((t) => t.value === "AP110");
    const v2 = texts.find((t) => t.value === "AP310");
    expect(v1?.position).toEqual({ x: 20, y: 24 });
    expect(v2?.position).toEqual({ x: 20, y: 16 });
  });

  it("suppresses a leaked placeholder token instead of drawing it", () => {
    const texts = breakLabels(`
      <Data property="DiscProfile/BreakValue1"><String>&lt;BreakValue1&gt;</String></Data>
      <Data property="DiscProfile/BreakValue2"><String>AP310</String></Data>`);
    expect(texts.some((t) => t.value.includes("BreakValue"))).toBe(false);
    expect(texts.some((t) => t.value === "AP310")).toBe(true);
  });

  it("suppresses an invalid sentinel instead of drawing it", () => {
    const texts = breakLabels(`
      <Data property="DiscProfile/BreakValue1"><String>???</String></Data>
      <Data property="DiscProfile/BreakValue2"><String>N/A</String></Data>`);
    expect(texts).toHaveLength(0);
  });

  it("renders only the label position whose value exists", () => {
    const texts = breakLabels(`
      <Data property="DiscProfile/BreakValue1"><String>AP110</String></Data>`);
    expect(texts.map((t) => t.value)).toEqual(["AP110"]);
    expect(texts[0]?.position).toEqual({ x: 20, y: 24 });
  });

  it("never fills the generic labels from conflicting nested logical-break values", () => {
    // The parent has NO generic values; the nested records disagree, so
    // ownership is ambiguous and both generic positions stay empty.
    const texts = breakLabels(`
      <Components property="DiscProfile/LogicalBreaks">
        <Object id="AB1" type="DiscProfile/InformationModel.AreaBreak">
          <Data property="BreakValue1"><String>AP110</String></Data>
          <Data property="BreakValue2"><String>AP310</String></Data>
        </Object>
        <Object id="LB1" type="DiscProfile/InformationModel.LineIdBreak">
          <Data property="BreakValue1"><String>D-20L00004A</String></Data>
          <Data property="BreakValue2"><String>D-20L00004B</String></Data>
        </Object>
      </Components>`);
    expect(texts).toHaveLength(0);
  });
});

// -----------------------------------------------------------------------------
// Label ownership across the representation tree — suppression must work
// even when the explicit label group and the symbol group are siblings and
// the Represents reference sits at a different nesting level.
// -----------------------------------------------------------------------------

describe("explicit-label ownership in sibling representation groups", () => {
  // Parent group carries no Represents; the symbol sub-group represents
  // PIF1 while the label sub-group has no association of its own.
  const SIBLING_MAIN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Model name="Main">
  <Object id="PIF1" type="Plant/Instrumentation.ProcessInstrumentationFunction">
    <Data property="TagName"><String>PT-100</String></Data>
  </Object>
  <Object id="PIF2" type="Plant/Instrumentation.ProcessInstrumentationFunction">
    <Data property="TagName"><String>PT-200</String></Data>
  </Object>
  <Object id="D1" type="Core/Diagram.Diagram">
    <Data property="MinX"><Double>0</Double></Data>
    <Data property="MinY"><Double>0</Double></Data>
    <Data property="MaxX"><Double>50</Double></Data>
    <Data property="MaxY"><Double>50</Double></Data>
    <Components property="Groups">
      <Object type="Core/Diagram.RepresentationGroup">
        <Components property="Groups">
          <Object type="Core/Diagram.RepresentationGroup">
            <References objects="#PIF1" property="Represents"/>
            <Components property="Elements">
              <Object type="Profile/SymbolUsage">
                <References objects="DiscProfile/Balloon" property="Symbol"/>
                <Data property="Position">
                  <AggregatedDataValue type="Core/Diagram.Point">
                    <Data property="X"><Double>10</Double></Data>
                    <Data property="Y"><Double>20</Double></Data>
                  </AggregatedDataValue>
                </Data>
              </Object>
            </Components>
          </Object>
          <Object type="Core/Diagram.Label">
            <Components property="Elements">
              <Object type="Core/Diagram.Text">
                <Data property="Text"><String>PT-100</String></Data>
                <Data property="Position">
                  <AggregatedDataValue type="Core/Diagram.Point">
                    <Data property="X"><Double>10</Double></Data>
                    <Data property="Y"><Double>25</Double></Data>
                  </AggregatedDataValue>
                </Data>
              </Object>
              <Object type="Core/Diagram.Text">
                <Data property="Text"><String>REF-7</String></Data>
                <Data property="Position">
                  <AggregatedDataValue type="Core/Diagram.Point">
                    <Data property="X"><Double>10</Double></Data>
                    <Data property="Y"><Double>28</Double></Data>
                  </AggregatedDataValue>
                </Data>
              </Object>
            </Components>
          </Object>
        </Components>
      </Object>
      <Object type="Core/Diagram.RepresentationGroup">
        <References objects="#PIF2" property="Represents"/>
        <Components property="Elements">
          <Object type="Profile/SymbolUsage">
            <References objects="DiscProfile/Balloon" property="Symbol"/>
            <Data property="Position">
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>30</Double></Data>
                <Data property="Y"><Double>20</Double></Data>
              </AggregatedDataValue>
            </Data>
          </Object>
        </Components>
      </Object>
    </Components>
  </Object>
</Model>`;

  const texts = overlayTexts(SIBLING_MAIN_XML);

  it("renders the multi-part explicit label once, unmerged and in place", () => {
    const tag = texts.filter((t) => t.value === "PT-100");
    const ref = texts.filter((t) => t.value === "REF-7");
    expect(tag).toHaveLength(1);
    expect(ref).toHaveLength(1);
    expect(tag[0]?.position).toEqual({ x: 10, y: 25 });
    expect(ref[0]?.position).toEqual({ x: 10, y: 28 });
  });

  it("suppresses every profile template for the explicitly labelled sibling object", () => {
    expect(texts.some((t) => t.value === "PT-100-")).toBe(false);
    expect(texts.some((t) => t.value === "H=100")).toBe(false);
  });

  it("still generates fallback labels for the object without an explicit label", () => {
    expect(texts.some((t) => t.value === "PT-200-")).toBe(true);
  });

  it("scopes suppression per object, not by text value", () => {
    // PIF2's fallback tag renders even though PIF1's explicit label exists
    // elsewhere in the drawing — only PIF1's templates are suppressed.
    const withIdenticalText = SIBLING_MAIN_XML.replace("<String>PT-200</String>", "<String>PT-100</String>");
    const t2 = overlayTexts(withIdenticalText);
    expect(t2.some((t) => t.value === "PT-100-")).toBe(true);
  });
});

describe("property-break exporter placeholders", () => {
  // Reuses the ND0007 break fixture from the describe above via module scope
  // is not possible — rebuild the minimal pieces here.
  const BREAK_PROFILE = `<?xml version="1.0" encoding="UTF-8"?>
<Model name="Profile">
  <Object id="SymB" name="ND0007" type="Profile/Symbol">
    <Components property="Variants">
      <Object type="Profile/SymbolVariant">
        <Components property="Primitives">
          <Object type="Core/Diagram.Circle">
            <Data property="Center">
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>0</Double></Data>
                <Data property="Y"><Double>0</Double></Data>
              </AggregatedDataValue>
            </Data>
            <Data property="Radius"><Double>1.5</Double></Data>
          </Object>
        </Components>
        <Components property="LabelTemplates">
          <Object type="Profile/LabelTemplate">
            <Data property="Text"><String>&lt;BreakValue1&gt;</String></Data>
            <Data property="Position">
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>0</Double></Data>
                <Data property="Y"><Double>4</Double></Data>
              </AggregatedDataValue>
            </Data>
          </Object>
          <Object type="Profile/LabelTemplate">
            <Data property="Text"><String>&lt;BreakValue2&gt;</String></Data>
            <Data property="Position">
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>0</Double></Data>
                <Data property="Y"><Double>-4</Double></Data>
              </AggregatedDataValue>
            </Data>
          </Object>
        </Components>
      </Object>
    </Components>
  </Object>
</Model>`;

  function breakXml(v1: string, v2: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Model name="Main">
  <Object id="PB1" type="Plant/Piping.PropertyBreak">
    <Data property="DiscProfile/BreakValue1"><String>${v1}</String></Data>
    <Data property="DiscProfile/BreakValue2"><String>${v2}</String></Data>
  </Object>
  <Object id="D1" type="Core/Diagram.Diagram">
    <Data property="MinX"><Double>0</Double></Data>
    <Data property="MinY"><Double>0</Double></Data>
    <Data property="MaxX"><Double>50</Double></Data>
    <Data property="MaxY"><Double>50</Double></Data>
    <Components property="Groups">
      <Object type="Core/Diagram.RepresentationGroup">
        <References objects="#PB1" property="Represents"/>
        <Components property="Elements">
          <Object type="Profile/SymbolUsage">
            <References objects="DiscProfile/ND0007" property="Symbol"/>
            <Data property="Position">
              <AggregatedDataValue type="Core/Diagram.Point">
                <Data property="X"><Double>20</Double></Data>
                <Data property="Y"><Double>20</Double></Data>
              </AggregatedDataValue>
            </Data>
          </Object>
        </Components>
      </Object>
    </Components>
  </Object>
</Model>`;
  }

  it("renders zero break-label nodes for the repeated placeholder filler", () => {
    expect(overlayTexts(breakXml("????????", "????????"), BREAK_PROFILE)).toHaveLength(0);
    expect(overlayTexts(breakXml("xxxx", "-----"), BREAK_PROFILE)).toHaveLength(0);
  });

  it("renders exactly one label when only one side is real", () => {
    const texts = overlayTexts(breakXml("AP110", "????????"), BREAK_PROFILE);
    expect(texts.map((t) => t.value)).toEqual(["AP110"]);
    expect(texts[0]?.position).toEqual({ x: 20, y: 24 });
  });

  it("keeps the raw placeholder available to the data/properties view", () => {
    const profile = parseDiscProfile(BREAK_PROFILE).data ?? null;
    const doc = parseDexpiDocument(breakXml("????????", "AP310"), profile).data;
    const attrs = doc?.plant.byId.get("PB1")?.attributes ?? [];
    expect(attrs.some((a) => a.value === "????????")).toBe(true);
  });
});
