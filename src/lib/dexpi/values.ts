import {
  type DataValue,
  dataValue,
  directChildrenByTag,
  getData,
  isDataReference,
  numberFromData,
  refLocalName,
} from "./xml.ts";

// -----------------------------------------------------------------------------
// Attribute value formatting
//
// Turns a raw Data value — including AggregatedDataValue trees like
// PhysicalQuantity, PhysicalQuantityVector and MultiLanguageString — into a
// human-readable string for the properties panel and tree labels.
// -----------------------------------------------------------------------------

function isElement(value: DataValue): value is Element {
  return typeof value === "object" && value !== null && "tagName" in value;
}

/** Display symbols for the spec's unit literals (fallback: the literal name). */
const UNIT_SYMBOLS: Readonly<Record<string, string>> = {
  Bar: "bar",
  Millibar: "mbar",
  Pascal: "Pa",
  Kilopascal: "kPa",
  Megapascal: "MPa",
  DegreeCelsius: "°C",
  Kelvin: "K",
  Millimetre: "mm",
  Centimetre: "cm",
  Metre: "m",
  Kilometre: "km",
  Watt: "W",
  Kilowatt: "kW",
  Megawatt: "MW",
  MetreCubed: "m³",
  MetreSquared: "m²",
  MetreCubedPerHour: "m³/h",
  LitrePerMinute: "L/min",
  KilogramPerHour: "kg/h",
  KilogramPerSecond: "kg/s",
  KilomolePerSecond: "kmol/s",
  KilogramPerMetreCubed: "kg/m³",
  ReciprocalMinute: "1/min",
  ReciprocalSecond: "1/s",
  Percent: "%",
  Tonne: "t",
  Kilogram: "kg",
  Gram: "g",
};

export type UnitDisplayMode = "symbol" | "name";

/**
 * Default unit rendering for attribute/property formatting: conventional
 * symbols ("kW", "°C", "barg") or the spec's own enumeration literals
 * ("Kilowatt", "DegreeCelsius", "Bar"). Only affects callers that don't pass
 * an explicit mode — drawing labels always format with "symbol". Formatting
 * happens at parse time, so switching requires re-parsing the document
 * (rendering.actions handles that).
 */
let unitDisplayMode: UnitDisplayMode = "symbol";

export function setUnitDisplayMode(mode: UnitDisplayMode): void {
  unitDisplayMode = mode;
}

/**
 * Display text for a unit DataReference target. Symbol mode honours the
 * quantity class: "…PressureGaugeUnit.Bar" → "barg",
 * "…TemperatureUnit.DegreeCelsius" → "°C" (unknown literals fall back to
 * their bare name). Name mode returns the spec literal verbatim.
 */
export function unitSymbol(target: string, mode: UnitDisplayMode = unitDisplayMode): string {
  const parts = target.split(/[./]/);
  const literal = parts.pop() ?? "";
  const unitClass = parts.pop() ?? "";
  if (mode === "name") {
    return literal;
  }

  const symbol = UNIT_SYMBOLS[literal] ?? literal;
  if (symbol === "bar" && unitClass.includes("Gauge")) {
    return "barg";
  }

  if (symbol === "bar" && unitClass.includes("Absolute")) {
    return "bara";
  }

  return symbol;
}

/** Display unit for a PhysicalQuantity aggregate. */
function unitName(agg: Element, mode: UnitDisplayMode): string {
  const raw = dataValue(getData(agg, "Unit"));
  if (isDataReference(raw)) {
    return unitSymbol(raw.target, mode);
  }

  return refLocalName(raw);
}

function formatAggregate(agg: Element, mode: UnitDisplayMode): string {
  const type = agg.getAttribute("type") ?? "";
  if (type === "Core/PhysicalQuantities.PhysicalQuantity") {
    const value = numberFromData(agg, "Value", Number.NaN);
    return [Number.isNaN(value) ? "?" : String(value), unitName(agg, mode)].filter(Boolean).join(" ");
  }

  if (type === "Core/PhysicalQuantities.PhysicalQuantityVector") {
    const values = getData(agg, "Values");
    const parts = values
      ? directChildrenByTag(values, "Double").map((d) => (d.textContent ?? "").trim())
      : [];
    return [parts.join(", "), unitName(agg, mode)].filter(Boolean).join(" ");
  }

  if (type === "Core/DataTypes.MultiLanguageString") {
    const singles = directChildrenByTag(agg, "Data")
      .filter((d) => d.getAttribute("property") === "SingleLanguageStrings")
      .map((d) => dataValue(d))
      .filter(isElement)
      .map((s) => formatDataValue(dataValue(getData(s, "Value")), mode));
    return singles.filter((s) => s.length > 0).join(" ");
  }

  if (type === "Core/DataTypes.SingleLanguageString") {
    return formatDataValue(dataValue(getData(agg, "Value")), mode);
  }

  if (type === "Core/Diagram.Point") {
    return `(${numberFromData(agg, "X", 0)}, ${numberFromData(agg, "Y", 0)})`;
  }

  const entries = directChildrenByTag(agg, "Data")
    .map((d) => `${d.getAttribute("property")}: ${formatDataValue(dataValue(d), mode)}`)
    .join(", ");
  const localType = type.split(".").pop() ?? type;
  return entries ? `${localType} { ${entries} }` : localType;
}

/** Renders any Data value down to display text ("" for null/empty). */
export function formatDataValue(value: DataValue, mode: UnitDisplayMode = unitDisplayMode): string {
  if (value === null) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (isDataReference(value)) {
    return refLocalName(value);
  }

  return formatAggregate(value, mode);
}
