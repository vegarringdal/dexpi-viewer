import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { DiscProfile } from "./discProfile.ts";
import { parseDiscProfile } from "./discProfile.ts";
import { flattenScene } from "./flattenScene.ts";
import { parseDexpiDocument } from "./parseDocument.ts";
import type { DexpiDocument } from "./types.ts";

// -----------------------------------------------------------------------------
// Label placement against the OFFICIAL renderings
//
// Every DISC_EXAMPLE-14 sheet ships an official .svg next to its .xml, drawn
// by the tool that authored the data — ground truth for where a label
// belongs. Both use the same coordinate system (verified: matching text
// elements land on identical x, and y within a text baseline), so a rendered
// label can be compared straight to the official one carrying the same
// string. That makes this the regression test for the rotated-label rules in
// profileLabels.ts, which are otherwise easy to "fix" in one place and break
// in another: a rule that mispositions rotated labels shows up here as a
// drop in MIN_MATCHED, whatever hand-written fixture it satisfies.
//
// Tolerance is 5 units — alignment/baseline differences are ~1-3 units,
// while a wrong rotation rule misses by 8-25 (the diameter of the symbol).
// -----------------------------------------------------------------------------

const DIR = join(__dirname, "../../../refrences/discdexpi-2026pack/Blueprint/DISC_EXAMPLE-14");
const PROFILE = join(__dirname, "../../../refrences/discdexpi-2026pack/Profile/xml/DiscProfile.xml");
const TOLERANCE = 5;
const SWEEP_TIMEOUT_MS = 60_000;
/** Comparable labels that must land on their official position. The 12
 *  allowed misses are pre-existing and unrelated to placement rotation: one
 *  duplicated-tag sheet label ("D-20HA001", ~6.8 off) and a "SI" signal tag
 *  the sheets draw elsewhere entirely. */
const MIN_MATCHED = 1862;
const MAX_MISSED = 12;

type SvgText = Readonly<{ value: string; x: number; y: number }>;

// The official profile is a 30 MB catalogue and each sheet is ~1 MB: parse
// each exactly once for the whole file, or the suite spends its time
// re-parsing fixtures instead of checking them.
let profileCache: DiscProfile | null = null;
const documentCache = new Map<string, DexpiDocument>();

function officialProfile(): DiscProfile {
  if (!profileCache) {
    const parsed = parseDiscProfile(readFileSync(PROFILE, "utf-8")).data;
    if (!parsed) {
      throw new Error("official profile failed to parse");
    }

    profileCache = parsed;
  }
  return profileCache;
}

function officialSheet(name: string): DexpiDocument {
  const cached = documentCache.get(name);
  if (cached) {
    return cached;
  }

  const doc = parseDexpiDocument(readFileSync(join(DIR, name), "utf-8"), officialProfile()).data;
  if (!doc) {
    throw new Error(`${name}: parse failed`);
  }

  documentCache.set(name, doc);
  return doc;
}

const SVG_TEXT = /<text[^>]*transform="translate\(([-\d.]+),([-\d.]+)\)[^"]*"[^>]*>([^<]*)<\/text>/g;

function decodeXml(value: string): string {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function officialTexts(svg: string): readonly SvgText[] {
  const out: SvgText[] = [];
  for (const match of svg.matchAll(SVG_TEXT)) {
    out.push({
      value: decodeXml(match[3] ?? "").trim(),
      x: Number(match[1]),
      y: Number(match[2]),
    });
  }
  return out;
}

describe("label placement vs the official DISC_EXAMPLE-14 renderings", () => {
  it(
    "every rendered label sits where the official SVG draws it",
    () => {
      let matched = 0;
      const missed: string[] = [];
      for (const sheet of readdirSync(DIR).filter((file) => file.endsWith(".xml"))) {
        const doc = officialSheet(sheet);
        const official = officialTexts(readFileSync(join(DIR, `${sheet.slice(0, -4)}.svg`), "utf-8"));
        for (const prim of flattenScene(doc.scene)) {
          if (prim.kind !== "text") {
            continue;
          }

          // The official renderer emits one <text> per line; comparing the
          // first line anchors multi-line labels without modelling layout.
          const firstLine = prim.value.split("\n")[0]?.trim() ?? "";
          const sameText = official.filter((text) => text.value === firstLine);
          if (firstLine.length === 0 || sameText.length === 0) {
            continue;
          }

          const nearest = Math.min(
            ...sameText.map((text) => Math.hypot(text.x - prim.position.x, text.y - prim.position.y)),
          );
          if (nearest <= TOLERANCE) {
            matched += 1;
          } else {
            missed.push(`${sheet} ${JSON.stringify(firstLine)} off by ${nearest.toFixed(1)}`);
          }
        }
      }

      expect(missed.length, missed.join("\n")).toBeLessThanOrEqual(MAX_MISSED);
      expect(matched).toBeGreaterThanOrEqual(MIN_MATCHED);
    },
    SWEEP_TIMEOUT_MS,
  );

  it(
    "draws ND0049's rotated type code inside its own circle",
    () => {
      // DISC_EXAMPLE-14-01 places ND0049 (actuator badge: stem, circle at
      // local (0,-10) r3, type-code label at local (0,-10.5)) at position
      // (292,160) rotated 270°. The official SVG draws "M" at (283.15,160)
      // rotate(270) — the label anchor rotated WITH the placement, inside the
      // circle at (282,160). Positioning it by the normalized glyph angle
      // instead would put it at (302.5,160), 20 units away on the far side.
      const doc = officialSheet("DISC_EXAMPLE-14-01.xml");
      const badge = flattenScene(doc.scene).find(
        (prim) => prim.kind === "text" && prim.value === "M" && Math.abs(prim.position.y - 160) < TOLERANCE,
      );
      expect(badge?.kind).toBe("text");
      if (badge?.kind !== "text") {
        return;
      }

      expect(badge.position.x).toBeCloseTo(281.5);
      expect(badge.position.y).toBeCloseTo(160);
      expect(badge.rotation).toBe(270);
    },
    SWEEP_TIMEOUT_MS,
  );
});
