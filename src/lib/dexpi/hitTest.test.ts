import { describe, expect, it } from "vitest";
import { hitTestScene } from "./hitTest.ts";
import type { SceneGraph, ShapeDef, Stroke } from "./types.ts";

const STROKE: Stroke = { color: { r: 0, g: 0, b: 0 }, width: 0.5, dash: [] };

const SHAPE: ShapeDef = {
  id: "S1",
  name: "S1",
  primitives: [
    {
      kind: "polyline",
      points: [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ],
      stroke: STROKE,
    },
  ],
};

const SCENE: SceneGraph = {
  nodes: [
    {
      kind: "prim",
      prim: {
        kind: "polyline",
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
        stroke: STROKE,
      },
      objectId: "line",
      role: "connector",
    },
    {
      kind: "prim",
      prim: {
        kind: "circle",
        center: { x: 20, y: 0 },
        radius: 2,
        stroke: STROKE,
        fill: { style: "Transparent", color: { r: 0, g: 0, b: 0 } },
      },
      objectId: "ring",
      role: "symbol",
    },
    {
      kind: "use",
      shapeId: "S1",
      transform: { position: { x: 30, y: 0 }, rotation: 90, scaleX: 2, scaleY: 2, isMirrored: false },
      objectId: "used",
      role: "symbol",
    },
  ],
  shapes: new Map([["S1", SHAPE]]),
  bounds: { minX: 0, minY: 0, maxX: 40, maxY: 10 },
};

describe("hitTestScene", () => {
  it("hits a polyline within tolerance and misses outside it", () => {
    expect(hitTestScene(SCENE, { x: 5, y: 0.5 }, 0.5)?.objectId).toBe("line");
    expect(hitTestScene(SCENE, { x: 5, y: 3 }, 0.5)).toBeNull();
  });

  it("hits only the ring of a transparent circle", () => {
    expect(hitTestScene(SCENE, { x: 22, y: 0 }, 0.5)?.objectId).toBe("ring");
    expect(hitTestScene(SCENE, { x: 20, y: 0 }, 0.5)).toBeNull();
  });

  it("hits a shape usage through its rotated, scaled transform", () => {
    // Local segment (0,0)→(2,0), scaled ×2 then rotated 90° CCW at (30,0):
    // world geometry runs (30,0)→(30,4).
    expect(hitTestScene(SCENE, { x: 30, y: 3 }, 0.5)?.objectId).toBe("used");
    expect(hitTestScene(SCENE, { x: 33, y: 0 }, 0.5)).toBeNull();
  });
});
