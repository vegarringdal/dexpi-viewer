import type { Point, RgbColor } from "./types.ts";

// -----------------------------------------------------------------------------
// DEXPI XML low-level reading
//
// DEXPI 2.0 XML is a generic object graph: <Object id type> carrying
// <Data property> values, <Components property> child objects, and
// <References property objects="#id …"> links. These helpers read that
// grammar; primitives.ts/sceneGraph.ts interpret it.
// -----------------------------------------------------------------------------

export type DataReference = Readonly<{ kind: "ref"; target: string }>;

export type DataValue = string | number | boolean | DataReference | Element | null;

export function directChildrenByTag(node: Element, tag: string): Element[] {
  const out: Element[] = [];
  for (const child of node.children) {
    if (child.tagName === tag) {
      out.push(child);
    }
  }
  return out;
}

/** Objects under `<Components property=…>` children (all Components when property is null). */
export function componentObjects(node: Element, property: string | null = null): Element[] {
  return directChildrenByTag(node, "Components")
    .filter((c) => !property || c.getAttribute("property") === property)
    .flatMap((c) => directChildrenByTag(c, "Object"));
}

/** Target ids from `<References property=…>` children, `#` prefix stripped. */
export function referenceTargets(node: Element, property: string | null = null): string[] {
  return directChildrenByTag(node, "References")
    .filter((r) => !property || r.getAttribute("property") === property)
    .flatMap((r) => (r.getAttribute("objects") ?? "").split(/\s+/))
    .filter((t) => t.length > 0)
    .map((t) => (t.startsWith("#") ? t.slice(1) : t));
}

export function getData(node: Element, property: string): Element | undefined {
  return directChildrenByTag(node, "Data").find((d) => d.getAttribute("property") === property);
}

function typedValue(el: Element): DataValue {
  switch (el.tagName) {
    case "String":
    case "DateTime":
      return el.textContent ?? "";
    case "Boolean":
      return (el.textContent ?? "").trim() === "true";
    case "Integer":
      return Number.parseInt(el.textContent ?? "0", 10);
    case "Double":
      return Number.parseFloat(el.textContent ?? "0");
    case "DataReference":
      return { kind: "ref", target: el.getAttribute("data") ?? "" };
    case "AggregatedDataValue":
      return el;
    case "Undefined":
      return null;
    default:
      return el.textContent?.trim() ?? null;
  }
}

/**
 * The typed value inside a <Data> element. AggregatedDataValue elements are
 * returned as-is for the caller to interpret (points, colors, strokes…).
 */
export function dataValue(dataNode: Element | undefined): DataValue {
  const first = dataNode?.firstElementChild;
  return first ? typedValue(first) : null;
}

/** ALL typed values inside a <Data> element — multi-valued properties
 *  (InnerPoints, …) carry one child per value. */
export function dataValues(dataNode: Element | undefined): DataValue[] {
  return [...(dataNode?.children ?? [])].map(typedValue);
}

export function stringFromData(node: Element, property: string): string {
  const v = dataValue(getData(node, property));
  return typeof v === "string" ? v : "";
}

export function numberFromData(node: Element, property: string, fallback: number): number {
  const v = dataValue(getData(node, property));
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

export function booleanFromData(node: Element, property: string): boolean {
  return dataValue(getData(node, property)) === true;
}

/** Bare local name of a DataReference/dotted-string enum value ("…FillStyle.Solid" → "Solid"). */
export function refLocalName(value: DataValue): string {
  const raw = typeof value === "string" ? value : isDataReference(value) ? value.target : "";
  const lastDot = raw.split(".").pop() ?? "";
  return lastDot.split("/").pop() ?? "";
}

export function isDataReference(value: DataValue): value is DataReference {
  return typeof value === "object" && value !== null && "kind" in value && value.kind === "ref";
}

// -----------------------------------------------------------------------------
// Aggregated values
// -----------------------------------------------------------------------------

function isElement(value: DataValue): value is Element {
  return typeof value === "object" && value !== null && "tagName" in value;
}

/** The AggregatedDataValue element stored under `<Data property=…>`, if any. */
export function aggregateFromData(node: Element, property: string): Element | null {
  const v = dataValue(getData(node, property));
  return isElement(v) ? v : null;
}

export function pointFromAggregate(agg: Element | null): Point | null {
  if (!agg) {
    return null;
  }

  return { x: numberFromData(agg, "X", 0), y: numberFromData(agg, "Y", 0) };
}

export function colorFromAggregate(agg: Element | null): RgbColor | null {
  if (!agg) {
    return null;
  }

  return {
    r: numberFromData(agg, "R", 0),
    g: numberFromData(agg, "G", 0),
    b: numberFromData(agg, "B", 0),
  };
}

/** All finite numbers in a `<Data>` node holding a list of Double values. */
export function numbersFromData(node: Element, property: string): number[] {
  const data = getData(node, property);
  if (!data) {
    return [];
  }

  return directChildrenByTag(data, "Double")
    .map((d) => Number.parseFloat(d.textContent ?? ""))
    .filter((n) => Number.isFinite(n));
}

/** All points in a `<Data>` node holding a list of Point aggregates. */
export function pointsFromData(node: Element, property: string): Point[] {
  const data = getData(node, property);
  if (!data) {
    return [];
  }

  return directChildrenByTag(data, "AggregatedDataValue")
    .map((agg) => pointFromAggregate(agg))
    .filter((p): p is Point => p !== null);
}
