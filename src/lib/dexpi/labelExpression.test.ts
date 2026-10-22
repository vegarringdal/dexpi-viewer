import { describe, expect, it } from "vitest";
import { normalizeLabelTemplateText } from "./labelExpression.ts";

describe("normalizeLabelTemplateText", () => {
  it("leaves a plain template untouched, whitespace and newlines included", () => {
    const plain = "<ObjectDisplayName>\n<NominalDiameterRepresentation><ValveDataSheet>\n<TrimType> ";
    expect(normalizeLabelTemplateText(plain)).toBe(plain);
  });

  it("concatenates a quoted literal with a placeholder (0.6.4 set point)", () => {
    expect(normalizeLabelTemplateText("'SP = ' & <SetPoint>")).toBe("SP = <SetPoint>");
  });

  it("keeps whitespace inside a literal but drops it around the operator", () => {
    expect(normalizeLabelTemplateText("'Min: '   &   <LowerLimitEndToEndLength>")).toBe(
      "Min: <LowerLimitEndToEndLength>",
    );
  });

  it("reads the 0.6.4 alarm templates, prefix intact for the port-status hint", () => {
    expect(normalizeLabelTemplateText("'HH=' & SignalConveyingFunction:<AlarmValue>")).toBe(
      "HH=SignalConveyingFunction:<AlarmValue>",
    );
  });

  it("reduces 0.6.6's bare alarm letters to the letter alone", () => {
    expect(normalizeLabelTemplateText("'H'")).toBe("H");
    expect(normalizeLabelTemplateText("'L'")).toBe("L");
  });

  it("repairs 0.6.3's missing opening quote to the same result", () => {
    // 0.6.3 shipped "H=' & …" — an odd quote count means the first quote
    // closes a literal that was never opened.
    for (const prefix of ["H", "HH", "L", "LL"]) {
      const legacy = `${prefix}=' & SignalConveyingFunction:<AlarmValue>`;
      const corrected = `'${prefix}=' & SignalConveyingFunction:<AlarmValue>`;
      expect(normalizeLabelTemplateText(legacy)).toBe(normalizeLabelTemplateText(corrected));
      expect(normalizeLabelTemplateText(legacy)).toBe(`${prefix}=SignalConveyingFunction:<AlarmValue>`);
    }
  });

  it("chains more than two operands and unescapes a doubled quote", () => {
    expect(normalizeLabelTemplateText("'a' & <X> & 'b' & <Y>")).toBe("a<X>b<Y>");
    expect(normalizeLabelTemplateText("'it''s' & <X>")).toBe("it's<X>");
  });

  it("drops a stray quote instead of swallowing the rest of the text", () => {
    expect(normalizeLabelTemplateText("'abc")).toBe("abc");
  });

  it("collapses operators in an all-placeholder expression", () => {
    expect(normalizeLabelTemplateText("<A> & <B>")).toBe("<A><B>");
  });
});
