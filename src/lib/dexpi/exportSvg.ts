import { baselineOffsetMm, layoutTextLines } from "./textLayout.ts";
import type { RgbColor, SceneGraph, ScenePrimitive, Stroke, UseNode } from "./types.ts";

// -----------------------------------------------------------------------------
// SVG export
//
// Emits the scene graph using the spec's own SVG mapping (round caps/joins,
// y-down coordinates map 1:1, arcs per the SVG arc notes the spec cites).
// Shape usages are inlined with their transform; stroke widths inside scaled
// usages divide by the symbol scale (non-scaling-stroke heuristic).
// -----------------------------------------------------------------------------

const MARGIN_MM = 5;

function esc(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function num(value: number): string {
  return Number.parseFloat(value.toFixed(4)).toString();
}

function color(c: RgbColor): string {
  return `rgb(${c.r},${c.g},${c.b})`;
}

function strokeAttrs(stroke: Stroke, widthDivisor: number): string {
  const width = Math.max(stroke.width, 0.01) / widthDivisor;
  const dash = stroke.dash.length > 0 ? ` stroke-dasharray="${stroke.dash.map(num).join(" ")}"` : "";
  const dashOffset = stroke.dashOffset ? ` stroke-dashoffset="${num(stroke.dashOffset)}"` : "";
  const cap = stroke.rounding === "Butt" ? "butt" : "round";
  const join = stroke.rounding === "Butt" ? "miter" : "round";
  return `stroke="${color(stroke.color)}" stroke-width="${num(width)}" stroke-linecap="${cap}" stroke-linejoin="${join}"${dash}${dashOffset}`;
}

let hatchCounter = 0;

/**
 * Fill attribute, optionally preceded by an inline hatch <pattern> per the
 * spec's example SVGs (45° stroke-colored lines). Returns [defs, attr].
 */
function fillParts(prim: ScenePrimitive): [string, string] {
  if (!("fill" in prim)) {
    return ["", 'fill="none"'];
  }

  if (prim.fill.style === "Solid") {
    return ["", `fill="${color(prim.fill.color)}"`];
  }

  if (prim.fill.style === "Hatch") {
    hatchCounter += 1;
    const id = `hatch-${hatchCounter}`;
    const spacing = Math.min(Math.max(prim.stroke.width * 10, 1), 20);
    const defs =
      `<defs><pattern id="${id}" width="${num(spacing)}" height="${num(spacing)}" patternUnits="userSpaceOnUse" patternTransform="rotate(315)">` +
      `<polyline points="0,0 ${num(spacing)},0" stroke="${color(prim.fill.color)}" stroke-width="${num(Math.max(prim.stroke.width, 0.01))}"/></pattern></defs>`;
    return [defs, `fill="url(#${id})"`];
  }

  return ["", 'fill="none"'];
}

function points(list: readonly { x: number; y: number }[]): string {
  return list.map((p) => `${num(p.x)},${num(p.y)}`).join(" ");
}

// -----------------------------------------------------------------------------
// Primitive emission
// -----------------------------------------------------------------------------

function textAnchor(hAlign: "Left" | "Center" | "Right"): string {
  return hAlign === "Left" ? "start" : hAlign === "Right" ? "end" : "middle";
}

function emitPrimitive(prim: ScenePrimitive, widthDivisor: number): string {
  switch (prim.kind) {
    case "polyline":
      return `<polyline points="${points(prim.points)}" fill="none" ${strokeAttrs(prim.stroke, widthDivisor)}/>`;
    case "polygon": {
      const [defs, fill] = fillParts(prim);
      return `${defs}<polygon points="${points(prim.points)}" ${fill} ${strokeAttrs(prim.stroke, widthDivisor)}/>`;
    }
    case "circle": {
      const [defs, fill] = fillParts(prim);
      return `${defs}<circle cx="${num(prim.center.x)}" cy="${num(prim.center.y)}" r="${num(prim.radius)}" ${fill} ${strokeAttrs(prim.stroke, widthDivisor)}/>`;
    }
    case "ellipse": {
      const [defs, fill] = fillParts(prim);
      return `${defs}<ellipse transform="translate(${num(prim.center.x)},${num(prim.center.y)}) rotate(${num(prim.rotation)})" rx="${num(prim.rx)}" ry="${num(prim.ry)}" ${fill} ${strokeAttrs(prim.stroke, widthDivisor)}/>`;
    }
    case "ellipseArc": {
      // Endpoints per the spec's formulas; the arc runs from start to end in
      // positive (clockwise, y-down) direction → SVG sweep-flag = 1.
      let sweep = prim.endAngle - prim.startAngle;
      if (sweep <= 0) {
        sweep += 360;
      }
      const rad = (deg: number): number => (deg * Math.PI) / 180;
      const point = (deg: number): { x: number; y: number } => {
        const px = prim.rx * Math.cos(rad(deg));
        const py = prim.ry * Math.sin(rad(deg));
        const rot = rad(prim.rotation);
        return {
          x: prim.center.x + px * Math.cos(rot) - py * Math.sin(rot),
          y: prim.center.y + px * Math.sin(rot) + py * Math.cos(rot),
        };
      };
      const start = point(prim.startAngle);
      const end = point(prim.endAngle);
      const largeArc = sweep > 180 ? 1 : 0;
      return `<path d="M ${num(start.x)} ${num(start.y)} A ${num(prim.rx)} ${num(prim.ry)} ${num(prim.rotation)} ${largeArc} 1 ${num(end.x)} ${num(end.y)}" fill="none" ${strokeAttrs(prim.stroke, widthDivisor)}/>`;
    }
    case "rect": {
      const [defs, fill] = fillParts(prim);
      return `${defs}<rect transform="translate(${num(prim.center.x)},${num(prim.center.y)}) rotate(${num(prim.rotation)})" x="${num(-prim.width / 2)}" y="${num(-prim.height / 2)}" width="${num(prim.width)}" height="${num(prim.height)}" ${fill} ${strokeAttrs(prim.stroke, widthDivisor)}/>`;
    }
    case "text": {
      const dy = baselineOffsetMm(prim.size, prim.vAlign);
      const rotate = prim.rotation !== 0 ? ` rotate(${num(prim.rotation)})` : "";
      const attrs = `transform="translate(${num(prim.position.x)},${num(prim.position.y)})${rotate}" font-family="${esc(prim.font)}, Carlito, 'Liberation Sans', sans-serif" font-size="${num(prim.size)}" text-anchor="${textAnchor(prim.hAlign)}" fill="${color(prim.color)}"`;
      const lines = layoutTextLines(prim.value, prim.size, prim.vAlign);
      if (lines.length === 1) {
        return `<text ${attrs} y="${num(dy)}">${esc(prim.value)}</text>`;
      }

      // Multiline: one tspan per line, all inside the rotated frame so the
      // block rotates as a unit; x="0" re-anchors each line for text-anchor.
      const spans = lines
        .filter((line) => line.value.length > 0)
        .map((line) => `<tspan x="0" y="${num(dy + line.offsetY)}">${esc(line.value)}</tspan>`)
        .join("");
      return `<text ${attrs}>${spans}</text>`;
    }
  }
}

function emitUse(scene: SceneGraph, node: UseNode): string {
  const shape = scene.shapes.get(node.shapeId);
  if (!shape) {
    return "";
  }

  const t = node.transform;
  const sx = t.isMirrored ? -t.scaleX : t.scaleX;
  const divisor = Math.max(Math.abs(t.scaleX) || 1, Math.abs(t.scaleY) || 1);
  const transform = `translate(${num(t.position.x)},${num(t.position.y)}) rotate(${num(t.rotation)}) scale(${num(sx)},${num(t.scaleY)})`;
  const body = shape.primitives.map((p) => emitPrimitive(p, divisor)).join("\n    ");
  return `<g transform="${transform}">\n    ${body}\n  </g>`;
}

// -----------------------------------------------------------------------------
// Entry point
// -----------------------------------------------------------------------------

/** Renders the scene graph to a standalone SVG document (drawing mm units). */
export function sceneToSvg(scene: SceneGraph): string {
  const b = scene.bounds;
  const x = b.minX - MARGIN_MM;
  const y = b.minY - MARGIN_MM;
  const width = b.maxX - b.minX + 2 * MARGIN_MM;
  const height = b.maxY - b.minY + 2 * MARGIN_MM;

  const body = scene.nodes
    .map((node) => (node.kind === "use" ? emitUse(scene, node) : emitPrimitive(node.prim, 1)))
    .filter((s) => s.length > 0)
    .join("\n  ");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${num(width)}mm" height="${num(height)}mm" viewBox="${num(x)} ${num(y)} ${num(width)} ${num(height)}">`,
    `  <rect x="${num(x)}" y="${num(y)}" width="${num(width)}" height="${num(height)}" fill="white"/>`,
    `  ${body}`,
    "</svg>",
    "",
  ].join("\n");
}
