import type { ProfileLineStroke } from "./discProfile.ts";
import type { Point, ScenePrimitive, Stroke } from "./types.ts";
import { stringFromData } from "./xml.ts";

// -----------------------------------------------------------------------------
// Signal-line semantics
//
// The XML gives every signal-family ConnectorLine the same authored stroke
// (LongDash); readers style the line by its represented object's SEMANTICS
// and synthesize small repeated mark glyphs that exist in no XML. The
// mapping below follows the DISC decoration table (director-supplied):
//   MeasuringLineFunction              → solid, no marks
//   SignalConveying (plain)            → dashed, no marks
//   ElectricalSignalConveying          → solid + repeated italic E
//   HydraulicSignalConveying           → solid + repeated upright L
//   BusSignalConveying                 → solid + repeated small circle
//   PneumaticSignalConveying           → solid + repeated ^ chevron
//   CapillarySignalConveying           → solid + repeated small x
//   UndefinedSignalConveying           → solid + repeated / slash
//   ElectromagneticGuidedSignalConveying   → solid + repeated ~ squiggle
//   ElectromagneticUnguidedSignalConveying → marks only, line hidden
//                                            (no physical conductor)
//   attribute absent                   → authored stroke kept unchanged
//
// PRECEDENCE: if the loaded DiscProfile publishes a Profile/LineStroke for
// a representation value, the profile wins by default — these built-ins are
// the fallback. Settings → Rendering can force the built-in convention
// (for early-stage profiles); see setPreferBuiltinSignalStyle.
// -----------------------------------------------------------------------------

export type SignalMark = "E" | "L" | "circle" | "chevron" | "x" | "slash" | "squiggle";

export type SignalLineStyle = Readonly<{
  dash: readonly number[];
  mark: SignalMark | null;
  /** No physical conductor to depict — draw only the marks, not the line. */
  hideLine: boolean;
  /** Set when the style came from a profile LineStroke. */
  color?: Stroke["color"];
  width?: number;
}>;

const SIGNAL_DASH: readonly number[] = [3, 3];
const SOLID: readonly number[] = [];

const BUILTIN_STYLES: ReadonlyMap<string, SignalLineStyle> = new Map([
  ["SignalConveying", { dash: SIGNAL_DASH, mark: null, hideLine: false }],
  ["ElectricalSignalConveying", { dash: SOLID, mark: "E", hideLine: false }],
  ["HydraulicSignalConveying", { dash: SOLID, mark: "L", hideLine: false }],
  ["BusSignalConveying", { dash: SOLID, mark: "circle", hideLine: false }],
  ["PneumaticSignalConveying", { dash: SOLID, mark: "chevron", hideLine: false }],
  ["CapillarySignalConveying", { dash: SOLID, mark: "x", hideLine: false }],
  ["UndefinedSignalConveying", { dash: SOLID, mark: "slash", hideLine: false }],
  ["ElectromagneticGuidedSignalConveying", { dash: SOLID, mark: "squiggle", hideLine: false }],
  ["ElectromagneticUnguidedSignalConveying", { dash: SOLID, mark: "squiggle", hideLine: true }],
]);

// Parse-baked setting (mirrors setUnitDisplayMode): when true, the built-in
// convention wins even over a profile-published LineStroke.
let preferBuiltinSignalStyle = false;

export function setPreferBuiltinSignalStyle(prefer: boolean): void {
  preferBuiltinSignalStyle = prefer;
}

const NO_PROFILE_STROKES: ReadonlyMap<string, ProfileLineStroke> = new Map();

function styleFromProfileStroke(stroke: ProfileLineStroke): SignalLineStyle {
  return {
    dash: stroke.dashArray,
    mark: null,
    hideLine: false,
    ...(stroke.color ? { color: stroke.color } : {}),
    ...(stroke.widthMm !== null ? { width: stroke.widthMm } : {}),
  };
}

/**
 * The semantic line style for a connector's represented object, or null to
 * keep the authored stroke (non-signal objects, absent/unknown subtype
 * values). A profile-published LineStroke for the representation value
 * overrides the built-in convention unless the user prefers the built-in.
 */
