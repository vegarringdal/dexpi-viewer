import { directChildrenByTag } from "./xml.ts";

// -----------------------------------------------------------------------------
// Full-fidelity JSON view of one <Object> element — Inspect's "Copy as
// JSON". Unlike the plant model's display strings, nothing is folded or
// formatted: every Data value keeps its type, aggregates and components
// recurse, multi-valued properties become arrays.
// -----------------------------------------------------------------------------

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function valueToJson(el: Element): JsonValue {
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
      return { $ref: el.getAttribute("data") ?? "" };
    case "Undefined":
      return null;
    case "AggregatedDataValue":
      return objectElementToJson(el);
    default:
      return el.textContent?.trim() ?? null;
  }
}

/** Recursive JSON of an <Object> (or <AggregatedDataValue>) element. */
export function objectElementToJson(el: Element): JsonValue {
  const out: { [key: string]: JsonValue } = { type: el.getAttribute("type") ?? "" };
  const id = el.getAttribute("id");
  if (id) {
    out.id = id;
  }

  const data: { [key: string]: JsonValue } = {};
  for (const d of directChildrenByTag(el, "Data")) {
    const name = d.getAttribute("property");
    if (!name) {
      continue;
    }

    const values = [...d.children].map(valueToJson);
    data[name] = values.length === 1 ? (values[0] ?? null) : values;
  }
  if (Object.keys(data).length > 0) {
    out.data = data;
  }

  const references: { [key: string]: JsonValue } = {};
  for (const r of directChildrenByTag(el, "References")) {
    const name = r.getAttribute("property");
    if (!name) {
      continue;
    }

    const targets = (r.getAttribute("objects") ?? "")
      .split(/\s+/)
      .filter((t) => t.length > 0)
      .map((t) => (t.startsWith("#") ? t.slice(1) : t));
    const existing = references[name];
    references[name] = Array.isArray(existing) ? [...existing, ...targets] : targets;
  }
  if (Object.keys(references).length > 0) {
    out.references = references;
  }

  const components: { [key: string]: JsonValue } = {};
  for (const c of directChildrenByTag(el, "Components")) {
    const name = c.getAttribute("property");
    if (!name) {
      continue;
    }

    const objects = directChildrenByTag(c, "Object").map(objectElementToJson);
    const existing = components[name];
    components[name] = Array.isArray(existing) ? [...existing, ...objects] : objects;
  }
  if (Object.keys(components).length > 0) {
    out.components = components;
  }

  return out;
}
