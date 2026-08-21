import type { ProfileLineStroke } from "./discProfile.ts";
import type { Bounds, Point, RgbColor, SceneNode, Stroke, StrokeRounding } from "./types.ts";
import { componentObjects, dataValue, getData, refLocalName } from "./xml.ts";

// -----------------------------------------------------------------------------
// Heat tracing (main-file data, director's rendering rules)
//
// `HeatTracingType` on a piping object is semantic metadata in the MAIN
// DEXPI model (not DiscProfile.xml). Classified runs get a dashed overlay
// drawn parallel to the normal pipe geometry, laterally offset per the
// DISC Profile LineStroke.LateralOffset semantics: mm perpendicular to
// the drawing direction, positive = right, negative = left. When the
// profile defines a heat-trace LineStroke its style wins; otherwise the
// documented viewer defaults below apply, since the file carries no
// explicit heat-trace geometry. HeatTracingBreak objects are logical
// property breaks — associated data, never drawn as components.
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// Style
// -----------------------------------------------------------------------------

/** Viewer display defaults for the overlay when no profile stroke exists. */
const HEAT_TRACE_DASH_MM: readonly number[] = [2.4, 1.6];
const HEAT_TRACE_COLOR: RgbColor = { r: 217, g: 108, b: 24 };

/**
 * Fallback lateral offset in mm (positive = right of the drawing
 * direction). The model has no explicit heat-trace geometry and files seen
 * so far carry no Profile/LineStroke.LateralOffset, so this display-rule
 * default keeps the overlay visibly beside the pipe instead of on top of
 * it. Deliberately documented and overridable rather than silently zero.
 */
export const DEFAULT_HEAT_TRACE_LATERAL_OFFSET_MM = 1.5;

/** Inline-symbol overlays have no pipe width to inherit; this is the default. */
const DEFAULT_SYMBOL_TRACE_WIDTH_MM = 0.35;

export type HeatTraceStyle = Readonly<{
  color: RgbColor;
  /** Dash pattern in mm; empty = solid. */
  dash: readonly number[];
  /** Perpendicular displacement in mm; positive = right of drawing direction. */
  lateralOffsetMm: number;
  /** null = inherit the traced pipe's stroke width. */
  widthMm: number | null;
  dashOffsetMm: number;
  rounding: StrokeRounding | null;
}>;

export const DEFAULT_HEAT_TRACE_STYLE: HeatTraceStyle = {
  color: HEAT_TRACE_COLOR,
  dash: HEAT_TRACE_DASH_MM,
  lateralOffsetMm: DEFAULT_HEAT_TRACE_LATERAL_OFFSET_MM,
  widthMm: null,
  dashOffsetMm: 0,
  rounding: null,
};

/**
 * The style to draw heat-trace overlays with: the profile's heat-trace
 * LineStroke when one exists, else the viewer defaults. Profile values are
 * authoritative where present; missing color/width fall back per field.
 */
export function resolveHeatTraceStyle(profileStroke: ProfileLineStroke | null): HeatTraceStyle {
  if (!profileStroke) {
    return DEFAULT_HEAT_TRACE_STYLE;
  }

  return {
    color: profileStroke.color ?? HEAT_TRACE_COLOR,
    dash: profileStroke.dashArray,
    lateralOffsetMm: profileStroke.lateralOffsetMm,
    widthMm: profileStroke.widthMm,
    dashOffsetMm: profileStroke.dashOffsetMm,
    rounding: profileStroke.rounding,
  };
}

// -----------------------------------------------------------------------------
// Classification
// -----------------------------------------------------------------------------

/**
 * Whether the class can legitimately carry HeatTracingType. The 2.0 model
 * defines it on PipingNetworkSystem/Segment, PipingComponent and
 * OfflineMeasuringElement only — physical pipes and impulse lines. Signal
 * functions are logical and never heat-traced, so data placed there is a
 * modelling error and is ignored. Plant/Piping.* covers the piping
 * subclasses; DiscProfile/* custom classes (profile-extended piping
 * components, PIF extensions) are trusted, matching the prior-art viewer.
 */
