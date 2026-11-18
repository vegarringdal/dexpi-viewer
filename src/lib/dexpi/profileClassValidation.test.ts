import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type DiscProfile, parseDiscProfile } from "./discProfile.ts";
import { checkProfileClasses } from "./profileClassValidation.ts";
import { categoryOfRule, RULE_TITLES, validateDocument } from "./validation.ts";

// -----------------------------------------------------------------------------
// Fixtures — the real bundled catalogues, since what a release defines is
// exactly what the rule checks against.
// -----------------------------------------------------------------------------

const BUNDLED_DIR = join(__dirname, "../../../public/profiles");

function loadBundledProfile(version: string): DiscProfile {
  const result = parseDiscProfile(readFileSync(join(BUNDLED_DIR, `DiscProfile-${version}.xml`), "utf-8"));
  if (!result.data) {
    throw new Error(result.error?.msg ?? "profile parse failed");
  }

  return result.data;
}

function documentWith(prefix: string, types: readonly string[]): Element {
  const objects = types.map((type, i) => `<Object id="O${String(i)}" type="${prefix}/${type}"/>`).join("");
  const xml = `<Model name="M"><Import prefix="${prefix}" source="http://www.to.define/DiscProfile/0.6.6"/>${objects}</Model>`;
  return new DOMParser().parseFromString(xml, "text/xml").documentElement;
}

const TIE_IN = "InformationModel.TieInPoint";
const GATE_VALVE = "InformationModel.WedgeGateValve";

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe("profile classes against the selected catalogue (MDL-010)", () => {
  const v6 = loadBundledProfile("0.6.6");
  const v7 = loadBundledProfile("0.6.7");

  it("accepts TieInPoint against 0.6.6 and flags it against 0.6.7, which removed it", () => {
    const doc = documentWith("DiscProfile", [TIE_IN, TIE_IN, GATE_VALVE]);
    expect(checkProfileClasses(doc, v6)).toEqual([]);

    const issues = checkProfileClasses(doc, v7);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ ruleId: "MDL-010", severity: "warning", objectId: "O0" });
    expect(issues[0]?.message).toContain(`"DiscProfile/${TIE_IN}" (2×)`);
    expect(issues[0]?.message).toContain("DiscProfile 0.6.7");
  });

  it("follows the document's own import prefix", () => {
    expect(checkProfileClasses(documentWith("Disc", [TIE_IN]), v7)).toHaveLength(1);
    expect(checkProfileClasses(documentWith("Disc", [GATE_VALVE]), v7)).toEqual([]);
  });

  it("stays silent without a loaded catalogue or a DiscProfile import", () => {
    expect(checkProfileClasses(documentWith("DiscProfile", [TIE_IN]), null)).toEqual([]);
    const noImport = new DOMParser().parseFromString(
      `<Model name="M"><Object id="A" type="DiscProfile/${TIE_IN}"/></Model>`,
      "text/xml",
    ).documentElement;
    expect(checkProfileClasses(noImport, v7)).toEqual([]);
  });

  it("is registered as a model rule and runs in validateDocument", () => {
    expect(RULE_TITLES["MDL-010"]).toBeDefined();
    expect(categoryOfRule("MDL-010")).toBe("model");
    const ruleIds = validateDocument(documentWith("DiscProfile", [TIE_IN]), v7).map((i) => i.ruleId);
    expect(ruleIds).toContain("MDL-010");
  });
});
