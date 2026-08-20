import type { Point, ScenePrimitive } from "./types.ts";

// -----------------------------------------------------------------------------
// SVG path data for geometric primitives (shared by the PDF exporter).
// Coordinates are drawing mm (y-down), shifted by the given offset.
// -----------------------------------------------------------------------------

function num(value: number): string {
  return Number.parseFloat(value.toFixed(4)).toString();
}

function rotatedCorner(cx: number, cy: number, dx: number, dy: number, deg: number): Point {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
}

/** Point on a rotated ellipse at parameter angle `deg` (spec formula). */
export function ellipsePoint(center: Point, rx: number, ry: number, rotationDeg: number, deg: number): Point {
  const rad = (deg * Math.PI) / 180;
  return rotatedCorner(center.x, center.y, rx * Math.cos(rad), ry * Math.sin(rad), rotationDeg);
}

function polyData(points: readonly Point[], ox: number, oy: number, close: boolean): string | null {
  if (points.length < 2) {
    return null;
  }

  const parts = points.map((p, i) => `${i === 0 ? "M" : "L"} ${num(p.x + ox)} ${num(p.y + oy)}`);
  return parts.join(" ") + (close ? " Z" : "");
}

/**
 * SVG path data for a geometric primitive (null for text — exporters draw
 * text through their own text machinery). `ox/oy` shift into export space.
 */
export function primitiveToPathData(prim: ScenePrimitive, ox: number, oy: number): string | null {
  switch (prim.kind) {
    case "polyline":
      return polyData(prim.points, ox, oy, false);
    case "polygon":
      return polyData(prim.points, ox, oy, true);
    case "circle": {
      const { x, y } = prim.center;
      return `M ${num(x - prim.radius + ox)} ${num(y + oy)} A ${num(prim.radius)} ${num(prim.radius)} 0 1 1 ${num(x + prim.radius + ox)} ${num(y + oy)} A ${num(prim.radius)} ${num(prim.radius)} 0 1 1 ${num(x - prim.radius + ox)} ${num(y + oy)} Z`;
    }
    case "ellipse": {
      const a = ellipsePoint(prim.center, prim.rx, prim.ry, prim.rotation, 0);
      const b = ellipsePoint(prim.center, prim.rx, prim.ry, prim.rotation, 180);
      const arc = `${num(prim.rx)} ${num(prim.ry)} ${num(prim.rotation)} 1 1`;
      return `M ${num(a.x + ox)} ${num(a.y + oy)} A ${arc} ${num(b.x + ox)} ${num(b.y + oy)} A ${arc} ${num(a.x + ox)} ${num(a.y + oy)} Z`;
    }
    case "ellipseArc": {
      let sweep = prim.endAngle - prim.startAngle;
      if (sweep <= 0) {
        sweep += 360;
      }
      const start = ellipsePoint(prim.center, prim.rx, prim.ry, prim.rotation, prim.startAngle);
      const end = ellipsePoint(prim.center, prim.rx, prim.ry, prim.rotation, prim.endAngle);
      const largeArc = sweep > 180 ? 1 : 0;
      return `M ${num(start.x + ox)} ${num(start.y + oy)} A ${num(prim.rx)} ${num(prim.ry)} ${num(prim.rotation)} ${largeArc} 1 ${num(end.x + ox)} ${num(end.y + oy)}`;
    }
    case "rect": {
      const hw = prim.width / 2;
      const hh = prim.height / 2;
      const corners = [
        rotatedCorner(prim.center.x, prim.center.y, -hw, -hh, prim.rotation),
        rotatedCorner(prim.center.x, prim.center.y, hw, -hh, prim.rotation),
        rotatedCorner(prim.center.x, prim.center.y, hw, hh, prim.rotation),
        rotatedCorner(prim.center.x, prim.center.y, -hw, hh, prim.rotation),
      ];
      return polyData(corners, ox, oy, true);
    }
    case "text":
      return null;
  }
}
