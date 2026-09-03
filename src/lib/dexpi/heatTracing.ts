import type { ProfileLineStroke } from "./discProfile.ts";
import { transformPoint } from "./flattenScene.ts";
import { isOffPageConnectorType, isPropertyBreakType, localTypeName } from "./typeNames.ts";
import type {
  Bounds,
  Point,
  RgbColor,
  SceneNode,
  ScenePrimitive,
  ShapeDef,
  Stroke,
  StrokeRounding,
  UseTransform,
} from "./types.ts";
import {
  booleanFromData,
  componentObjects,
  dataValue,
  directChildrenByTag,
  getData,
  refLocalName,
} from "./xml.ts";

// -----------------------------------------------------------------------------
// Heat tracing (main-file data, director's rendering rules)
//
// `HeatTracingType` on a piping object is semantic metadata in the MAIN
// DEXPI model (not DiscProfile.xml). Classified runs get a dashed overlay
// drawn parallel to the normal pipe geometry. A loaded DiscProfile's
// heat-trace LineStroke wins for color/dash/width/rounding; otherwise the
// documented viewer defaults below apply. HeatTracingBreak objects are
// logical property breaks — associated data, never drawn as components.
//
// Placement is always toward the bottom/right in absolute drawing space
// (2026-08-31 director's convention) — never derived from the LineStroke's
// own signed LateralOffset or the file's point ordering, since neither
// reliably lands on a consistent visual side. `offsetPolyline` resolves the
// side independently per segment (an L-bend must trace bottom on its
// horizontal leg AND right on its vertical leg — a single shared sign for
// the whole run can't do both); `buildHeatTraceSymbolOverlays` only ever
// adds to a symbol's max bound, never subtracts. Round-bubble treatment is
// an explicit catalogue-symbol allowlist (ND0023/ND0248A/ND0248B), not a
// shape-geometry heuristic — see `isRoundTraceSymbol`.
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// Style
// -----------------------------------------------------------------------------

/**
 * Viewer display defaults for the overlay when no profile stroke exists.
 * DISC/DEXPI has no published example of a heat-trace LineStroke's DashArray
 * (see the 2026-08-21 entry — the profile's AggregatedStroke container has
 * no instance data yet), so this is purely a viewer aesthetic choice, set
 * 2026-08-31 per the director's feedback (was 2.4/1.6, then 1.6/1.0).
 */
const HEAT_TRACE_DASH_MM: readonly number[] = [1.0, 1.0];
const HEAT_TRACE_COLOR: RgbColor = { r: 217, g: 108, b: 24 };

/**
 * Fallback lateral offset in mm (positive = right of the drawing
 * direction). The model has no explicit heat-trace geometry and files seen
 * so far carry no Profile/LineStroke.LateralOffset, so this display-rule
 * default keeps the overlay visibly beside the pipe instead of on top of
 * it. Deliberately documented and overridable rather than silently zero.
 */
export const DEFAULT_HEAT_TRACE_LATERAL_OFFSET_MM = 1.5;

/**
 * Fallback trace stroke width in mm, used for every heat-trace overlay
 * (connector-line AND symbol ring/side-line alike) whenever the profile
 * doesn't specify its own LineStroke `Width`. Deliberately a single fixed
 * constant, not derived from the traced pipe/symbol's own line width
 * (director's explicit call, 2026-08-31) — every heat-trace mark reads as
 * one consistent style regardless of which component it's drawn on. Matches
 * the real DISC example files' uniform `ConnectorLine` width (0.25mm) as a
 * sensible baseline, but that's coincidental, not a lookup.
 */
const DEFAULT_HEAT_TRACE_WIDTH_MM = 0.25;

