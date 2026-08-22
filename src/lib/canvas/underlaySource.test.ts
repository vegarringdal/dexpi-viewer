import { describe, expect, it } from "vitest";
import { hexToColor4f, underlayDestRect } from "./underlaySource.ts";

const BOUNDS = { minX: 10, minY: 20, maxX: 851, maxY: 614 };

describe("underlayDestRect", () => {
  it("stretches to the diagram extent by default", () => {
    expect(underlayDestRect(BOUNDS, { offsetXMm: 0, offsetYMm: 0, scalePercent: 100 })).toEqual({
      left: 10,
      top: 20,
      right: 851,
      bottom: 614,
    });
  });

  it("scales about the extent's top-left and applies mm offsets", () => {
    const rect = underlayDestRect(BOUNDS, { offsetXMm: 5, offsetYMm: -2, scalePercent: 50 });
    expect(rect.left).toBe(15);
    expect(rect.top).toBe(18);
    expect(rect.right).toBeCloseTo(15 + (851 - 10) / 2);
    expect(rect.bottom).toBeCloseTo(18 + (614 - 20) / 2);
  });
});

describe("hexToColor4f", () => {
  it("parses #rrggbb into 0..1 components and falls back to red on junk", () => {
    expect(hexToColor4f("#ff0000")).toEqual([1, 0, 0, 1]);
    expect(hexToColor4f("00ff00")).toEqual([0, 1, 0, 1]);
    expect(hexToColor4f("nonsense")).toEqual([0.9, 0.1, 0.1, 1]);
  });
});
