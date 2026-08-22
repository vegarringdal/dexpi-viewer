import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDiscProfile } from "./discProfile.ts";
import { parseDexpiDocument } from "./parseDocument.ts";

const DIR = join(__dirname, "../../../refrences/discdexpi-2026pack/Blueprint/DISC_EXAMPLE-14");
const SWEEP_TIMEOUT_MS = 60_000;

// -----------------------------------------------------------------------------
// Smoke sweep over every real DISC_EXAMPLE-14 sheet (15 files, each with an
// official SVG rendering next to it). Guards the end-to-end claim: real DISC
// data parses against the official 0.6.3 profile with no errors and no
// unresolved profile symbols — the only expected findings are the "/Border"
// well-known shape and genuine off-page pipe warnings (V05).
// -----------------------------------------------------------------------------

describe("DISC_EXAMPLE-14 sweep (official profile)", () => {
  it(
    "every sheet parses cleanly; warnings only, all explained",
    () => {
      const profileXml = readFileSync(
        join(__dirname, "../../../refrences/discdexpi-2026pack/Profile/xml/DiscProfile.xml"),
        "utf-8",
      );
      const profile = parseDiscProfile(profileXml).data;
      if (!profile) {
        throw new Error("profile parse failed");
      }

      const sheets = readdirSync(DIR).filter((f) => f.endsWith(".xml"));
      expect(sheets.length).toBe(15);
      for (const sheet of sheets) {
        const xml = readFileSync(join(DIR, sheet), "utf-8");
        const doc = parseDexpiDocument(xml, profile).data;
        if (!doc) {
          throw new Error(`${sheet}: parse failed`);
        }

        expect(doc.scene.nodes.length, sheet).toBeGreaterThan(0);
        expect(
          doc.issues.filter((i) => i.severity === "error"),
          sheet,
        ).toEqual([]);
        const unresolved = doc.issues
          .filter((i) => i.ruleId === "V03")
          .map((i) => i.message.match(/"([^"]+)"/)?.[1] ?? "?");
        expect(unresolved, sheet).toEqual(["/Border"]);
        expect(
          doc.issues.every((i) => i.ruleId === "V03" || i.ruleId === "V05"),
          sheet,
        ).toBe(true);
      }
    },
    SWEEP_TIMEOUT_MS,
  );
});
