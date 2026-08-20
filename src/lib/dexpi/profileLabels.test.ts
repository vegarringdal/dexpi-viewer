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