export type HeatTraceStyle = Readonly<{
  color: RgbColor;
  /** Dash pattern in mm; empty = solid. */
  dash: readonly number[];
  /**
   * Perpendicular displacement magnitude in mm. Only the absolute value is
   * used — the overlay's actual side is always resolved toward the bottom
   * (horizontal runs) or right (vertical runs) in absolute drawing space,
   * ignoring this field's sign and the profile LineStroke's own directional
   * intent (see the file-header note).
   */
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
 * OfflineMeasuringElement only — physical pipes and impulse lines; the DISC
 * Profile addendum extends it to Nozzle, ProcessInstrumentationFunction and
 * Pipe. `MeasuringLineFunction` is a physical impulse/sensing line (not a
 * logical signal), so it inherits from a traced parent the same way
 * (2026-08-31 director's clarification) — unlike `SignalConveyingFunction`
 * and other purely logical signal classes, which never carry or inherit a
 * classification; data placed there is a modelling error and is ignored.
 * Plant/Piping.* covers the piping subclasses (including Pipe);
 * DiscProfile/* custom classes (profile-extended piping components, PIF
 * extensions) are trusted, matching the prior-art viewer.
 */
function isHeatTraceEligible(type: string): boolean {
  if (type.startsWith("Plant/Piping.") || type.startsWith("DiscProfile/")) {
    return true;
  }

  const local = type.split(/[./]/).pop() ?? type;
  return (
    local === "OfflineMeasuringElement" ||
    local === "ProcessInstrumentationFunction" ||
    local === "Nozzle" ||
    local === "MeasuringLineFunction"
  );
}

/** Literal enum value that explicitly turns heat tracing off at this level and below. */
const NO_HEAT_TRACING = "NoHeatTracingSystem";

/** Ball valves always get straight-line trace, even if a catalogue symbol geometrically reads round. */
function isBallValveType(type: string): boolean {
  return localTypeName(type).endsWith("BallValve");
}

/**
 * Ids of every object classified as heat-traced, direct or inherited.
 * `HeatTracingType` set on an eligible object (to any of
 * ElectricalHeatTracingSystem/HeatTracingSystem/SteamHeatTracingSystem/
 * TubularHeatTracingSystem) covers that object and every sub-component below
 * it. A NULL/absent value on an eligible object inherits the nearest
 * ancestor's effective classification (climbing as many levels as needed),
 * defaulting to untraced when no ancestor has one set. `NoHeatTracingSystem`
 * at any level overrides inheritance for that object and everything below
 * it, until a lower-level object re-classifies with an active type.
 * Ineligible classes (e.g. logical signal functions) neither carry nor block
 * a classification — inheritance passes straight through them to their
 * children.
 */
export function collectHeatTracedIds(root: Element): Set<string> {
  const traced = new Set<string>();

  const walk = (el: Element, inherited: boolean): void => {
    let effective = inherited;

    if (isHeatTraceEligible(el.getAttribute("type") ?? "")) {
      const value = refLocalName(dataValue(getData(el, "HeatTracingType")));
      if (value === NO_HEAT_TRACING) {
        effective = false;
      } else if (value && value !== "None") {
        effective = true;
      }

      if (effective) {
        const id = el.getAttribute("id");
        if (id) {
          traced.add(id);
        }
      }
    }

    for (const child of componentObjects(el)) {
      walk(child, effective);
    }
  };

  for (const el of directChildrenByTag(root, "Object")) {
    walk(el, false);
  }

  return traced;
}

/**
 * Ids of heat-traced objects (already in `tracedIds`) explicitly flagged
 * `IsHeatTracingSafetyCritical` — a DISC Profile addition alongside
 * HeatTracingType marking whether an item's heat tracing is safety-critical.
 * Not inherited: only an object's own explicit `true` value qualifies, since
 * the profile defines no propagation rule for this flag.
 */
export function collectHeatTracingSafetyCriticalIds(
  root: Element,
  tracedIds: ReadonlySet<string>,
): Set<string> {
  const critical = new Set<string>();
  for (const el of root.querySelectorAll("Object[id]")) {
    const id = el.getAttribute("id");
    if (!id || !tracedIds.has(id)) {
      continue;
    }

    if (booleanFromData(el, "IsHeatTracingSafetyCritical")) {
      critical.add(id);
    }
  }
  return critical;
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
 * A polyline parallel to `points`, displaced `offsetMm` (only its magnitude
 * matters — see below) perpendicular to each segment's own direction
 * (y-down mm space). Each segment independently picks whichever of its two
 * perpendicular directions has a non-negative x+y component, biasing the
 * result toward the bottom/right in absolute drawing space — the director's
 * placement rule — rather than a single relative-to-travel-direction side
 * for the whole polyline: an L-shaped run must trace bottom on its
 * horizontal leg AND right on its vertical leg, which a single shared sign
 * can't do for both legs at once when they're different lengths. Whole
 * segments are offset and joined with miter intersections at bends —
 * vertices are never offset independently, so the result stays parallel on
 * every straight run. Adjacent segments' independently-chosen normals stay
 * compatible (no spike) for any ordinary bend since both are biased into
 * the same bottom-right half-plane; a near-exact reversal still degrades to
 * the plain vertex offset via the existing miter-limit clamp. Coincident
 * consecutive points are dropped first; fewer than 2 distinct points yield
 * an empty result.
 */
export function offsetPolyline(points: readonly Point[], offsetMm: number): Point[] {
  const pts = dedupeCoincident(points);
  if (pts.length < 2) {
    return [];
  }

  const magnitude = Math.abs(offsetMm);
  if (magnitude === 0) {
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
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;
    return nx + ny >= 0 ? { x: nx, y: ny } : { x: -nx, y: -ny };
  });

  const first = segments[0];
  const firstNormal = normals[0];
  const last = segments[segments.length - 1];
  const lastNormal = normals[normals.length - 1];
  if (!first || !firstNormal || !last || !lastNormal) {
    return [];
  }

  const result: Point[] = [
    { x: first[0].x + firstNormal.x * magnitude, y: first[0].y + firstNormal.y * magnitude },
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
      result.push({ x: vertex.x + n2.x * magnitude, y: vertex.y + n2.y * magnitude });
      continue;
    }

    let miterX = (sumX * 2 * magnitude) / denom;
    let miterY = (sumY * 2 * magnitude) / denom;
    const miterLen = Math.hypot(miterX, miterY);
    const maxLen = MITER_LIMIT * magnitude;
    if (miterLen > maxLen) {
      miterX *= maxLen / miterLen;
      miterY *= maxLen / miterLen;
    }
    result.push({ x: vertex.x + miterX, y: vertex.y + miterY });
  }
  result.push({ x: last[1].x + lastNormal.x * magnitude, y: last[1].y + lastNormal.y * magnitude });
  return result;
}

// -----------------------------------------------------------------------------
// Overlay construction
// -----------------------------------------------------------------------------

function overlayStroke(style: HeatTraceStyle): Stroke {
  return {
    color: style.color,
    width: style.widthMm ?? DEFAULT_HEAT_TRACE_WIDTH_MM,
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
        stroke: overlayStroke(style),
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
 * Extends a bounds accumulator by one shape primitive in its own local
 * coordinates (no instance transform) — deliberately approximate (rotation
 * ignored, text skipped) since this only feeds the flat-side asymmetry
 * check below (`localShapeBounds`), never final drawing geometry.
 */
function extendLocalBounds(
  b: { minX: number; minY: number; maxX: number; maxY: number },
  prim: ScenePrimitive,
): void {
  const extend = (x: number, y: number): void => {
    b.minX = Math.min(b.minX, x);
    b.minY = Math.min(b.minY, y);
    b.maxX = Math.max(b.maxX, x);
    b.maxY = Math.max(b.maxY, y);
  };

  switch (prim.kind) {
    case "polyline":
    case "polygon":
      for (const p of prim.points) {
        extend(p.x, p.y);
      }
      break;
    case "circle":
      extend(prim.center.x - prim.radius, prim.center.y - prim.radius);
      extend(prim.center.x + prim.radius, prim.center.y + prim.radius);
      break;
    case "ellipse":
    case "ellipseArc":
      extend(prim.center.x - prim.rx, prim.center.y - prim.ry);
      extend(prim.center.x + prim.rx, prim.center.y + prim.ry);
      break;
    case "rect":
      extend(prim.center.x - prim.width / 2, prim.center.y - prim.height / 2);
      extend(prim.center.x + prim.width / 2, prim.center.y + prim.height / 2);
      break;
    case "text":
      break;
  }
}

/**
 * Catalogue symbol names that get an encompassing ring rather than a
 * straight side-line — director's explicit allowlist (2026-08-31),
 * superseding the earlier shape-geometry heuristic: only these three ND
 * codes read as an instrument bubble, regardless of how round any other
 * symbol's silhouette looks (a BallValve body, say, can be drawn with a
 * dominant circular primitive and must still get a straight line).
 */
const ROUND_HEAT_TRACE_SYMBOL_NAMES: ReadonlySet<string> = new Set(["ND0023", "ND0248A", "ND0248B"]);

/** Whether `shape` is one of the director's named round-trace symbols (ShapeDef.name carries the DISC symbol name). */
function isRoundTraceSymbol(shape: ShapeDef): boolean {
  return ROUND_HEAT_TRACE_SYMBOL_NAMES.has(shape.name);
}

/** Local (pre-transform) bounds of a shape's own primitives, or null for an empty shape. */
function localShapeBounds(shape: ShapeDef): Bounds | null {
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const prim of shape.primitives) {
    extendLocalBounds(b, prim);
  }
  return Number.isFinite(b.minX) ? b : null;
}

/**
 * Whether a shape's local MAX bound (on whichever axis `min`/`max` are
 * taken from) is the flat, non-protruding side — true when it sits closer
 * to the shape's own origin than the MIN bound. DoubleBlockAndBleed(AndCheck)
 * bodies (DiscProfile ND0004/ND0005) have their bleed-port stub on one
 * axis's MIN side (e.g. local Y runs -9 at the stub vs +2 at the flat
 * body edge), so the smaller-magnitude bound is the one to trace along.
 */
function isMaxSideFlat(min: number, max: number): boolean {
  return Math.abs(max) <= Math.abs(min);
}

/**
 * A symbol's WORLD bounds, honoring its actual rotation/mirror/scale —
 * unlike `computeSceneBounds`'s approximation (used for general scene
 * bounds elsewhere), which ignores rotation for polyline/polygon
 * primitives and keeps the shape's UNROTATED aspect ratio. That
 * approximation silently breaks the flat-side decision for a rotated
 * asymmetric body: a DoubleBlockAndBleedValve placed with its catalogue-
 * native bleed stub pointing up (its declared geometry) but rotated 180°
 * in this instance so the stub actually points down would still get
 * treated as "stub up" by rotation-ignorant bounds, tracing straight
 * through the now-downward stub instead of the now-upward flat side
 * (2026-08-31 director's report, confirmed against a real screenshot).
 * Transforms the shape's own local bounding corners through `transform`
 * (the same `transformPoint` the PDF/SVG-flattening path uses) and takes
 * the enclosing box — exact for the 0/90/180/270° placements DEXPI symbols
 * actually use, a safe conservative enclosure for any other angle.
 */
function rotatedWorldBounds(shape: ShapeDef, transform: UseTransform): Bounds | null {
  const local = localShapeBounds(shape);
  if (!local) {
    return null;
  }

  const corners: readonly Point[] = [
    { x: local.minX, y: local.minY },
    { x: local.maxX, y: local.minY },
    { x: local.maxX, y: local.maxY },
    { x: local.minX, y: local.maxY },
  ];
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const corner of corners) {
    const world = transformPoint(transform, corner);
    b.minX = Math.min(b.minX, world.x);
    b.minY = Math.min(b.minY, world.y);
    b.maxX = Math.max(b.maxX, world.x);
    b.maxY = Math.max(b.maxY, world.y);
  }
  return b;
}

/**
 * Whether the flat (non-protruding) side of `shape`, once actually rotated
 * per `transform`, lands on the WORLD max side of whichever axis `vertical`
 * selects (X for a vertical placement, Y for a horizontal one) — the
 * boolean callers need to choose `b.maxX`/`b.maxY` vs `b.minX`/`b.minY` for
 * the trace line. A local axis's min/max can't be read off directly once
 * rotation is in play (see `rotatedWorldBounds`'s doc comment for the real
 * example that exposed this): identifies the shape's own more-asymmetric
 * local axis (bigger `|min|` vs `|max|` mismatch), rotates that axis's flat
 * extreme point through the real transform, and compares it against the
 * transformed origin to see which world side it actually landed on. A
 * symmetric shape (equal asymmetry on both local axes, i.e. no real "flat
 * side" at all) defaults to the max side, matching the plain bottom/right
 * rule.
 */
function resolveFlatSideIsWorldMax(shape: ShapeDef, transform: UseTransform, vertical: boolean): boolean {
  const local = localShapeBounds(shape);
  if (!local) {
    return true;
  }

  const xAsymmetry = Math.abs(Math.abs(local.maxX) - Math.abs(local.minX));
  const yAsymmetry = Math.abs(Math.abs(local.maxY) - Math.abs(local.minY));
  if (Math.max(xAsymmetry, yAsymmetry) < COINCIDENT_EPSILON_MM) {
    // No real asymmetry on either axis — nothing to bridge through the
    // transform, and the tie itself isn't meaningful once rotated (an
    // arbitrary axis choice here would land on either world side, not
    // reliably max). Just keep the plain bottom/right default.
    return true;
  }

  const flatLocalPoint =
    xAsymmetry > yAsymmetry
      ? isMaxSideFlat(local.minX, local.maxX)
        ? { x: local.maxX, y: 0 }
        : { x: local.minX, y: 0 }
      : isMaxSideFlat(local.minY, local.maxY)
        ? { x: 0, y: local.maxY }
        : { x: 0, y: local.minY };

  const flatWorld = transformPoint(transform, flatLocalPoint);
  const origin = transformPoint(transform, { x: 0, y: 0 });
  return vertical ? flatWorld.x >= origin.x : flatWorld.y >= origin.y;
}

/**
 * Dashed overlay for a heat-traced symbol placement: an encompassing ring
 * just outside a round "instrument bubble" symbol's bounds — restricted to
 * the director's named ND0023/ND0248A/ND0248B symbols
 * (`isRoundTraceSymbol`), never a BallValve regardless of its own symbol's
 * silhouette — or a side-line for any other inline component (valves,
 * fittings, flanges, plugs, nozzles). The side-line always runs along the
 * bottom (horizontal placement) or right (vertical placement) of the
 * symbol's world bounds — except when the catalogue shape's own geometry is
 * asymmetric on that axis (a DoubleBlockAndBleedValve's bleed-port stub, a
 * ball valve drawn with an integrated bleed/drain branch, …): the trace
 * then follows the flat (non-protruding) side instead, so it never overdraws
 * the protruding branch (`resolveFlatSideIsWorldMax`, which rotates the
 * shape's own asymmetry through the instance's actual transform — a plain
 * symmetric symbol falls through to the same bottom/right default as
 * before). Both the ring and the side-line use `rotatedWorldBounds`, not
 * the injected `boundsOf`, for the same reason: a rotated instance's true
 * world bounds aren't the unrotated shape's bounds just translated. A round
 * instrument-bubble
 * shape gets the ring even when it lives in a "label" group — an
 * instrument's tag balloon (e.g. a PSV's circle) is drawn there because it
 * carries the tag text, not because it is a label backdrop, and the real
 * DISC data places it exactly that way (see the 2026-08-27 DESIGN.md
 * entry). Non-round label placements still get no overlay — nothing
 * establishes what a dashed mark under an arbitrary label shape should
 * mean. PropertyBreak and OffPageConnector placements never get an overlay,
 * regardless of shape — see `isPropertyBreakType`/`isOffPageConnectorType`.
 */
export function buildHeatTraceSymbolOverlays(
  nodes: readonly SceneNode[],
  tracedIds: ReadonlySet<string>,
  style: HeatTraceStyle,
  boundsOf: (node: SceneNode) => Bounds,
  shapes: ReadonlyMap<string, ShapeDef>,
  typeOf: (objectId: string) => string | null,
): SceneNode[] {
  if (tracedIds.size === 0) {
    return [];
  }

  const offset = Math.abs(style.lateralOffsetMm) || DEFAULT_HEAT_TRACE_LATERAL_OFFSET_MM;
  const overlays: SceneNode[] = [];
  for (const node of nodes) {
    if (
      node.kind !== "use" ||
      (node.role !== "symbol" && node.role !== "label") ||
      !node.objectId ||
      !tracedIds.has(node.objectId)
    ) {
      continue;
    }

    const type = typeOf(node.objectId);
    if (type && (isPropertyBreakType(type) || isOffPageConnectorType(type))) {
      continue;
    }

    const shape = shapes.get(node.shapeId);
    if (!shape) {
      continue;
    }

    const b = rotatedWorldBounds(shape, node.transform) ?? boundsOf(node);
    if (b.maxX <= b.minX && b.maxY <= b.minY) {
      continue;
    }

    const isRound = isRoundTraceSymbol(shape) && !(type && isBallValveType(type));
    if (node.role === "label" && !isRound) {
      continue;
    }

    const stroke = overlayStroke(style);
    if (isRound) {
      const radius = Math.max(b.maxX - b.minX, b.maxY - b.minY) / 2 + offset;
      overlays.push({
        kind: "prim",
        prim: {
          kind: "circle",
          center: { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 },
          radius,
          stroke,
          fill: { style: "Transparent", color: stroke.color },
        },
        objectId: node.objectId,
        role: "symbol",
      });
      continue;
    }

    const vertical = isVerticalRotation(node.transform.rotation);
    const useMaxSide = resolveFlatSideIsWorldMax(shape, node.transform, vertical);
    const points: Point[] = vertical
      ? useMaxSide
        ? [
            { x: b.maxX + offset, y: b.minY },
            { x: b.maxX + offset, y: b.maxY },
          ]
        : [
            { x: b.minX - offset, y: b.minY },
            { x: b.minX - offset, y: b.maxY },
          ]
      : useMaxSide
        ? [
            { x: b.minX, y: b.maxY + offset },
            { x: b.maxX, y: b.maxY + offset },
          ]
        : [
            { x: b.minX, y: b.minY - offset },
            { x: b.maxX, y: b.minY - offset },
          ];
    overlays.push({
      kind: "prim",
      prim: { kind: "polyline", points, stroke },
      objectId: node.objectId,
      role: "symbol",
    });
  }
  return overlays;
}
