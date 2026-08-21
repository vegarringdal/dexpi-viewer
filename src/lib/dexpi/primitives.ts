import type {
  Fill,
  Point,
  RgbColor,
  ScenePrimitive,
  Stroke,
  TemplateFragment,
  TextAlignH,
  TextAlignV,
  TextPrim,
} from "./types.ts";
import {
  aggregateFromData,
  colorFromAggregate,
  componentObjects,
  dataValue,
  getData,
  numberFromData,
  pointFromAggregate,
  pointsFromData,
  referenceTargets,
  refLocalName,
  stringFromData,
} from "./xml.ts";

// -----------------------------------------------------------------------------
// Style parsing
// -----------------------------------------------------------------------------

const BLACK: RgbColor = { r: 0, g: 0, b: 0 };
const DEFAULT_STROKE_WIDTH_MM = 0.25;
const DEFAULT_TEXT_SIZE_MM = 3.5;

/**
 * Dash patterns per the DEXPI 2.0 DashStyle enumeration (spec: pattern values
 * are dimensionless, multiplied by the stroke width in mm). Trailing cases
 * tolerate the Proteus-era style names some exporters still emit.
 */
function dashPattern(style: string, width: number): readonly number[] {
  const w = Math.max(width, 0.1);
  switch (style) {
    case "Dot":
      return [w, 2 * w];
    case "ShortDash":
      return [2 * w, 2 * w];
    case "Dash":
      return [4 * w, 2 * w];
    case "LongDash":
      return [8 * w, 3 * w];
    case "DashShortDash":
      return [4 * w, 2 * w, 2 * w, 2 * w];
    case "LongDashShortDash":
      return [8 * w, 3 * w, 2 * w, 3 * w];
    case "LongDashShortDashShortDash":
      return [8 * w, 3 * w, 2 * w, 3 * w, 2 * w, 3 * w];
    case "DashDot":
      return [4 * w, 2 * w, w, 2 * w];
    case "DashDotDot":
      return [4 * w, 2 * w, w, 2 * w, w, 2 * w];
    default:
      return [];
  }
}

function parseStrokeAggregate(agg: Element | null): Stroke {
  if (!agg) {
    return { color: BLACK, width: DEFAULT_STROKE_WIDTH_MM, dash: [] };
  }

  const width = numberFromData(agg, "Width", DEFAULT_STROKE_WIDTH_MM);
  const style = refLocalName(dataValue(getData(agg, "DashStyle"))) || "Solid";
  return {
    color: colorFromAggregate(aggregateFromData(agg, "Color")) ?? BLACK,
    width,
    dash: dashPattern(style, width),
  };
}

function parseStroke(node: Element): Stroke {
  return parseStrokeAggregate(aggregateFromData(node, "Stroke"));
}

/**
 * DEXPI primitives carry a single color (the stroke's); FillStyle.Solid
 * means "filled with that color" and Hatch means stroke-colored hatch
 * lines, per the spec's own example SVGs.
 */
function parseFill(node: Element, strokeColor: RgbColor): Fill {
  const style = refLocalName(dataValue(getData(node, "FillStyle")));
  return {
    style: style === "Solid" ? "Solid" : style === "Hatch" ? "Hatch" : "Transparent",
    color: strokeColor,
  };
}

// -----------------------------------------------------------------------------
// Text
// -----------------------------------------------------------------------------

/** "LeftBottom", "CenterCenter", … — the combined TextAlignment enumeration. */
const COMBINED_ALIGNMENT = /^(Left|Center|Right)(Top|Center|Bottom)$/;

export function parseAlignment(node: Element): { h: TextAlignH; v: TextAlignV } {
  const combined = COMBINED_ALIGNMENT.exec(refLocalName(dataValue(getData(node, "Alignment"))));
  let h: TextAlignH = combined?.[1] === "Left" ? "Left" : combined?.[1] === "Right" ? "Right" : "Center";
  let v: TextAlignV = combined?.[2] === "Top" ? "Top" : combined?.[2] === "Bottom" ? "Bottom" : "Center";

  const rawH = refLocalName(dataValue(getData(node, "HorizontalAlignment")));
  if (rawH === "Left" || rawH === "Right") {
    h = rawH;
  }

  const rawV = refLocalName(dataValue(getData(node, "VerticalAlignment")));
  if (rawV === "Top" || rawV === "Bottom") {
    v = rawV;
  }

  return { h, v };
}

