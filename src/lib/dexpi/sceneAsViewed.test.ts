import { describe, expect, it } from "vitest";
import { NO_OVERLAYS, sceneAsViewed, type ViewAppearance } from "./sceneAsViewed.ts";
import type { RgbColor, SceneGraph, SceneNode, ScenePrimitive, ShapeDef, Stroke } from "./types.ts";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const BLACK: RgbColor = { r: 0, g: 0, b: 0 };
const WHITE: RgbColor = { r: 255, g: 255, b: 255 };
const TINT: RgbColor = { r: 200, g: 40, b: 60 };

/** The light palette's ink, which monochrome maps dark colors onto. */
const INK: RgbColor = { r: 30, g: 41, b: 59 };

const STROKE: Stroke = { color: BLACK, width: 0.35, dash: [] };

const VALVE_SHAPE: ShapeDef = {
  id: "valve",
  name: "valve",
  primitives: [{ kind: "polyline", points: [], stroke: STROKE }],
};

function line(objectId: string | null): SceneNode {
  return {
    kind: "prim",
    objectId,
    role: "symbol",
    prim: {
      kind: "polyline",
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      stroke: STROKE,
    },
  };
}

function filledCircle(objectId: string | null, fillColor: RgbColor): SceneNode {
  return {
    kind: "prim",
    objectId,
    role: "symbol",
    prim: {
      kind: "circle",
      center: { x: 0, y: 0 },
      radius: 1,
      stroke: STROKE,
      fill: { style: "Solid", color: fillColor },
    },
  };
}

function usage(objectId: string | null): SceneNode {
  return {
    kind: "use",
    objectId,
    role: "symbol",
    shapeId: "valve",
    transform: { position: { x: 0, y: 0 }, rotation: 0, scaleX: 1, scaleY: 1, isMirrored: false },
  };
}

function sceneWith(nodes: readonly SceneNode[]): SceneGraph {
  return {
    nodes,
    shapes: new Map([[VALVE_SHAPE.id, VALVE_SHAPE]]),
    bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
    labelTemplateNodes: [],
    nodePositionMarkers: [],
    heatTracedIds: new Set(),
    heatTracingSafetyCriticalIds: new Set(),
  };
}

function appearance(overrides: Partial<ViewAppearance> = {}): ViewAppearance {
  return {
    monochrome: false,
    tints: new Map(),
    dimDrawing: false,
    overlays: NO_OVERLAYS,
    ...overrides,
  };
}

function strokeColorOf(node: SceneNode | undefined): RgbColor {
  const prim = node?.kind === "prim" ? node.prim : undefined;
  if (!prim || prim.kind === "text" || !("stroke" in prim)) {
    throw new Error("expected a stroked primitive");
  }

  return prim.stroke.color;
}

function fillColorOf(node: SceneNode | undefined): RgbColor {
  const prim: ScenePrimitive | undefined = node?.kind === "prim" ? node.prim : undefined;
  if (!prim || !("fill" in prim)) {
    throw new Error("expected a filled primitive");
  }

  return prim.fill.color;
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe("sceneAsViewed", () => {
  it("returns the scene untouched when the view asks for nothing", () => {
    const scene = sceneWith([line("A")]);

    expect(sceneAsViewed(scene, appearance())).toBe(scene);
  });

  it("replaces a tinted object's stroke with the overlay color", () => {
    const scene = sceneWith([line("A")]);

    const out = sceneAsViewed(scene, appearance({ tints: new Map([["A", TINT]]) }));

    expect(strokeColorOf(out.nodes[0])).toEqual(TINT);
  });

  it("maps dark ink to the print ink and keeps masking fills white in B/W", () => {
    const scene = sceneWith([filledCircle("A", WHITE)]);

    const out = sceneAsViewed(scene, appearance({ monochrome: true }));

    expect(strokeColorOf(out.nodes[0])).toEqual(INK);
    expect(fillColorOf(out.nodes[0])).toEqual(WHITE);
  });

  it("fades the drawing but keeps a tinted object at full strength", () => {
    const scene = sceneWith([line("A"), line("B")]);

    const out = sceneAsViewed(scene, appearance({ tints: new Map([["A", TINT]]), dimDrawing: true }));

    expect(strokeColorOf(out.nodes[0])).toEqual(TINT);
    // 80% white over black, matching the canvas's dim veil.
    expect(strokeColorOf(out.nodes[1])).toEqual({ r: 204, g: 204, b: 204 });
  });

  it("never dims a front overlay — the veil sits below every overlay", () => {
    const scene = sceneWith([line("A")]);
    const front = line("overlay");

    const out = sceneAsViewed(
      scene,
      appearance({ dimDrawing: true, overlays: { behind: [], front: [front] } }),
    );

    expect(out.nodes[1]).toBe(front);
    expect(strokeColorOf(out.nodes[0])).toEqual({ r: 204, g: 204, b: 204 });
  });

  it("DOES dim a behind overlay, because the canvas veil covers it too", () => {
    const scene = sceneWith([line("A")]);
    const behind = line("overlay");

    const out = sceneAsViewed(
      scene,
      appearance({ dimDrawing: true, overlays: { behind: [behind], front: [] } }),
    );

    expect(strokeColorOf(out.nodes[0])).toEqual({ r: 204, g: 204, b: 204 });
  });

  it("appends overlay nodes without recoloring them", () => {
    const scene = sceneWith([line("A")]);
    const front = line("overlay-front");
    const behind = line("overlay-behind");

    const out = sceneAsViewed(
      scene,
      appearance({ monochrome: true, overlays: { behind: [behind], front: [front] } }),
    );

    expect(out.nodes[0]).toBe(behind);
    expect(out.nodes[2]).toBe(front);
    // The drawing between them still took the B/W treatment.
    expect(strokeColorOf(out.nodes[1])).toEqual(INK);
  });

  it("appends overlays even when no recoloring is needed at all", () => {
    const scene = sceneWith([line("A")]);
    const front = line("overlay");

    const out = sceneAsViewed(scene, appearance({ overlays: { behind: [], front: [front] } }));

    expect(out.nodes).toHaveLength(2);
    expect(out.nodes[1]).toBe(front);
  });

  it("leaves a tinted object's fill showing through at the overlay's alpha", () => {
    const scene = sceneWith([filledCircle("A", WHITE)]);

    const out = sceneAsViewed(scene, appearance({ tints: new Map([["A", TINT]]) }));

    // 35% tint over white, matching makeFillPaint in the canvas renderer.
    expect(fillColorOf(out.nodes[0])).toEqual({ r: 236, g: 180, b: 187 });
  });

  it("clones a shared shape once per distinct treatment, not per placement", () => {
    const scene = sceneWith([usage("A"), usage("B"), usage("C")]);

    const out = sceneAsViewed(
      scene,
      appearance({
        tints: new Map([
          ["A", TINT],
          ["B", TINT],
        ]),
        dimDrawing: true,
      }),
    );

    const ids = out.nodes.map((node) => (node.kind === "use" ? node.shapeId : ""));
    expect(ids[0]).toBe(ids[1]);
    expect(ids[2]).not.toBe(ids[0]);
    expect(out.shapes.size).toBe(2);
    expect(
      out.shapes.get(ids[0] ?? "")?.primitives.map((p) => ("stroke" in p ? p.stroke.color : null)),
    ).toEqual([TINT]);
  });
});
