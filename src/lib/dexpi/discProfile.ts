import { fail, ok, type Result } from "../result.ts";
import { parseAlignment, parsePrimitive } from "./primitives.ts";
import type { Point, RgbColor, ScenePrimitive, StrokeRounding, TextAlignH, TextAlignV } from "./types.ts";
import {
  aggregateFromData,
  colorFromAggregate,
  componentObjects,
  dataValue,
  getData,
  numberFromData,
  numbersFromData,
  pointFromAggregate,
  refLocalName,
  stringFromData,
} from "./xml.ts";

// -----------------------------------------------------------------------------
// DISC profile (DiscProfile.xml, DEXPI 2.1 draft)
//
// A profile carries a Profile/Symbol catalogue. Each symbol has Variants,
// optionally guarded by a Profile/PropertyValueCondition — e.g. a valve
// symbol whose variant depends on the instance's ValvePosition attribute.
// Symbols are referenced from drawings as "DiscProfile/<name>".
// -----------------------------------------------------------------------------

export type VariantCondition = Readonly<{
  /** Bare attribute name, e.g. "ValvePosition". */
  attributeName: string;
  /** Bare enumeration literal, e.g. "NormallyClose". */
  literalValue: string;
}>;

/**
 * A Profile/LabelTemplate: placeholder text plus its full local-space text
 * styling (coordinates in the symbol's own system, like its Primitives).
 * Format reconstructed from the prior-art viewer — the DISC profile spec is
 * not publicly available, so this is best-effort.
 */
export type ProfileLabelTemplate = Readonly<{
  text: string;
  position: Point;
  rotation: number;
  size: number;
  font: string;
  color: RgbColor;
  hAlign: TextAlignH;
  vAlign: TextAlignV;
}>;

export type ProfileSymbolVariant = Readonly<{
  /** Registered ShapeDef id, e.g. "DiscProfile/ND0012#v1". */
  shapeId: string;
  condition: VariantCondition | null;
  primitives: readonly ScenePrimitive[];
  labelTemplates: readonly ProfileLabelTemplate[];
}>;

export type ProfileSymbol = Readonly<{
  name: string;
  variants: readonly ProfileSymbolVariant[];
}>;

/**
 * A Profile/LineStroke definition (DISC Profile 0.5). All lengths in mm.
 * `lateralOffsetMm` is perpendicular to the drawing direction: positive =
 * right, negative = left. Fields the profile omits stay null (color, width,
 * rounding) or empty/zero (dash array, offsets).
 */
export type ProfileLineStroke = Readonly<{
  color: RgbColor | null;
  /** SVG stroke-dasharray semantics; empty = solid. */
  dashArray: readonly number[];
  lateralOffsetMm: number;
  rounding: StrokeRounding | null;
  /** SVG stroke-dashoffset semantics. */
  dashOffsetMm: number;
  widthMm: number | null;
}>;

export type DiscProfile = Readonly<{
  /** Keyed by "DiscProfile/<name>" AND the bare symbol name. */
  symbols: ReadonlyMap<string, ProfileSymbol>;
  /** The profile's heat-trace stroke (non-zero LateralOffset), if any. */
  heatTraceStroke: ProfileLineStroke | null;
}>;

// -----------------------------------------------------------------------------
// Parsing
// -----------------------------------------------------------------------------

function lastSegment(value: string): string {
  return value.split(/[./]/).pop() ?? value;
}

function parseCondition(variant: Element): VariantCondition | null {
  const conditionObj = componentObjects(variant, "Condition")[0];
  if (!conditionObj) {
    return null;
  }

  const propRaw = dataValue(getData(conditionObj, "Property"));
  const valueRaw = dataValue(getData(conditionObj, "Value"));
  const attributeName = typeof propRaw === "string" ? lastSegment(propRaw.trim()) : "";
  const literalValue = typeof valueRaw === "string" ? lastSegment(valueRaw.trim()) : refLocalName(valueRaw);
  if (!attributeName || !literalValue) {
    return null;
  }

  return { attributeName, literalValue };
}

const DEFAULT_LABEL_SIZE_MM = 3.3;
const BLACK: RgbColor = { r: 0, g: 0, b: 0 };

function parseLabelTemplate(lt: Element): ProfileLabelTemplate {
  const { h, v } = parseAlignment(lt);
  return {
    text: stringFromData(lt, "Text"),
    position: pointFromAggregate(aggregateFromData(lt, "Position")) ?? { x: 0, y: 0 },
    rotation: numberFromData(lt, "Rotation", 0),
    size: numberFromData(lt, "Size", DEFAULT_LABEL_SIZE_MM),
    font: stringFromData(lt, "Font") || "Arial",
    color: colorFromAggregate(aggregateFromData(lt, "Color")) ?? BLACK,
    hAlign: h,
    vAlign: v,
  };
}

