import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDiscProfile } from "./discProfile.ts";
import { parseDexpiDocument } from "./parseDocument.ts";

// -----------------------------------------------------------------------------
// Off-page connector labels (real DISC data): the drawing reference lives on
// an ID-LESS PipeOffPageConnectorReferenceByNumber child of the connector —
// invisible to the id-keyed lookup index until ownAttribute learned to fold
// id-less component descendants into their owner. Regression for that fix.
// -----------------------------------------------------------------------------

describe("profile label overlays on NOA2 (off-page connector)", () => {
  it("resolves ReferencedDrawingNumber/-Descriptor from the id-less child", () => {
    const base = join(__dirname, "../../../refrences/discdexpi-2026pack");
    const profile = parseDiscProfile(readFileSync(join(base, "Profile/xml/DiscProfile.xml"), "utf-8")).data;
    const doc = parseDexpiDocument(
      readFileSync(join(base, "Blueprint/DISC_EXAMPLE-14/DISC_EXAMPLE-14_NOA2.xml"), "utf-8"),
      profile ?? null,
    ).data;
    if (!doc) {
      throw new Error("parse failed");
    }

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
  });
});
