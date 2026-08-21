import { describe, expect, it } from "vitest";
import { sceneToSvg } from "./exportSvg.ts";
import { layoutTextLines, TEXT_LINE_SPACING } from "./textLayout.ts";
import type { SceneGraph, TextPrim } from "./types.ts";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const SIZE_MM = 2;
const ADVANCE = SIZE_MM * TEXT_LINE_SPACING;

function textPrim(value: string, overrides: Partial<TextPrim> = {}): TextPrim {
  return {
    kind: "text",
    position: { x: 10, y: 10 },
    value,
    rotation: 0,
    size: SIZE_MM,
    color: { r: 0, g: 0, b: 0 },
    font: "Arial",
    hAlign: "Center",
    vAlign: "Center",
    ...overrides,
  };
}

function sceneWith(prim: TextPrim): SceneGraph {
  return {
    nodes: [{ kind: "prim", prim, objectId: null, role: "label" }],
    shapes: new Map(),
    bounds: { minX: 0, minY: 0, maxX: 50, maxY: 50 },
  };
}

// -----------------------------------------------------------------------------
// Line layout
// -----------------------------------------------------------------------------

describe("layoutTextLines", () => {
  it("keeps a single line at offset 0 regardless of alignment", () => {
    for (const vAlign of ["Top", "Center", "Bottom"] as const) {
      expect(layoutTextLines("SPEED CONTROL", SIZE_MM, vAlign)).toEqual([
        { value: "SPEED CONTROL", offsetY: 0 },
      ]);
    }
  });

  it("grows a Top-aligned block downward from the anchor", () => {
    const lines = layoutTextLines("A\nB", SIZE_MM, "Top");
    expect(lines.map((l) => l.offsetY)).toEqual([0, ADVANCE]);
  });

  it("grows a Bottom-aligned block upward, keeping the last line in place", () => {
    const lines = layoutTextLines("A\nB", SIZE_MM, "Bottom");
    expect(lines.map((l) => l.offsetY)).toEqual([-ADVANCE, 0]);
  });

  it("centers the block on the single-line baseline", () => {
    const lines = layoutTextLines("A\nB\nC", SIZE_MM, "Center");
    expect(lines.map((l) => l.offsetY)).toEqual([-ADVANCE, 0, ADVANCE]);
  });

  it("splits on CRLF as well and strips the break characters", () => {
    const lines = layoutTextLines("SPEED CONTROL\r\nLIQUID EXPORT PUMP A", SIZE_MM, "Center");
    expect(lines.map((l) => l.value)).toEqual(["SPEED CONTROL", "LIQUID EXPORT PUMP A"]);
  });
});

// -----------------------------------------------------------------------------
// SVG emission
// -----------------------------------------------------------------------------

describe("multiline text in SVG export", () => {
  it("keeps single-line text as one direct text element", () => {
    const svg = sceneToSvg(sceneWith(textPrim("PUMP A")));
    expect(svg).toContain(">PUMP A</text>");
    expect(svg).not.toContain("<tspan");
  });

  it("emits one tspan per line with block-centered offsets and no break character", () => {
    // size 2, advance 2.8, Center baseline 0.6 → lines at 0.6 ∓ 1.4.
    const svg = sceneToSvg(sceneWith(textPrim("SPEED CONTROL\nLIQUID EXPORT PUMP A")));
    expect(svg).toContain('<tspan x="0" y="-0.8">SPEED CONTROL</tspan>');
    expect(svg).toContain('<tspan x="0" y="2">LIQUID EXPORT PUMP A</tspan>');
    expect(svg).not.toContain("SPEED CONTROL\n");
  });

  it("keeps the whole block inside one rotated frame", () => {
    const svg = sceneToSvg(sceneWith(textPrim("A\nB", { rotation: 90 })));
    const textElements = svg.match(/<text /g) ?? [];
    expect(textElements).toHaveLength(1);
    expect(svg).toContain("rotate(90)");
  });

  it("anchors a Top-aligned block at the anchor and a Bottom-aligned block above it", () => {
    // size 2 → Top baseline 1.6, Bottom baseline 0; advance 2.8.
    const top = sceneToSvg(sceneWith(textPrim("A\nB", { vAlign: "Top" })));
    expect(top).toContain('<tspan x="0" y="1.6">A</tspan>');
    expect(top).toContain('<tspan x="0" y="4.4">B</tspan>');

    const bottom = sceneToSvg(sceneWith(textPrim("A\nB", { vAlign: "Bottom" })));
    expect(bottom).toContain('<tspan x="0" y="-2.8">A</tspan>');
    expect(bottom).toContain('<tspan x="0" y="0">B</tspan>');
  });
});
