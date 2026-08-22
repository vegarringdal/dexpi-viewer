// -----------------------------------------------------------------------------
// Geometry & style
// -----------------------------------------------------------------------------

/** Drawing coordinates are mm, y-down like SVG (DEXPI 2.0 convention). */
export type Point = Readonly<{ x: number; y: number }>;

export type Bounds = Readonly<{
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}>;

/** Channels 0–255. */
export type RgbColor = Readonly<{ r: number; g: number; b: number }>;

/** Profile/LineRounding: Butt = butt caps + miter joins, Round = round both. */
export type StrokeRounding = "Butt" | "Round";

export type Stroke = Readonly<{
  color: RgbColor;
  /** mm */
  width: number;
  /** Dash pattern in mm; empty = solid. */
  dash: readonly number[];
  /** Dash phase in mm (SVG stroke-dashoffset); absent = 0. */
  dashOffset?: number;
  /** Cap/join style; absent = viewer default (round). */
  rounding?: StrokeRounding;
}>;

export type Fill = Readonly<{
  style: "Solid" | "Transparent" | "Hatch";
  color: RgbColor;
}>;

export type TextAlignH = "Left" | "Center" | "Right";
export type TextAlignV = "Top" | "Center" | "Bottom";

// -----------------------------------------------------------------------------
// Scene primitives
// -----------------------------------------------------------------------------

export type PolyLinePrim = Readonly<{
  kind: "polyline";
  points: readonly Point[];
  stroke: Stroke;
}>;

export type PolygonPrim = Readonly<{
  kind: "polygon";
  points: readonly Point[];
  stroke: Stroke;
  fill: Fill;
}>;

export type CirclePrim = Readonly<{
  kind: "circle";
  center: Point;
  radius: number;
  stroke: Stroke;
  fill: Fill;
}>;

export type EllipsePrim = Readonly<{
  kind: "ellipse";
  center: Point;
  rx: number;
  ry: number;
  /** degrees CCW */
  rotation: number;
  stroke: Stroke;
  fill: Fill;
}>;

export type EllipseArcPrim = Readonly<{
  kind: "ellipseArc";
  center: Point;
  rx: number;
  ry: number;
  /** degrees CCW from +x, in the y-up drawing space */
  startAngle: number;
  endAngle: number;
  rotation: number;
  stroke: Stroke;
}>;

export type RectPrim = Readonly<{
  kind: "rect";
  center: Point;
  width: number;
  height: number;
  rotation: number;
  stroke: Stroke;
  fill: Fill;
}>;

/** A TextTemplate fragment: literal text or a live attribute reference. */
export type TemplateFragment =
  | Readonly<{ kind: "literal"; text: string }>
  | Readonly<{
      kind: "attr";
      attributeName: string;
      objectId: string | null;
      /** AttributeRepresentationType: Value | Units | ValueAndUnits. */
      repType: string;
    }>;

export type TextPrim = Readonly<{
  kind: "text";
  position: Point;
  value: string;
  /** degrees CCW */
  rotation: number;
  /** mm */
  size: number;
  color: RgbColor;
  font: string;
  hAlign: TextAlignH;
  vAlign: TextAlignV;
  /** Present when the Text carries a TextTemplate (resolved at parse time). */
  template?: readonly TemplateFragment[];
}>;

export type ScenePrimitive =
  | PolyLinePrim
  | PolygonPrim
  | CirclePrim
  | EllipsePrim
  | EllipseArcPrim
  | RectPrim
  | TextPrim;

// -----------------------------------------------------------------------------
// Scene graph
// -----------------------------------------------------------------------------

/** What a drawn element belongs to, for selective styling/highlighting. */
export type ElementRole = "symbol" | "label" | "connector";

export type UseTransform = Readonly<{
  position: Point;
  /** degrees CCW */
  rotation: number;
  scaleX: number;
  scaleY: number;
  isMirrored: boolean;
}>;

export type PrimNode = Readonly<{
  kind: "prim";
  prim: ScenePrimitive;
  /** id of the conceptual object this drawing element represents, if any */
  objectId: string | null;
  role: ElementRole;
}>;

/** A placed instance of a catalogue Shape. */
export type UseNode = Readonly<{
  kind: "use";
  shapeId: string;
  transform: UseTransform;
  objectId: string | null;
  role: ElementRole;
}>;

export type SceneNode = PrimNode | UseNode;

export type ShapeDef = Readonly<{
  id: string;
  name: string;
  primitives: readonly ScenePrimitive[];
}>;

export type SceneGraph = Readonly<{
  nodes: readonly SceneNode[];
  shapes: ReadonlyMap<string, ShapeDef>;
  bounds: Bounds;
  /** Heat-traced object ids (incl. inherited descendants), computed alongside
   *  the overlay nodes — the eligibility rules live only in heatTracing.ts. */
  heatTracedIds: ReadonlySet<string>;
}>;

// -----------------------------------------------------------------------------
// Document
// -----------------------------------------------------------------------------

import type { ConnectivityGraph } from "./connectivity.ts";
import type { PlantModel } from "./plantModel.ts";
import type { ValidationIssue } from "./validation.ts";

export type DocumentMeta = Readonly<{
  modelName: string;
  originatingSystem: string;
  exportDateTime: string;
}>;

export type DexpiDocument = Readonly<{
  meta: DocumentMeta;
  scene: SceneGraph;
  /** Conceptual hierarchy for the tree/properties panels. */
  plant: PlantModel;
  /** Flow graph for upstream/downstream tracing. */
  connectivity: ConnectivityGraph;
  /** Validation findings, errors first. */
  issues: readonly ValidationIssue[];
  /** id → type for every id-bearing object. */
  objectTypes: ReadonlyMap<string, string>;
}>;