function isHeatTraceEligible(type: string): boolean {
  if (type.startsWith("Plant/Piping.") || type.startsWith("DiscProfile/")) {
    return true;
  }

  const local = type.split(/[./]/).pop() ?? type;
  return (
    local === "OfflineMeasuringElement" || local === "ProcessInstrumentationFunction" || local === "Nozzle"
  );
}

/**
 * Ids of every object classified as heat-traced (`HeatTracingType` present
 * on an eligible class, and not a "none" literal — "None"/
 * "NoHeatTracingSystem"), plus their nested component objects — a
 * classification on a segment covers the pipes inside it. Inherited
 * descendants pass the same eligibility rule as direct classifications:
 * a logical signal nested below a traced segment stays untraced.
 */
export function collectHeatTracedIds(root: Element): Set<string> {
  const traced = new Set<string>();
  const addWithDescendants = (el: Element): void => {
    if (isHeatTraceEligible(el.getAttribute("type") ?? "")) {
      const id = el.getAttribute("id");
      if (id) {
        traced.add(id);
      }
    }

    for (const child of componentObjects(el)) {
      addWithDescendants(child);
    }
  };

  for (const el of root.querySelectorAll("Object[id]")) {
    if (!isHeatTraceEligible(el.getAttribute("type") ?? "")) {
      continue;
    }

    const type = refLocalName(dataValue(getData(el, "HeatTracingType")));
    if (type && type !== "None" && type !== "NoHeatTracingSystem") {
      addWithDescendants(el);
    }
  }
  return traced;
}

// -----------------------------------------------------------------------------
// Parallel-offset geometry
// -----------------------------------------------------------------------------

const COINCIDENT_EPSILON_MM = 1e-9;
const MITER_LIMIT = 4;

function dedupeCoincident(points: readonly Point[]): Point[] {
  const result: Point[] = [];
  for (const p of points) {
    const last = result[result.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > COINCIDENT_EPSILON_MM) {
      result.push(p);
    }
  }
  return result;
}

/**
 * A polyline parallel to `points`, displaced `offsetMm` perpendicular to
 * each segment's direction (y-down mm space: positive = visual right of
 * travel, i.e. normal (-dy, dx)). Whole segments are offset and joined with miter
 * intersections at bends — vertices are never offset independently, so
 * the result stays parallel on every straight run. Miters are clamped to
 * MITER_LIMIT × |offset| so sharp bends cannot spike, and a full 180°
 * turn-back degrades to the plain vertex offset to keep continuity.
 * Coincident consecutive points are dropped first; fewer than 2 distinct
 * points yield an empty result.
 */
export function offsetPolyline(points: readonly Point[], offsetMm: number): Point[] {
  const pts = dedupeCoincident(points);
  if (pts.length < 2) {
    return [];
  }

  if (offsetMm === 0) {
    return pts;
  }

  const segments: Array<readonly [Point, Point]> = [];
  let prev: Point | undefined;
  for (const p of pts) {
    if (prev) {
      segments.push([prev, p]);
    }
    prev = p;
  }
  const normals = segments.map(([a, b]): Point => {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    return { x: -(b.y - a.y) / len, y: (b.x - a.x) / len };
  });

  const first = segments[0];
  const firstNormal = normals[0];
  const last = segments[segments.length - 1];
  const lastNormal = normals[normals.length - 1];
  if (!first || !firstNormal || !last || !lastNormal) {
    return [];
  }

  const result: Point[] = [
    { x: first[0].x + firstNormal.x * offsetMm, y: first[0].y + firstNormal.y * offsetMm },
  ];
  for (let j = 0; j + 1 < segments.length; j++) {
    const n1 = normals[j];
    const n2 = normals[j + 1];
    const bend = segments[j + 1];
    if (!n1 || !n2 || !bend) {
      continue;
    }

    const vertex = bend[0];
    const sumX = n1.x + n2.x;
    const sumY = n1.y + n2.y;
    const denom = sumX * sumX + sumY * sumY;
    if (denom < COINCIDENT_EPSILON_MM) {
      result.push({ x: vertex.x + n2.x * offsetMm, y: vertex.y + n2.y * offsetMm });
      continue;
    }

    let miterX = (sumX * 2 * offsetMm) / denom;
    let miterY = (sumY * 2 * offsetMm) / denom;
    const miterLen = Math.hypot(miterX, miterY);
    const maxLen = MITER_LIMIT * Math.abs(offsetMm);
    if (miterLen > maxLen) {
      miterX *= maxLen / miterLen;
      miterY *= maxLen / miterLen;
    }
    result.push({ x: vertex.x + miterX, y: vertex.y + miterY });
  }
  result.push({ x: last[1].x + lastNormal.x * offsetMm, y: last[1].y + lastNormal.y * offsetMm });
  return result;
}

