import type { Point, SceneGraph, ScenePrimitive, UseTransform } from "./types.ts";

// -----------------------------------------------------------------------------
// Scene flattening
//
// Resolves ShapeUsage instancing into world-space primitives — for exporters
// that cannot nest transforms. Stroke widths stay authored (the non-scaling
// heuristic); non-uniform scales on rotated round shapes are approximated by
// their scaled semi-axes.
// -----------------------------------------------------------------------------

function transformPoint(t: UseTransform, p: Point): Point {
  const sx = (t.isMirrored ? -1 : 1) * t.scaleX;
  const x = p.x * sx;
  const y = p.y * t.scaleY;
  const rad = (t.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: t.position.x + x * cos - y * sin,
    y: t.position.y + x * sin + y * cos,
  };
}

/** One primitive through a use-transform into world space (non-scaling strokes). */
export function transformPrimitive(t: UseTransform, prim: ScenePrimitive): ScenePrimitive {
  const sx = Math.abs(t.scaleX) || 1;
  const sy = Math.abs(t.scaleY) || 1;
  const mirrorSign = t.isMirrored ? -1 : 1;
  switch (prim.kind) {
    case "polyline":
      return { ...prim, points: prim.points.map((p) => transformPoint(t, p)) };
    case "polygon":
      return { ...prim, points: prim.points.map((p) => transformPoint(t, p)) };
    case "circle":
      return sx === sy
        ? { ...prim, center: transformPoint(t, prim.center), radius: prim.radius * sx }
        : {
            kind: "ellipse",
            center: transformPoint(t, prim.center),
            rx: prim.radius * sx,
            ry: prim.radius * sy,
            rotation: t.rotation,
            stroke: prim.stroke,
            fill: prim.fill,
          };
    case "ellipse":
    case "ellipseArc":
      return {
        ...prim,
        center: transformPoint(t, prim.center),
        rx: prim.rx * sx,
        ry: prim.ry * sy,
        rotation: t.rotation + mirrorSign * prim.rotation,
      };
    case "rect":
      return {
        ...prim,
        center: transformPoint(t, prim.center),
        width: prim.width * sx,
        height: prim.height * sy,
        rotation: t.rotation + mirrorSign * prim.rotation,
      };
    case "text":
      return {
        ...prim,
        position: transformPoint(t, prim.position),
        size: prim.size * Math.max(sx, sy),
        rotation: t.rotation + mirrorSign * prim.rotation,
      };
  }
}

/** Every drawable in world coordinates, shape instancing resolved, in draw order. */
export function flattenScene(scene: SceneGraph): ScenePrimitive[] {
  const out: ScenePrimitive[] = [];
  for (const node of scene.nodes) {
    if (node.kind === "prim") {
      out.push(node.prim);
      continue;
    }

    const shape = scene.shapes.get(node.shapeId);
    if (!shape) {
      continue;
    }

    for (const prim of shape.primitives) {
      out.push(transformPrimitive(node.transform, prim));
    }
  }
  return out;
}
