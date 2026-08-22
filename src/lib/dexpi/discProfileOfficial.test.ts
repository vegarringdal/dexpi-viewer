import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type DiscProfile, parseDiscProfile, pickVariant } from "./discProfile.ts";

// -----------------------------------------------------------------------------
// The official DISC Profile 0.6.3 catalogue from the DISC DEXPI 2026 Pack —
// the first real, published profile data (earlier support was reconstructed
// from the prior-art viewer). These are regression anchors: the counts match
// the pack's own 0.6.0→0.6.3 comparison report (284 symbols in v0.6.3).
// -----------------------------------------------------------------------------

function loadOfficialProfile(): DiscProfile {
  const xml = readFileSync(
    join(__dirname, "../../../refrences/discdexpi-2026pack/Profile/xml/DiscProfile.xml"),
    "utf-8",
  );
  const result = parseDiscProfile(xml);
  if (!result.data) {
    throw new Error(result.error?.msg ?? "profile parse failed");
  }

  return result.data;
}

function makeInstance(attribute: string, value: string): Element {
  const dom = new DOMParser().parseFromString(
    `<Object><Data property="${attribute}"><String>${value}</String></Data></Object>`,
    "text/xml",
  );
  const el = dom.querySelector("Object");
  if (!el) {
    throw new Error("instance fixture failed");
  }

  return el;
}

describe("official DiscProfile 0.6.3 (DISC DEXPI 2026 Pack)", () => {
  const profile = loadOfficialProfile();
  const names = [...profile.symbols.keys()].filter((k) => !k.startsWith("DiscProfile/"));

  it("parses the full catalogue: 284 symbols, all with variants", () => {
    expect(names.length).toBe(284);
    const totalVariants = names.reduce((sum, n) => sum + (profile.symbols.get(n)?.variants.length ?? 0), 0);
    expect(totalVariants).toBe(320);
    // Every symbol is reachable under both its bare and DiscProfile/-prefixed key.
    for (const name of names) {
      expect(profile.symbols.get(`DiscProfile/${name}`)).toBe(profile.symbols.get(name));
    }
  });

  it("only the label-/node-only symbols have primitive-less variants", () => {
    const emptyPrim = names.filter((n) =>
      profile.symbols.get(n)?.variants.some((v) => v.primitives.length === 0),
    );
    expect(emptyPrim.sort()).toEqual(["ND0000", "ND0040", "ND0041"]);
  });

  it("label templates parse for the majority of symbols", () => {
    const withTemplates = names.filter((n) =>
      profile.symbols.get(n)?.variants.some((v) => v.labelTemplates.length > 0),
    );
    expect(withTemplates.length).toBe(210);
    const sample = profile.symbols.get(withTemplates[0] ?? "")?.variants.flatMap((v) => v.labelTemplates)[0];
    expect(sample?.text.length).toBeGreaterThan(0);
    expect(Number.isFinite(sample?.size)).toBe(true);
  });

  it("variant conditions parse and pickVariant honours them", () => {
    const conditioned = names
      .map((n) => profile.symbols.get(n))
      .find((sym) => sym?.variants.some((v) => v.condition !== null));
    if (!conditioned) {
      throw new Error("catalogue has no conditioned symbol");
    }

    const variant = conditioned.variants.find((v) => v.condition !== null);
    const condition = variant?.condition;
    if (!variant || !condition) {
      throw new Error("no condition found");
    }

    const matching = makeInstance(condition.attributeName, condition.literalValue);
    expect(pickVariant(conditioned, matching)).toBe(variant);
    expect(pickVariant(conditioned, null)).not.toBe(variant);
  });

  it("carries no heat-trace LineStroke instance (catalogue defines classes, not runs)", () => {
    expect(profile.heatTraceStroke).toBeNull();
  });
});