/** Fragments of a Core/Diagram.TextTemplate carried by a Text, if any. */
function parseTemplateFragments(node: Element): TemplateFragment[] | null {
  const templateObj = componentObjects(node, "Template")[0];
  if (!templateObj) {
    return null;
  }

  const fragments: TemplateFragment[] = [];
  for (const fragment of componentObjects(templateObj, "Fragments")) {
    const type = fragment.getAttribute("type");
    if (type === "Core/Diagram.AttributeRepresentation") {
      fragments.push({
        kind: "attr",
        attributeName: stringFromData(fragment, "AttributeName"),
        objectId: referenceTargets(fragment, "Object")[0] ?? null,
        repType: refLocalName(dataValue(getData(fragment, "Type"))) || "Value",
      });
    } else if (type === "Core/Diagram.LiteralText") {
      fragments.push({ kind: "literal", text: stringFromData(fragment, "Text") });
    } else {
      // Unsupported fragment kind: resolving the rest would produce a
      // partial label, so the literal Text snapshot stays authoritative.
      return null;
    }
  }
  return fragments.length > 0 ? fragments : null;
}

function parseText(node: Element): TextPrim {
  const { h, v } = parseAlignment(node);
  const template = parseTemplateFragments(node);
  return {
    kind: "text",
    position: pointFromAggregate(aggregateFromData(node, "Position")) ?? { x: 0, y: 0 },
    value: stringFromData(node, "Value") || stringFromData(node, "Text"),
    rotation: numberFromData(node, "Rotation", 0),
    size: numberFromData(node, "Size", numberFromData(node, "Height", DEFAULT_TEXT_SIZE_MM)),
    color: colorFromAggregate(aggregateFromData(node, "Color")) ?? BLACK,
    font: stringFromData(node, "Font"),
    hAlign: h,
    vAlign: v,
    ...(template ? { template } : {}),
  };
}

// -----------------------------------------------------------------------------
// Primitive dispatch
// -----------------------------------------------------------------------------

/**
 * A ConnectorLine's drawn geometry: source node position, inner points,
 * target node position — endpoints resolved by the caller against the
 * document's *NodePosition objects (many connectors carry NO inner points
 * at all, only the two endpoint references).
 */
export function parseConnectorPolyline(
  node: Element,
  sourcePoint: Point | null,
  targetPoint: Point | null,
): ScenePrimitive {
  const points: Point[] = [
    ...(sourcePoint ? [sourcePoint] : []),
    ...pointsFromData(node, "InnerPoints"),
    ...(targetPoint ? [targetPoint] : []),
  ];
  return { kind: "polyline", points, stroke: parseStroke(node) };
}

/**
 * Parses one Core/Diagram.* leaf element into a scene primitive, or null for
 * non-primitive types (groups, usages, connector lines — handled by
 * sceneGraph.ts, which resolves connector endpoints).
 */
export function parsePrimitive(node: Element): ScenePrimitive | null {
  switch (node.getAttribute("type")) {
    case "Core/Diagram.PolyLine":
      return { kind: "polyline", points: pointsFromData(node, "Points"), stroke: parseStroke(node) };
    case "Core/Diagram.Polygon": {
      const stroke = parseStroke(node);
      return {
        kind: "polygon",
        points: pointsFromData(node, "Points"),
        stroke,
        fill: parseFill(node, stroke.color),
      };
    }
    case "Core/Diagram.Circle": {
      const stroke = parseStroke(node);
      return {
        kind: "circle",
        center: pointFromAggregate(aggregateFromData(node, "Center")) ?? { x: 0, y: 0 },
        radius: numberFromData(node, "Radius", 1),
        stroke,
        fill: parseFill(node, stroke.color),
      };
    }
    case "Core/Diagram.Ellipse": {
      const stroke = parseStroke(node);
      return {
        kind: "ellipse",
        center: pointFromAggregate(aggregateFromData(node, "Center")) ?? { x: 0, y: 0 },
        rx: numberFromData(node, "HorizontalSemiAxis", 1),
        ry: numberFromData(node, "VerticalSemiAxis", 1),
        rotation: numberFromData(node, "Rotation", 0),
        stroke,
        fill: parseFill(node, stroke.color),
      };
    }
    case "Core/Diagram.EllipseArc":
      return {
        kind: "ellipseArc",
        center: pointFromAggregate(aggregateFromData(node, "Center")) ?? { x: 0, y: 0 },
        rx: numberFromData(node, "HorizontalSemiAxis", 1),
        ry: numberFromData(node, "VerticalSemiAxis", 1),
        startAngle: numberFromData(node, "StartAngle", 0),
        endAngle: numberFromData(node, "EndAngle", 360),
        rotation: numberFromData(node, "Rotation", 0),
        stroke: parseStroke(node),
      };
    case "Core/Diagram.Rectangle": {
      const stroke = parseStroke(node);
      return {
        kind: "rect",
        center: pointFromAggregate(aggregateFromData(node, "Center")) ?? { x: 0, y: 0 },
        width: numberFromData(node, "Width", 1),
        height: numberFromData(node, "Height", 1),
        rotation: numberFromData(node, "Rotation", 0),
        stroke,
        fill: parseFill(node, stroke.color),
      };
    }
    case "Core/Diagram.Text":
    case "Core/Diagram.LiteralText":
      return parseText(node);
    default:
      return null;
  }
}
