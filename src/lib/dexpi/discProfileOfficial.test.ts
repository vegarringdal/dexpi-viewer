import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type DiscProfile, parseDiscProfile, pickVariant } from "./discProfile.ts";
import { normalizeLabelTemplateText } from "./labelExpression.ts";

// -----------------------------------------------------------------------------
// The official DISC Profile catalogues from the DISC DEXPI 2026 Pack — the
// first real, published profile data (earlier support was reconstructed from
// the prior-art viewer). Both bundled releases are regression anchors: the
// counts match the pack's own comparison reports (284 symbols in v0.6.3, 292
// in v0.6.4), and §4.2 of the 0.6.3→0.6.4 report drives the diff assertions.
// -----------------------------------------------------------------------------

const BUNDLED_DIR = join(__dirname, "../../../public/profiles");

function loadBundledProfile(version: string): DiscProfile {
  const xml = readFileSync(join(BUNDLED_DIR, `DiscProfile-${version}.xml`), "utf-8");
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

/** Every LabelTemplate text a symbol carries, across all its variants. */
function templateTexts(profile: DiscProfile, symbolName: string): readonly string[] {
  return (profile.symbols.get(symbolName)?.variants ?? []).flatMap((v) =>
    v.labelTemplates.map((t) => t.text),
  );
}

// -----------------------------------------------------------------------------
// Catalogue shape, per bundled release
// -----------------------------------------------------------------------------

type CatalogueShape = Readonly<{
  version: string;
  /** The version the catalogue stamps on itself — 0.6.4 is the first to do so. */
  stamp: string | null;
  symbols: number;
  variants: number;
  withTemplates: number;
}>;

const CATALOGUES: readonly CatalogueShape[] = [
  { version: "0.6.3", stamp: null, symbols: 284, variants: 320, withTemplates: 210 },
  { version: "0.6.4", stamp: "0.6.4", symbols: 292, variants: 328, withTemplates: 215 },
];

for (const shape of CATALOGUES) {
  describe(`official DiscProfile ${shape.version} (DISC DEXPI 2026 Pack)`, () => {
    const profile = loadBundledProfile(shape.version);
    const names = [...profile.symbols.keys()].filter((k) => !k.startsWith("DiscProfile/"));

    it("reports the version it was stamped with", () => {
      expect(profile.version).toBe(shape.stamp);
    });

    it(`parses the full catalogue: ${String(shape.symbols)} symbols, all with variants`, () => {
      expect(names.length).toBe(shape.symbols);
      const totalVariants = names.reduce((sum, n) => sum + (profile.symbols.get(n)?.variants.length ?? 0), 0);
      expect(totalVariants).toBe(shape.variants);
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
      expect(withTemplates.length).toBe(shape.withTemplates);
      const sample = profile.symbols
        .get(withTemplates[0] ?? "")
        ?.variants.flatMap((v) => v.labelTemplates)[0];
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

    it("collects the published TypeCode catalogue instances with their abbreviations", () => {
      const mcc = profile.instances.get(
        "DiscProfile/InformationModel.ProcessInstrumentationFunctionTypeCodes.MotorControlCenter",
      );
      expect(mcc?.get("Abbreviation")).toBe("MCC");
      expect(
        profile.instances.get("InformationModel.ControlledActuatorTypeCodes.Motor")?.get("Abbreviation"),
      ).toBe("M");
    });
  });
}

// -----------------------------------------------------------------------------
// 0.6.3 → 0.6.4 diff (DiscProfile_Changes_0.6.3_to_0.6.4.md §3, §4)
// -----------------------------------------------------------------------------

describe("what 0.6.4 changed against 0.6.3", () => {
  const v3 = loadBundledProfile("0.6.3");
  const v4 = loadBundledProfile("0.6.4");

  it("adds ND0268–ND0275 and removes none (§4.1, §4.3)", () => {
    const added = ["ND0268", "ND0269", "ND0270", "ND0271", "ND0272", "ND0273", "ND0274", "ND0275"];
    for (const name of added) {
      expect(v3.symbols.has(name)).toBe(false);
      expect(v4.symbols.has(name)).toBe(true);
    }

    const removed = [...v3.symbols.keys()].filter((k) => !v4.symbols.has(k));
    expect(removed).toEqual([]);
  });

  it("adds the class the new FlangeSpadeSpacer symbol draws, drops two others (§3.1, §3.2)", () => {
    expect(v4.classSupers.has("DiscProfile/InformationModel.FlangeSpadeSpacer")).toBe(true);
    expect(v3.classSupers.has("DiscProfile/InformationModel.FlangeSpadeSpacer")).toBe(false);
    for (const gone of ["LevelMeasuringInstrumentNuclear", "PipingInstrInterface"]) {
      expect(v3.classSupers.has(`DiscProfile/InformationModel.${gone}`)).toBe(true);
      expect(v4.classSupers.has(`DiscProfile/InformationModel.${gone}`)).toBe(false);
    }
  });

  it("appends <ShutoffCapability> to the valve label template (§4.2.1)", () => {
    expect(templateTexts(v3, "ND0012").join("\n")).not.toContain("<ShutoffCapability>");
    expect(templateTexts(v4, "ND0012").join("\n")).toContain("<LockMechanism> <ShutoffCapability>");
  });

  it("switches the actuator label to <FailActionRepresentation> (§4.2.2)", () => {
    expect(templateTexts(v3, "ND0049")).toContain("<FailAction>");
    expect(templateTexts(v4, "ND0049")).toContain("<FailActionRepresentation>");
  });

  it("strips the valve label template off ND0187 and adds one to ND0224 (§4.2.5)", () => {
    expect(templateTexts(v3, "ND0187").length).toBeGreaterThan(0);
    expect(templateTexts(v4, "ND0187")).toEqual([]);
    expect(templateTexts(v3, "ND0224")).toEqual([]);
    expect(templateTexts(v4, "ND0224")).toContain("<PipeSlopeRatio>");
  });

  it("prefixes the set point and repairs the alarm literals (§4.2.3)", () => {
    // 0.6.3 wrote the alarm templates without their opening quote; both
    // spellings must normalize to the same plain template text.
    const alarms3 = templateTexts(v3, "ND0006").filter((t) => t.includes("AlarmValue"));
    const alarms4 = templateTexts(v4, "ND0006").filter((t) => t.includes("AlarmValue"));
    expect(alarms3).toContain("H=' & SignalConveyingFunction:<AlarmValue>");
    expect(alarms4).toContain("'H=' & SignalConveyingFunction:<AlarmValue>");
    expect(alarms3.map(normalizeLabelTemplateText)).toEqual(alarms4.map(normalizeLabelTemplateText));

    expect(templateTexts(v3, "ND0248B")).toContain("<SetPoint>");
    expect(templateTexts(v4, "ND0248B")).toContain("'SP = ' & <SetPoint>");
    expect(normalizeLabelTemplateText("'SP = ' & <SetPoint>")).toBe("SP = <SetPoint>");
  });
});

// -----------------------------------------------------------------------------
// Break-label placement regression against the pack's official SVG rendering
// of DISC_EXAMPLE-14-08: the ND0007 property-break labels are bottom-anchored
// blocks at the template anchors (±2mm around the break at x=502, y=-11
// relative), left stack right-aligned, right stack left-aligned, lines
// growing UPWARD from the anchor. (The official tool uses 1.0× line spacing;
// ours is the global 1.4×, so the top line sits 1.3mm higher — accepted.)
//
// The DISC_EXAMPLE-14 sheets import the unversioned DiscProfile URI, so they
// are rendered against 0.6.3 — the release they were authored with.
// -----------------------------------------------------------------------------

describe("property-break labels on the real sheet 08", () => {
  const sheetProfile = (): DiscProfile => loadBundledProfile("0.6.3");

  it("emits one bottom-anchored block per side, matching the official anchors", async () => {
    const { parseDexpiDocument } = await import("./parseDocument.ts");
    const { sceneToSvg } = await import("./exportSvg.ts");
    const sheetXml = readFileSync(
      join(
        __dirname,
        "../../../refrences/discdexpi-2026pack/Blueprint/DISC_EXAMPLE-14/DISC_EXAMPLE-14-08.xml",
      ),
      "utf-8",
    );
    const doc = parseDexpiDocument(sheetXml, sheetProfile()).data;
    if (!doc) {
      throw new Error("sheet parse failed");
    }

    const svg = sceneToSvg(doc.scene);
    const labels = (svg.match(/<text[^>]*>(?:<tspan[^>]*>)?AP310<[\s\S]*?<\/text>/g) ?? []).filter((t) =>
      t.includes("D-20L00004B"),
    );
    expect(labels.length).toBe(2);

    const left = labels.find((t) => t.includes('text-anchor="end"'));
    const right = labels.find((t) => t.includes('text-anchor="start"'));
    expect(left).toContain('transform="translate(500,411)"');
    expect(right).toContain('transform="translate(504,411)"');
    // Bottom-aligned block: last line at the anchor (y=0), first line above it.
    for (const label of [left ?? "", right ?? ""]) {
      expect(label).toContain('y="-4.62">AP310');
      expect(label).toContain('y="0">D-20L00004B');
    }
  });

  it("collapses the 48-space padding in sheet 12's BreakValue2 (whitespace parity)", async () => {
    // The raw data pads the second line with 48 leading spaces; browsers
    // collapse them when rendering the official SVG, so every renderer must
    // lay the line out trimmed or it lands ~44mm to the right, on the pump.
    const { parseDexpiDocument } = await import("./parseDocument.ts");
    const { sceneToSvg } = await import("./exportSvg.ts");
    const sheetXml = readFileSync(
      join(
        __dirname,
        "../../../refrences/discdexpi-2026pack/Blueprint/DISC_EXAMPLE-14/DISC_EXAMPLE-14-12.xml",
      ),
      "utf-8",
    );
    const doc = parseDexpiDocument(sheetXml, sheetProfile()).data;
    if (!doc) {
      throw new Error("sheet parse failed");
    }

    const svg = sceneToSvg(doc.scene);
    expect(svg).toContain('y="0">D-20L00004B</tspan>');
    expect(svg).not.toContain("> D-20L00004B");
    expect(svg).not.toContain("  D-20L00004B");

    // Labels rotate with their placement (normalized to the readable
    // half-plane): the line label along a vertical pipe and a vertical
    // valve's tag both render rotate(270), like the official SVG.
    const lineLabel = svg.match(/<text[^>]*>D-20L00004A-1400PL-AS200-<\/text>/)?.[0] ?? "";
    expect(lineLabel).toContain("rotate(270)");
    const valveTag = svg.match(/<text[^>]*>(?:<tspan[^>]*>)?D-VG20-0001</)?.[0] ?? "";
    expect(valveTag).toContain("rotate(270)");

    // The 180°-rotated off-page connector at (788,414) keeps its labels
    // upright at the UNROTATED template offsets, like the official SVG
    // (descriptor at x=788.875, drawing number at x=789.125, no rotate()).
    const connectorTexts = svg.match(/<text[^>]*>(?:TO TEST P&amp;ID3|C01_NOA3)<\/text>/g) ?? [];
    expect(connectorTexts.length).toBeGreaterThanOrEqual(2);
    expect(connectorTexts.some((t) => t.includes("translate(788.875,"))).toBe(true);
    expect(connectorTexts.some((t) => t.includes("translate(789.125,"))).toBe(true);
    for (const text of connectorTexts) {
      expect(text).not.toContain("rotate(");
    }
  });

  it('resolves the balloon plant codes to "D-20" on every instrument (official parity: 19)', async () => {
    // The <ProcessPlantIdentificationCode>-<PlantSystemIdentificationCode>
    // template resolves via ParentStructure/PlantSystem references where the
    // represented object carries them, and via the document-level unique-
    // carrier fallback where it does not (inline flow elements like the
    // FE-ballooned Coriolis meter carry no references at all).
    const { parseDexpiDocument } = await import("./parseDocument.ts");
    const { sceneToSvg } = await import("./exportSvg.ts");
    const sheetXml = readFileSync(
      join(
        __dirname,
        "../../../refrences/discdexpi-2026pack/Blueprint/DISC_EXAMPLE-14/DISC_EXAMPLE-14-08.xml",
      ),
      "utf-8",
    );
    const doc = parseDexpiDocument(sheetXml, sheetProfile()).data;
    if (!doc) {
      throw new Error("sheet parse failed");
    }

    const svg = sceneToSvg(doc.scene);
    expect((svg.match(/>D-20</g) ?? []).length).toBe(19);

    // <TypeCode> labels resolve through References into the published
    // TypeCode instances — official parity per code (the official SVG's two
    // extra 8px "M"s are border grid letters, not labels).
    expect((svg.match(/>MCC</g) ?? []).length).toBe(1);
    expect((svg.match(/>PSD</g) ?? []).length).toBe(4);
    expect((svg.match(/>ESD</g) ?? []).length).toBe(1);
    expect((svg.match(/>M</g) ?? []).length).toBe(2);

    // Semantic signal-line styling per the DISC decoration table: 12 plain
    // signal lines dash 3/3; the bus and electrical lines draw solid with
    // marks — the bus circle keeps its observed spot 5mm in at (321,54).
    expect((svg.match(/stroke-dasharray="3 3"/g) ?? []).length).toBe(12);
    expect((svg.match(/stroke-dasharray="2.75 4.75"/g) ?? []).length).toBe(0);
    expect(svg).toContain('<circle cx="321" cy="54" r="1.25"');
  });
});
