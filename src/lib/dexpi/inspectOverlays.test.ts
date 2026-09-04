import { describe, expect, it } from "vitest";
import {
  buildNodeMarkerPrims,
  fadeToPaper,
  hexToRgb,
  NODE_MARKER_BASE_MM,
  type NodeMarkerStyle,
  recolorTextNodes,
} from "./inspectOverlays.ts";
import type { NodePositionMarker, RgbColor, SceneNode } from "./types.ts";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const RED: RgbColor = { r: 255, g: 0, b: 0 };

const STYLE: NodeMarkerStyle = { color: RED, scale: 1, widthMm: 0.15 };

function marker(source: "file" | "profile", x = 0, y = 0): NodePositionMarker {
  return { source, kind: source === "file" ? "PipingNodePosition" : "Piping", point: { x, y } };
}

// -----------------------------------------------------------------------------
// Node markers
// -----------------------------------------------------------------------------

describe("buildNodeMarkerPrims", () => {
  it("draws a file node position as an unfilled circle at the exact point", () => {
    const [prim] = buildNodeMarkerPrims([marker("file", 10, 20)], () => STYLE);

    expect(prim?.kind).toBe("circle");
    if (prim?.kind !== "circle") {
      throw new Error("expected a circle");
    }

    expect(prim.center).toEqual({ x: 10, y: 20 });
    expect(prim.radius).toBeCloseTo(NODE_MARKER_BASE_MM / 2);
    expect(prim.fill.style).toBe("Transparent");
    expect(prim.stroke.color).toEqual(RED);
    expect(prim.stroke.width).toBe(0.15);
  });

  it("draws a profile attachment point as an unfilled triangle inscribed in that circle", () => {
    const [prim] = buildNodeMarkerPrims([marker("profile", 10, 20)], () => STYLE);

    expect(prim?.kind).toBe("polygon");
    if (prim?.kind !== "polygon") {
      throw new Error("expected a polygon");
    }

    expect(prim.fill.style).toBe("Transparent");
    expect(prim.points).toHaveLength(3);
    // Every vertex sits on the circle the file marker would draw, so a
    // coinciding pair reads as a triangle inside its circle.
    const radius = NODE_MARKER_BASE_MM / 2;
    for (const point of prim.points) {
      expect(Math.hypot(point.x - 10, point.y - 20)).toBeCloseTo(radius);
    }
    // Apex up in the y-down drawing space.
    expect(prim.points[0]).toEqual({ x: 10, y: 20 - radius });
  });

  it("scales the marker without moving its centre", () => {
    const [prim] = buildNodeMarkerPrims([marker("file", 5, 5)], () => ({ ...STYLE, scale: 3 }));

    if (prim?.kind !== "circle") {
      throw new Error("expected a circle");
    }

    expect(prim.center).toEqual({ x: 5, y: 5 });
    expect(prim.radius).toBeCloseTo((NODE_MARKER_BASE_MM * 3) / 2);
  });

  it("skips kinds the user switched off", () => {
    const markers = [marker("file"), marker("profile")];
    const prims = buildNodeMarkerPrims(markers, (m) => (m.source === "file" ? STYLE : null));

    expect(prims).toHaveLength(1);
    expect(prims[0]?.kind).toBe("circle");
  });
});

// -----------------------------------------------------------------------------
// Color helpers
// -----------------------------------------------------------------------------

describe("fadeToPaper", () => {
  it("keeps the color at full opacity and reaches white at zero", () => {
    expect(fadeToPaper(RED, 100)).toEqual(RED);
    expect(fadeToPaper(RED, 0)).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("blends halfway at 50%", () => {
    expect(fadeToPaper({ r: 0, g: 0, b: 0 }, 50)).toEqual({ r: 128, g: 128, b: 128 });
  });
});

describe("hexToRgb", () => {
  it("parses with and without the hash", () => {
    expect(hexToRgb("#1f8fe0")).toEqual({ r: 31, g: 143, b: 224 });
    expect(hexToRgb("1f8fe0")).toEqual({ r: 31, g: 143, b: 224 });
  });

  it("falls back to grey rather than throwing on junk", () => {
    expect(hexToRgb("nonsense")).toEqual({ r: 128, g: 128, b: 128 });
  });
});

describe("recolorTextNodes", () => {
  it("recolors text nodes and drops anything that is not text", () => {
    const text: SceneNode = {
      kind: "prim",
      objectId: "A",
      role: "label",
      prim: {
        kind: "text",
        position: { x: 0, y: 0 },
        value: "TT",
        rotation: 0,
        size: 3.3,
        color: { r: 0, g: 0, b: 0 },
        font: "Arial",
        hAlign: "Center",
        vAlign: "Center",
      },
    };
    const usage: SceneNode = {
      kind: "use",
      objectId: "B",
      role: "symbol",
      shapeId: "valve",
      transform: { position: { x: 0, y: 0 }, rotation: 0, scaleX: 1, scaleY: 1, isMirrored: false },
    };

    const out = recolorTextNodes([text, usage], RED);

    expect(out).toHaveLength(1);
    const prim = out[0]?.kind === "prim" ? out[0].prim : undefined;
    expect(prim?.kind === "text" ? prim.color : null).toEqual(RED);
  });
});
