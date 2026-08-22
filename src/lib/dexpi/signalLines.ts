import type { Point, ScenePrimitive, Stroke } from "./types.ts";
import { stringFromData } from "./xml.ts";

// -----------------------------------------------------------------------------
// Signal-line semantics
//
// The authoring tool behind the official DISC renderings styles a signal-
// family ConnectorLine by its represented object's SEMANTICS, overriding the
// authored stroke (the XML uniformly says LongDash) and synthesizing small
// mark glyphs that exist in no XML. Recovered empirically from all 15
// DISC_EXAMPLE-14 sheets (248 lines, no exceptions):
//   MeasuringLineFunction            → solid, no marks
//   SignalConveying                  → dash 3/3, no marks
//   ElectricalSignalConveying        → solid + square-bracket marks
//   BusSignalConveying               → dash 2.75/4.75 + circle marks
// The DiscProfile defines only the SignalConveyingFunctionTypeRepresentation
// attribute — no line-style graphics — so these conventions live here.
// -----------------------------------------------------------------------------

export type SignalMark = "bracket" | "circle";

export type SignalLineStyle = Readonly<{
  dash: readonly number[];
  mark: SignalMark | null;
}>;

const SIGNAL_DASH: readonly number[] = [3, 3];
const BUS_DASH: readonly number[] = [2.75, 4.75];

/**
 * The semantic line style for a connector's represented object, or null to
 * keep the authored stroke (non-signal objects, unknown subtype values).
 */
export function signalLineStyle(objectEl: Element | null): SignalLineStyle | null {
  if (!objectEl) {
    return null;
  }

  const type = objectEl.getAttribute("type") ?? "";
  if (type === "Plant/Instrumentation.MeasuringLineFunction") {
    return { dash: [], mark: null };
  }

  if (type !== "Plant/Instrumentation.SignalConveyingFunction") {
    return null;
  }

  const representation = (
    stringFromData(objectEl, "SignalConveyingFunctionTypeRepresentation") ||
    stringFromData(objectEl, "DiscProfile/SignalConveyingFunctionTypeRepresentation")
  ).trim();
  switch (representation) {
    case "SignalConveying":
      return { dash: SIGNAL_DASH, mark: null };
    case "ElectricalSignalConveying":
      return { dash: [], mark: "bracket" };
    case "BusSignalConveying":
      return { dash: BUS_DASH, mark: "circle" };
    case "HydraulicSignalConveying":
      // No official sample exists; director's call: a hydraulic signal is a
      // fluid-filled line like a measuring line, so it draws solid.
      return { dash: [], mark: null };
    default:
      return null;
  }
}

// -----------------------------------------------------------------------------
// Mark synthesis
//
// Placement measured from the official SVGs: brackets sit every 6.5mm along
// the drawn polyline starting 2.5mm from its start, each rotated to the
// local segment direction (glyph arms point along travel). The one observed
// bus line (9mm) carries a single circle 5mm in — read as a 10mm cadence
// starting at 5mm until longer real examples say otherwise.
// -----------------------------------------------------------------------------

const BRACKET_OFFSET_MM = 2.5;
const BRACKET_SPACING_MM = 6.5;
const CIRCLE_OFFSET_MM = 5;
const CIRCLE_SPACING_MM = 10;
const MARK_HALF_SIZE_MM = 1.25;

/** Local bracket glyph "[", arms along +x — the official mark verbatim. */
const BRACKET_LOCAL: readonly Point[] = [
  { x: 1.25, y: -1.25 },
  { x: 0, y: -1.25 },
  { x: 0, y: 1.25 },
  { x: 1.25, y: 1.25 },
];

type SegmentHit = Readonly<{ point: Point; angleRad: number }>;

/** The point (and local direction) at arc-length `s` along the polyline. */
function pointAtLength(points: readonly Point[], s: number): SegmentHit | null {
  let remaining = s;
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (!a || !b) {
      continue;
    }

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (length <= 0) {
      continue;
    }

    if (remaining <= length) {
      const t = remaining / length;
      return { point: { x: a.x + dx * t, y: a.y + dy * t }, angleRad: Math.atan2(dy, dx) };
    }

    remaining -= length;
  }
  return null;
}

function polylineLength(points: readonly Point[]): number {
  let total = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (a && b) {
      total += Math.hypot(b.x - a.x, b.y - a.y);
    }
  }
  return total;
}

/**
 * Synthesized mark primitives along a signal connector line, styled with the
 * line's own color/width but always solid.
 */
export function buildSignalMarkPrims(
  points: readonly Point[],
  mark: SignalMark,
  stroke: Stroke,
): ScenePrimitive[] {
  const markStroke: Stroke = { ...stroke, dash: [] };
  const offset = mark === "bracket" ? BRACKET_OFFSET_MM : CIRCLE_OFFSET_MM;
  const spacing = mark === "bracket" ? BRACKET_SPACING_MM : CIRCLE_SPACING_MM;
  const total = polylineLength(points);
  const prims: ScenePrimitive[] = [];
  for (let s = offset; s <= total - MARK_HALF_SIZE_MM; s += spacing) {
    const hit = pointAtLength(points, s);
    if (!hit) {
      break;
    }

    if (mark === "circle") {
      prims.push({
        kind: "circle",
        center: hit.point,
        radius: MARK_HALF_SIZE_MM,
        stroke: markStroke,
        fill: { style: "Transparent", color: markStroke.color },
      });
      continue;
    }

    const cos = Math.cos(hit.angleRad);
    const sin = Math.sin(hit.angleRad);
    prims.push({
      kind: "polyline",
      points: BRACKET_LOCAL.map((p) => ({
        x: hit.point.x + p.x * cos - p.y * sin,
        y: hit.point.y + p.x * sin + p.y * cos,
      })),
      stroke: markStroke,
    });
  }
  return prims;
}
