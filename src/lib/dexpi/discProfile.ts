import { fail, ok, type Result } from "../result.ts";
import { parseAlignment, parsePrimitive } from "./primitives.ts";
import type { Point, RgbColor, ScenePrimitive, StrokeRounding, TextAlignH, TextAlignV } from "./types.ts";
import {
  aggregateFromData,
  colorFromAggregate,
  componentObjects,
  dataValue,
  directChildrenByTag,
  getData,
  isDataReference,
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
 * Format originally reconstructed from the prior-art viewer; now verified
 * against the official DiscProfile 0.6.3 catalogue
 * (refrences/discdexpi-2026pack/, regression-tested in
 * discProfileOfficial.test.ts).
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

/**
 * A Profile/NodePosition: a symbol's declared attachment point, in the
 * symbol's own coordinate system. `type` is the bare
 * Profile/NodePositionType literal — Piping, Instrumentation, Auxiliary or
 * Label in the 0.6.3 catalogue, but read as an open string so a future
 * profile's new literal shows up rather than being dropped.
 */
export type ProfileNodePosition = Readonly<{
  position: Point;
  type: string;
}>;

export type ProfileSymbolVariant = Readonly<{
  /** Registered ShapeDef id, e.g. "DiscProfile/ND0012#v1". */
  shapeId: string;
  condition: VariantCondition | null;
  primitives: readonly ScenePrimitive[];
  labelTemplates: readonly ProfileLabelTemplate[];
  nodePositions: readonly ProfileNodePosition[];
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

/** Data properties of one published InformationModel instance, as strings. */
export type ProfileInstanceData = ReadonlyMap<string, string>;

export type DiscProfile = Readonly<{
  /** Keyed by "DiscProfile/<name>" AND the bare symbol name. */
  symbols: ReadonlyMap<string, ProfileSymbol>;
  /** The profile's heat-trace stroke (non-zero LateralOffset), if any. */
  heatTraceStroke: ProfileLineStroke | null;
  /**
   * Profile-published signal-line strokes keyed by the representation
   * literal ("ElectricalSignalConveying" → stroke). Empty for Profile
   * 0.6.3; when populated, these override the viewer's built-in signal
   * convention unless Settings prefers the built-in.
   */
  signalStrokes: ReadonlyMap<string, ProfileLineStroke>;
  /**
   * Published instances from the profile's packages (e.g. the TypeCode
   * catalogues: ProcessInstrumentationFunctionTypeCodes.MotorControlCenter
   * carries Abbreviation "MCC"). Keyed by the qualified name drawings
   * reference ("<Model>/<Pkg>.<Pkg>.<Name>") AND its model-less suffix.
   */
  instances: ReadonlyMap<string, ProfileInstanceData>;
  /**
   * Extension class hierarchy: qualified class name ("DiscProfile/
   * InformationModel.WedgeGateValve") → its declared superTypes (relative
   * "/InformationModel.X" spellings normalized to the qualified form).
   * Lets model validation judge references that target extension classes.
   */
  classSupers: ReadonlyMap<string, readonly string[]>;
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

const UNTYPED_NODE_POSITION = "Untyped";

function parseNodePosition(np: Element): ProfileNodePosition {
  return {
    position: pointFromAggregate(aggregateFromData(np, "Position")) ?? { x: 0, y: 0 },
    type: refLocalName(dataValue(getData(np, "Type"))) || UNTYPED_NODE_POSITION,
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
 * Profile-published signal-line strokes, keyed by the
 * SignalConveyingFunctionTypeRepresentation literal they style. Profile
 * 0.6.3 publishes none (the viewer's built-in convention applies); when a
 * future profile does, it wins by default — a LineStroke counts as a
 * signal style when it (or an ancestor) is named after a representation
 * literal ("…ElectricalSignalConveying"). Best-effort until the container
 * format is published.
 */
function collectSignalStrokes(dom: Document): Map<string, ProfileLineStroke> {
  const out = new Map<string, ProfileLineStroke>();
  const literal = /((?:[A-Z][a-z]*)*SignalConveying)$/;
  for (const el of dom.querySelectorAll('Object[type="Profile/LineStroke"]')) {
    let current: Element | null = el;
    while (current) {
      const match = literal.exec(current.getAttribute("name") ?? "");
      const key = match?.[1];
      if (key) {
        if (!out.has(key)) {
          out.set(key, parseLineStroke(el));
        }
        break;
      }

      current = current.parentElement;
    }
  }
  return out;
}

/**
 * Collects the named instance Objects nested in the profile's Packages
 * (TypeCode catalogues and the like) so drawing References into the
 * published model ("DiscProfile/InformationModel.….MotorControlCenter")
 * can resolve to their Data (e.g. Abbreviation).
 */
function collectInstances(dom: Document): Map<string, ProfileInstanceData> {
  const instances = new Map<string, ProfileInstanceData>();
  const walk = (container: Element, path: string): void => {
    for (const pkg of directChildrenByTag(container, "Package")) {
      const pkgName = pkg.getAttribute("name");
      walk(pkg, pkgName ? (path ? `${path}.${pkgName}` : pkgName) : path);
    }
    for (const obj of directChildrenByTag(container, "Object")) {
      const name = obj.getAttribute("name");
      if (!name || !path) {
        continue;
      }

      const attrs = new Map<string, string>();
      for (const data of directChildrenByTag(obj, "Data")) {
        const property = data.getAttribute("property");
        const value = dataValue(data);
        const text = typeof value === "string" ? value : isDataReference(value) ? refLocalName(value) : "";
        if (property && text) {
          attrs.set(property, text);
        }
      }
      if (attrs.size > 0) {
        const modelName = dom.documentElement.getAttribute("name") ?? "DiscProfile";
        instances.set(`${modelName}/${path}.${name}`, attrs);
        instances.set(`${path}.${name}`, attrs);
      }
    }
  };
  walk(dom.documentElement, "");
  return instances;
}

/**
 * Collects the extension class hierarchy declared by ConcreteClass/
 * AbstractClass elements (superTypes attribute; space-separated, relative
 * "/Pkg.Name" spellings resolved against the profile's model name).
 */
function collectClassSupers(dom: Document): Map<string, readonly string[]> {
  const modelName = dom.documentElement.getAttribute("name") ?? "DiscProfile";
  const supers = new Map<string, readonly string[]>();
  const walk = (container: Element, path: string): void => {
    for (const child of container.children) {
      if (child.tagName === "Package") {
        const pkgName = child.getAttribute("name");
        walk(child, pkgName ? (path ? `${path}.${pkgName}` : pkgName) : path);
        continue;
      }

      if (child.tagName !== "ConcreteClass" && child.tagName !== "AbstractClass") {
        continue;
      }

      const name = child.getAttribute("name");
      if (!name || !path) {
        continue;
      }

      const parents = (child.getAttribute("superTypes") ?? "")
        .split(/\s+/)
        .filter((t) => t.length > 0)
        .map((t) => (t.startsWith("/") ? `${modelName}${t}` : t));
      supers.set(`${modelName}/${path}.${name}`, parents);
    }
  };
  walk(dom.documentElement, "");
  return supers;
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
        nodePositions: componentObjects(variant, "NodePositions").map(parseNodePosition),
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

  return ok({
    symbols,
    heatTraceStroke: findHeatTraceStroke(dom),
    signalStrokes: collectSignalStrokes(dom),
    instances: collectInstances(dom),
    classSupers: collectClassSupers(dom),
  });
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