function parseLineStroke(el: Element): ProfileLineStroke {
  const roundingRaw = refLocalName(dataValue(getData(el, "LineRounding")));
  const width = numberFromData(el, "Width", Number.NaN);
  return {
    color: colorFromAggregate(aggregateFromData(el, "Color")),
    dashArray: numbersFromData(el, "DashArray"),
    lateralOffsetMm: numberFromData(el, "LateralOffset", 0),
    rounding: roundingRaw === "Butt" || roundingRaw === "Round" ? roundingRaw : null,
    dashOffsetMm: numberFromData(el, "Offset", 0),
    widthMm: Number.isFinite(width) ? width : null,
  };
}

/**
 * The spec models heat tracing as a Profile/AggregatedStroke whose first
 * LineStroke (the pipe) has LateralOffset 0 and whose second (the dashed
 * trace) a non-zero one. No published files carry stroke instances yet, so
 * this scans every Profile/LineStroke regardless of nesting and picks the
 * first with a non-zero LateralOffset — best-effort until real examples
 * settle the container format.
 */
function findHeatTraceStroke(dom: Document): ProfileLineStroke | null {
  for (const el of dom.querySelectorAll('Object[type="Profile/LineStroke"]')) {
    const stroke = parseLineStroke(el);
    if (stroke.lateralOffsetMm !== 0) {
      return stroke;
    }
  }
  return null;
}

/**
 * Parses a DiscProfile.xml into a symbol catalogue. Expected failures come
 * back as Result errors, never throws.
 */
export function parseDiscProfile(xmlText: string): Result<DiscProfile> {
  const dom = new DOMParser().parseFromString(xmlText, "text/xml");
  if (dom.querySelector("parsererror")) {
    return fail("Not well-formed XML — the profile could not be parsed.");
  }

  const symbols = new Map<string, ProfileSymbol>();
  for (const symbolEl of dom.querySelectorAll('Object[type="Profile/Symbol"]')) {
    const name = symbolEl.getAttribute("name") ?? symbolEl.getAttribute("id") ?? "";
    if (!name) {
      continue;
    }

    const key = `DiscProfile/${name}`;
    const variants = componentObjects(symbolEl, "Variants").map(
      (variant, index): ProfileSymbolVariant => ({
        shapeId: `${key}#v${index}`,
        condition: parseCondition(variant),
        primitives: componentObjects(variant, "Primitives")
          .map((p) => parsePrimitive(p))
          .filter((p): p is ScenePrimitive => p !== null),
        labelTemplates: componentObjects(variant, "LabelTemplates").map(parseLabelTemplate),
      }),
    );
    if (variants.length === 0) {
      continue;
    }

    const symbol: ProfileSymbol = { name, variants };
    symbols.set(key, symbol);
    symbols.set(name, symbol);
  }
  if (symbols.size === 0) {
    return fail("The file contains no Profile/Symbol catalogue — not a DISC profile.");
  }

  return ok({ symbols, heatTraceStroke: findHeatTraceStroke(dom) });
}

// -----------------------------------------------------------------------------
// Variant selection
// -----------------------------------------------------------------------------

/**
 * Resolves the instance attribute a condition tests, tolerating the bare,
 * DiscProfile/-prefixed and fully-qualified spellings, and compares its bare
 * literal value.
 */
function conditionMatches(condition: VariantCondition, instanceEl: Element | null): boolean {
  if (!instanceEl) {
    return false;
  }

  const raw =
    dataValue(getData(instanceEl, condition.attributeName)) ??
    dataValue(getData(instanceEl, `DiscProfile/${condition.attributeName}`)) ??
    dataValue(getData(instanceEl, `Plant/Piping.${condition.attributeName}`)) ??
    dataValue(getData(instanceEl, `Plant/Instrumentation.${condition.attributeName}`));
  if (raw === null) {
    return false;
  }

  const literal = typeof raw === "string" ? lastSegment(raw.trim()) : refLocalName(raw);
  return literal === condition.literalValue;
}

/** The variant whose condition matches the instance, else the default, else the first. */
export function pickVariant(symbol: ProfileSymbol, instanceEl: Element | null): ProfileSymbolVariant {
  for (const variant of symbol.variants) {
    if (variant.condition && conditionMatches(variant.condition, instanceEl)) {
      return variant;
    }
  }

  const variant = symbol.variants.find((v) => v.condition === null) ?? symbol.variants[0];
  if (!variant) {
    throw new Error("ProfileSymbol without variants");
  }

  return variant;
}
