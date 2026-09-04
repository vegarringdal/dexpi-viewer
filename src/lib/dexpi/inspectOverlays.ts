import type {
  Fill,
  NodePositionMarker,
  Point,
  RgbColor,
  SceneNode,
  ScenePrimitive,
  Stroke,
} from "./types.ts";

// -----------------------------------------------------------------------------
// Inspection overlay geometry
//
// The Node Positions and Label Inspect overlays, as ordinary scene primitives
// in drawing mm. Building them here rather than in the renderer means the
// canvas and the "as viewed" exporters draw the SAME geometry from the same
// numbers — an overlay cannot look different on paper than on screen.
// -----------------------------------------------------------------------------

/**
 * Marker outline size in drawing mm at scale 1. Symbol placements in the DISC
 * fixtures have a median bounding size of 12 mm and the director picked a
 * marker about a tenth of that.
 */
export const NODE_MARKER_BASE_MM = 1.2;

export type NodeMarkerStyle = Readonly<{
  color: RgbColor;
  scale: number;
  widthMm: number;
}>;

const NO_FILL: Fill = { style: "Transparent", color: { r: 0, g: 0, b: 0 } };

/** Half the width of an equilateral triangle inscribed in the unit circle. */
const SIN_60 = Math.sqrt(3) / 2;

const WHITE: RgbColor = { r: 255, g: 255, b: 255 };

/** "#rrggbb" → channels; an unparsable value falls back to mid grey. */
export function hexToRgb(hex: string): RgbColor {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match?.[1]) {
    return { r: 128, g: 128, b: 128 };
  }

  const value = Number.parseInt(match[1], 16);
  return { r: (value >> 16) & 0xff, g: (value >> 8) & 0xff, b: value & 0xff };
}

// -----------------------------------------------------------------------------
// Node-position markers
// -----------------------------------------------------------------------------

/** Apex up, inscribed in the circle of the same radius (y-down drawing space). */
function trianglePoints(center: Point, radius: number): readonly Point[] {
  return [
    { x: center.x, y: center.y - radius },
    { x: center.x - radius * SIN_60, y: center.y + radius / 2 },
    { x: center.x + radius * SIN_60, y: center.y + radius / 2 },
  ];
}

/**
 * A circle per file node position, a triangle per profile attachment point.
 * Both are OUTLINES sharing one circumscribed radius, so a coinciding pair
 * reads as a triangle inside its circle instead of one hiding the other —
 * the whole point of the overlay is comparing the two.
 * `styleFor` returns null for kinds the user has switched off.
 */
export function buildNodeMarkerPrims(
  markers: readonly NodePositionMarker[],
  styleFor: (marker: NodePositionMarker) => NodeMarkerStyle | null,
): readonly ScenePrimitive[] {
  const prims: ScenePrimitive[] = [];
  for (const marker of markers) {
    const style = styleFor(marker);
    if (!style) {
      continue;
    }

    const radius = (NODE_MARKER_BASE_MM * style.scale) / 2;
    const stroke: Stroke = { color: style.color, width: style.widthMm, dash: [] };
    prims.push(
      marker.source === "file"
        ? { kind: "circle", center: marker.point, radius, stroke, fill: NO_FILL }
        : { kind: "polygon", points: trianglePoints(marker.point, radius), stroke, fill: NO_FILL },
    );
  }
  return prims;
}

// -----------------------------------------------------------------------------
// Label Inspect
// -----------------------------------------------------------------------------

/**
 * An opacity flattened against white paper. The canvas draws the overlay with
 * real alpha; an export has no compositing stage, so the same result is
 * computed arithmetically — the approach sceneAsViewed already takes for the
 * highlight passes.
 */
export function fadeToPaper(color: RgbColor, opacityPercent: number): RgbColor {
  const alpha = Math.min(100, Math.max(0, opacityPercent)) / 100;
  return {
    r: Math.round(WHITE.r + (color.r - WHITE.r) * alpha),
    g: Math.round(WHITE.g + (color.g - WHITE.g) * alpha),
    b: Math.round(WHITE.b + (color.b - WHITE.b) * alpha),
  };
}

/** The label-template placements in one flat color, for the exporters. */
export function recolorTextNodes(nodes: readonly SceneNode[], color: RgbColor): readonly SceneNode[] {
  const out: SceneNode[] = [];
  for (const node of nodes) {
    if (node.kind === "prim" && node.prim.kind === "text") {
      out.push({ ...node, prim: { ...node.prim, color } });
    }
  }
  return out;
}
