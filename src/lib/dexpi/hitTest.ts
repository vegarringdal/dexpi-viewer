import type { Point, SceneGraph, SceneNode, ScenePrimitive, UseTransform } from "./types.ts";

// -----------------------------------------------------------------------------
// Geometry helpers
// -----------------------------------------------------------------------------

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function distToPolyline(p: Point, points: readonly Point[]): number {
  let min = Number.POSITIVE_INFINITY;
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (a && b) {
      min = Math.min(min, distToSegment(p, a, b));
    }
  }
  return min;
}

function isInsidePolygon(p: Point, points: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i];
    const b = points[j];
    if (!a || !b) {
      continue;
    }

    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/** Rotates `p` by `-deg` around `c` (i.e. into the primitive's local frame). */
function unrotate(p: Point, c: Point, deg: number): Point {
  if (deg === 0) {
    return { x: p.x - c.x, y: p.y - c.y };
  }

  const rad = (-deg * Math.PI) / 180;
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return { x: dx * Math.cos(rad) - dy * Math.sin(rad), y: dx * Math.sin(rad) + dy * Math.cos(rad) };
}

// -----------------------------------------------------------------------------
// Primitive tests
// -----------------------------------------------------------------------------

function hitsPrimitive(prim: ScenePrimitive, p: Point, tol: number): boolean {
  switch (prim.kind) {
    case "polyline":
      return distToPolyline(p, prim.points) <= tol + prim.stroke.width / 2;
    case "polygon": {
      if (prim.fill.style !== "Transparent" && isInsidePolygon(p, prim.points)) {
        return true;
      }

      const closed = [...prim.points, prim.points[0]].filter((q): q is Point => q !== undefined);
      return distToPolyline(p, closed) <= tol + prim.stroke.width / 2;
    }
    case "circle": {
      const d = Math.hypot(p.x - prim.center.x, p.y - prim.center.y);
      if (prim.fill.style !== "Transparent") {
        return d <= prim.radius + tol;
      }

      return Math.abs(d - prim.radius) <= tol + prim.stroke.width / 2;
    }
    case "ellipse":
    case "ellipseArc": {
      const local = unrotate(p, prim.center, prim.rotation);
      const rx = Math.max(prim.rx, 1e-9);
      const ry = Math.max(prim.ry, 1e-9);
      const v = Math.hypot(local.x / rx, local.y / ry);
      const ringTol = (tol + ("fill" in prim ? prim.stroke.width : prim.stroke.width) / 2) / Math.min(rx, ry);
      if (prim.kind === "ellipse" && prim.fill.style !== "Transparent") {
        return v <= 1 + ringTol;
      }

      return Math.abs(v - 1) <= ringTol;
    }
    case "rect": {
      const local = unrotate(p, prim.center, prim.rotation);
      const hw = prim.width / 2;
      const hh = prim.height / 2;
      const inside = Math.abs(local.x) <= hw + tol && Math.abs(local.y) <= hh + tol;
      if (!inside) {
        return false;
      }

      if (prim.fill.style !== "Transparent") {
        return true;
      }

      const nearEdge =
        Math.abs(Math.abs(local.x) - hw) <= tol + prim.stroke.width / 2 ||
        Math.abs(Math.abs(local.y) - hh) <= tol + prim.stroke.width / 2;
      return nearEdge;
    }
    case "text": {
      const w = Math.max(prim.value.length * prim.size * 0.6, prim.size);
      const local = unrotate(p, prim.position, prim.rotation);
      const x0 = prim.hAlign === "Center" ? -w / 2 : prim.hAlign === "Right" ? -w : 0;
      return local.x >= x0 - tol && local.x <= x0 + w + tol && local.y >= -prim.size && local.y <= prim.size;
    }
  }
}

// -----------------------------------------------------------------------------
// Scene test
// -----------------------------------------------------------------------------

function hitsUse(
  scene: SceneGraph,
  transform: UseTransform,
  shapeId: string,
  p: Point,
  tol: number,
): boolean {
  const shape = scene.shapes.get(shapeId);
  if (!shape) {
    return false;
  }

  const sx = (transform.isMirrored ? -1 : 1) * (transform.scaleX || 1);
  const sy = transform.scaleY || 1;
  const local = unrotate(p, transform.position, transform.rotation);
  const lp = { x: local.x / sx, y: local.y / sy };
  const localTol = tol / Math.max(Math.abs(sx), Math.abs(sy), 1e-9);
  return shape.primitives.some((prim) => hitsPrimitive(prim, lp, localTol));
}

/**
 * Topmost scene node whose geometry contains the point (drawing mm),
 * within `toleranceMm`. Later nodes draw on top, so the array is scanned
 * back-to-front. Returns the node's represented object id (may be null).
 */
export function hitTestScene(scene: SceneGraph, point: Point, toleranceMm: number): SceneNode | null {
  for (let i = scene.nodes.length - 1; i >= 0; i--) {
    const node = scene.nodes[i];
    if (!node) {
      continue;
    }

    if (node.kind === "prim") {
      if (hitsPrimitive(node.prim, point, toleranceMm)) {
        return node;
      }
      continue;
    }

    if (hitsUse(scene, node.transform, node.shapeId, point, toleranceMm)) {
      return node;
    }
  }
  return null;
}