// -----------------------------------------------------------------------------
// Overlay construction
// -----------------------------------------------------------------------------

function overlayStroke(style: HeatTraceStyle, pipeWidthMm: number): Stroke {
  return {
    color: style.color,
    width: style.widthMm ?? pipeWidthMm,
    dash: style.dash,
    ...(style.dashOffsetMm !== 0 ? { dashOffset: style.dashOffsetMm } : {}),
    ...(style.rounding !== null ? { rounding: style.rounding } : {}),
  };
}

/**
 * Dashed overlay polylines for every connector run owned by a heat-traced
 * object, laterally offset from the pipe centerline. Separate nodes on top
 * of the base geometry — the pipe itself stays untouched, so the overlay
 * can never read as a second pipe.
 */
export function buildHeatTraceOverlays(
  nodes: readonly SceneNode[],
  tracedIds: ReadonlySet<string>,
  style: HeatTraceStyle = DEFAULT_HEAT_TRACE_STYLE,
): SceneNode[] {
  if (tracedIds.size === 0) {
    return [];
  }

  const overlays: SceneNode[] = [];
  for (const node of nodes) {
    if (
      node.kind !== "prim" ||
      node.role !== "connector" ||
      node.prim.kind !== "polyline" ||
      !node.objectId ||
      !tracedIds.has(node.objectId)
    ) {
      continue;
    }

    const points = offsetPolyline(node.prim.points, style.lateralOffsetMm);
    if (points.length < 2) {
      continue;
    }

    overlays.push({
      kind: "prim",
      prim: {
        kind: "polyline",
        points,
        stroke: overlayStroke(style, node.prim.stroke.width),
      },
      objectId: node.objectId,
      role: "connector",
    });
  }
  return overlays;
}

/** Vertical placements (rotation near 90°/270°) get the trace beside, not below. */
function isVerticalRotation(rotationDeg: number): boolean {
  const norm = ((rotationDeg % 360) + 360) % 360;
  return (norm > 75 && norm < 105) || (norm > 255 && norm < 285);
}

/**
 * Dashed side-lines for heat-traced INLINE components (valves, fittings,
 * nozzles drawn as symbol placements): a horizontal placement gets the
 * trace just below its world bounds, a vertical one just to the right —
 * the prior-art convention. Label placements never get overlays.
 */
export function buildHeatTraceSymbolOverlays(
  nodes: readonly SceneNode[],
  tracedIds: ReadonlySet<string>,
  style: HeatTraceStyle,
  boundsOf: (node: SceneNode) => Bounds,
): SceneNode[] {
  if (tracedIds.size === 0) {
    return [];
  }

  const offset = Math.abs(style.lateralOffsetMm) || DEFAULT_HEAT_TRACE_LATERAL_OFFSET_MM;
  const overlays: SceneNode[] = [];
  for (const node of nodes) {
    if (node.kind !== "use" || node.role !== "symbol" || !node.objectId || !tracedIds.has(node.objectId)) {
      continue;
    }

    const b = boundsOf(node);
    if (b.maxX <= b.minX && b.maxY <= b.minY) {
      continue;
    }

    const points: Point[] = isVerticalRotation(node.transform.rotation)
      ? [
          { x: b.maxX + offset, y: b.minY },
          { x: b.maxX + offset, y: b.maxY },
        ]
      : [
          { x: b.minX, y: b.maxY + offset },
          { x: b.maxX, y: b.maxY + offset },
        ];
    overlays.push({
      kind: "prim",
      prim: { kind: "polyline", points, stroke: overlayStroke(style, DEFAULT_SYMBOL_TRACE_WIDTH_MM) },
      objectId: node.objectId,
      role: "symbol",
    });
  }
  return overlays;
}
