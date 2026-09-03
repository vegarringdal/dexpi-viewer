import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { DiscProfile } from "./discProfile.ts";
import { parseDiscProfile } from "./discProfile.ts";
import { parseDexpiDocument } from "./parseDocument.ts";
import type { DexpiDocument } from "./types.ts";

// -----------------------------------------------------------------------------
// Off-page connector labels (real DISC data): the drawing reference lives on
// an ID-LESS PipeOffPageConnectorReferenceByNumber child of the connector —
// invisible to the id-keyed lookup index until ownAttribute learned to fold
// id-less component descendants into their owner. Regression for that fix.
// -----------------------------------------------------------------------------

const BASE = join(__dirname, "../../../refrences/discdexpi-2026pack");
const FIXTURE_TIMEOUT_MS = 60_000;

// One parse of the 30 MB official catalogue for the whole file.
let profileCache: DiscProfile | null = null;

function officialProfile(): DiscProfile | null {
  profileCache ??=
    parseDiscProfile(readFileSync(join(BASE, "Profile/xml/DiscProfile.xml"), "utf-8")).data ?? null;
  return profileCache;
}

function officialSheet(name: string): DexpiDocument {
  const doc = parseDexpiDocument(
    readFileSync(join(BASE, `Blueprint/DISC_EXAMPLE-14/${name}`), "utf-8"),
    officialProfile(),
  ).data;
  if (!doc) {
    throw new Error(`${name}: parse failed`);
  }

  return doc;
}

describe("profile label overlays on NOA2 (off-page connector)", () => {
  it(
    "resolves ReferencedDrawingNumber/-Descriptor from the id-less child",
    () => {
      const doc = officialSheet("DISC_EXAMPLE-14_NOA2.xml");

      const connectorTexts = doc.scene.nodes
        .filter(
          (n): n is Extract<typeof n, { kind: "prim" }> =>
            n.kind === "prim" && n.prim.kind === "text" && n.objectId === "FlowOutPipeOffPageConnector1",
        )
        .map((n) => (n.prim.kind === "text" ? n.prim.value : ""));
      expect(connectorTexts.sort()).toEqual(["C01_NOA1", "TO TEST P&ID1"]);

      // The system's ND0040 label template stays suppressed — it has an
      // explicit authored label, which is authoritative (director's rule).
      const systemTexts = doc.scene.nodes.filter(
        (n) => n.kind === "prim" && n.prim.kind === "text" && n.objectId === "PipingNetworkSystem1",
      );
      expect(systemTexts.length).toBe(1);
    },
    FIXTURE_TIMEOUT_MS,
  );

  it(
    "keeps a 180°-rotated connector's text in sheet space, upright",
    () => {
      // Off-page connectors (and PropertyBreaks) are the exception to
      // "the label anchor follows the placement": their text blocks stay
      // unrotated at the template offsets. DISC_EXAMPLE-14-12 rotates its
      // FlowOut connectors 180°, and the official SVG still draws
      // "TO TEST P&ID3" at (788.875,236) / (788.875,410) with no rotation —
      // i.e. at the UNROTATED offset, not the 180°-rotated one (787.1,244).
      const doc = officialSheet("DISC_EXAMPLE-14-12.xml");
      const drawingRefs = doc.scene.nodes.flatMap((node) =>
        node.kind === "prim" && node.prim.kind === "text" && node.prim.value === "TO TEST P&ID3"
          ? [node.prim]
          : [],
      );
      expect(drawingRefs.length).toBe(2);
      for (const text of drawingRefs) {
        expect(text.position.x).toBeCloseTo(788.875);
        expect(text.rotation).toBe(0);
      }
      expect(drawingRefs.map((t) => Math.round(t.position.y)).sort((a, b) => a - b)).toEqual([236, 410]);
    },
    FIXTURE_TIMEOUT_MS,
  );
});