export function signalLineStyle(
  objectEl: Element | null,
  profileStrokes: ReadonlyMap<string, ProfileLineStroke> = NO_PROFILE_STROKES,
): SignalLineStyle | null {
  if (!objectEl) {
    return null;
  }

  const type = objectEl.getAttribute("type") ?? "";
  if (type === "Plant/Instrumentation.MeasuringLineFunction") {
    return { dash: SOLID, mark: null, hideLine: false };
  }

  if (type !== "Plant/Instrumentation.SignalConveyingFunction") {
    return null;
  }

  const representation = (
    stringFromData(objectEl, "SignalConveyingFunctionTypeRepresentation") ||
    stringFromData(objectEl, "DiscProfile/SignalConveyingFunctionTypeRepresentation")
  ).trim();
  const profileStroke = profileStrokes.get(representation);
  if (profileStroke && !preferBuiltinSignalStyle) {
    return styleFromProfileStroke(profileStroke);
  }

  return BUILTIN_STYLES.get(representation) ?? null;
}

// -----------------------------------------------------------------------------
// Mark synthesis
//
// Glyphs repeat every 6.5mm along the drawn polyline starting 2.5mm in
// (cadence measured from the official electrical samples), each rotated to
// the local segment direction. Circles keep the observed 10mm cadence
// starting 5mm in. Glyph strokes are hand-drawn vectors (~2.5mm tall) so
// exports need no font.
// -----------------------------------------------------------------------------

const GLYPH_OFFSET_MM = 2.5;
const GLYPH_SPACING_MM = 6.5;
const CIRCLE_OFFSET_MM = 5;
const CIRCLE_SPACING_MM = 10;
const MARK_HALF_SIZE_MM = 1.25;

type Glyph = readonly (readonly Point[])[];

/** Vector strokes per mark, local coords (y-down, travel along +x). */
const GLYPHS: Readonly<Record<Exclude<SignalMark, "circle">, Glyph>> = {
  E: [
    [
      { x: -0.15, y: -1.25 },
      { x: -0.75, y: 1.25 },
    ],
    [
      { x: -0.15, y: -1.25 },
      { x: 1.05, y: -1.25 },
    ],
    [
      { x: -0.45, y: 0 },
      { x: 0.6, y: 0 },
    ],
    [
      { x: -0.75, y: 1.25 },
      { x: 0.45, y: 1.25 },
    ],
  ],
  L: [
    [
      { x: -0.5, y: -1.25 },
      { x: -0.5, y: 1.25 },
      { x: 0.8, y: 1.25 },
    ],
  ],
  chevron: [
    [
      { x: -1, y: 1 },
      { x: 0, y: -1 },
      { x: 1, y: 1 },
    ],
  ],
  x: [
    [
      { x: -0.9, y: -0.9 },
      { x: 0.9, y: 0.9 },
    ],
    [
      { x: -0.9, y: 0.9 },
      { x: 0.9, y: -0.9 },
    ],
  ],
  slash: [
    [
      { x: -0.6, y: 1.1 },
      { x: 0.6, y: -1.1 },
    ],
  ],
  squiggle: [
    [
      { x: -1.4, y: 0.3 },
      { x: -0.9, y: -0.4 },
      { x: -0.35, y: -0.4 },
      { x: 0.35, y: 0.4 },
      { x: 0.9, y: 0.4 },
      { x: 1.4, y: -0.3 },
    ],
  ],
};

function rangeStops(from: number, to: number, step: number): number[] {
  const stops: number[] = [];
  for (let s = from; s <= to; s += step) {
    stops.push(s);
  }
  return stops;
}

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
  const offset = mark === "circle" ? CIRCLE_OFFSET_MM : GLYPH_OFFSET_MM;
  const spacing = mark === "circle" ? CIRCLE_SPACING_MM : GLYPH_SPACING_MM;
  const total = polylineLength(points);
  const prims: ScenePrimitive[] = [];
  // A line shorter than the cadence still gets one centered mark — vital
  // for hidden-line styles, whose marks are all that gets drawn.
  const stops =
    total > offset + MARK_HALF_SIZE_MM ? rangeStops(offset, total - MARK_HALF_SIZE_MM, spacing) : [total / 2];
  for (const s of stops) {
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

    // Letter glyphs must stay readable: normalize the frame to the
    // readable half-plane (same rule as label rotation) so a right-to-left
    // segment doesn't draw its Es upside-down.
    const angle =
      hit.angleRad > Math.PI / 2 || hit.angleRad <= -Math.PI / 2 ? hit.angleRad + Math.PI : hit.angleRad;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    for (const path of GLYPHS[mark]) {
      prims.push({
        kind: "polyline",
        points: path.map((p) => ({
          x: hit.point.x + p.x * cos - p.y * sin,
          y: hit.point.y + p.x * sin + p.y * cos,
        })),
        stroke: markStroke,
      });
    }
  }
  return prims;
}
