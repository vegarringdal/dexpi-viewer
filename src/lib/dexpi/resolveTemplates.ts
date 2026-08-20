import type { SceneNode, TemplateFragment } from "./types.ts";
import { formatDataValue, unitSymbol } from "./values.ts";
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
// TextTemplate / AttributeRepresentation resolution
//
// A label Text may carry a TextTemplate whose fragments reference live
// attribute values ("<TagName>", "<DesignPressure> <Units>", …). The literal
// Text is only a baked snapshot; resolving keeps labels correct when the
// data and the snapshot disagree. Resolution runs once at parse time.
// -----------------------------------------------------------------------------

export type LookupIndex = Readonly<{
  byId: ReadonlyMap<string, Element>;
  /** id → nearest id-bearing children (for the 2-hop related-object search). */
  childrenOf: ReadonlyMap<string, readonly string[]>;
  /** id → References targets (any property). */
  referencesOf: ReadonlyMap<string, readonly string[]>;
}>;

export function buildLookupIndex(root: Element): LookupIndex {
  const byId = new Map<string, Element>();
  const childrenOf = new Map<string, string[]>();
  const referencesOf = new Map<string, string[]>();
  for (const el of root.querySelectorAll("Object[id]")) {
    const id = el.getAttribute("id");
    if (!id) {
      continue;
    }

    byId.set(id, el);
    let parent = el.parentElement;
    while (parent && !parent.getAttribute?.("id")) {
      parent = parent.parentElement;
    }
    const parentId = parent?.getAttribute("id");
    if (parentId) {
      const list = childrenOf.get(parentId) ?? [];
      list.push(id);
      childrenOf.set(parentId, list);
    }

    const targets: string[] = [];
    for (const refs of directChildrenByTag(el, "References")) {
      for (const raw of (refs.getAttribute("objects") ?? "").split(/\s+/)) {
        const target = raw.startsWith("#") ? raw.slice(1) : raw;
        if (target) {
          targets.push(target);
        }
      }
    }
    if (targets.length > 0) {
      referencesOf.set(id, targets);
    }
  }
  return { byId, childrenOf, referencesOf };
}

/** Own Data value, tolerating exact, bare and DiscProfile/-prefixed names. */
function ownAttribute(el: Element, attributeName: string): DataValue | undefined {
  const bare = attributeName.split("/").pop() ?? attributeName;
  for (const name of [attributeName, bare, `DiscProfile/${bare}`]) {
    const data = getData(el, name);
    if (data) {
      return dataValue(data);
    }
  }
  return undefined;
}

/**
 * The attribute's value on the object — or, when absent there, on the
 * nearest related object within two hops of Components children and
 * References targets (breadth-first; several standard label templates name
 * attributes that live on a referenced object, not the labelled one).
 */
export function lookupAttribute(
  index: LookupIndex,
  objectId: string,
  attributeName: string,
): DataValue | undefined {
  const start = index.byId.get(objectId);
  if (start) {
    const direct = ownAttribute(start, attributeName);
    if (direct !== undefined) {
      return direct;
    }
  }

  const seen = new Set<string>([objectId]);
  let frontier: readonly string[] = [objectId];
  for (let depth = 0; depth < 2 && frontier.length > 0; depth++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const neighbor of [...(index.childrenOf.get(id) ?? []), ...(index.referencesOf.get(id) ?? [])]) {
        if (seen.has(neighbor)) {
          continue;
        }

        seen.add(neighbor);
        const el = index.byId.get(neighbor);
        if (el) {
          const value = ownAttribute(el, attributeName);
          if (value !== undefined) {
            return value;
          }
        }
        next.push(neighbor);
      }
    }
    frontier = next;
  }
  return undefined;
}

function isElement(value: DataValue): value is Element {
  return typeof value === "object" && value !== null && "tagName" in value;
}

/**
 * Formats per the AttributeRepresentationType (Value | Units | ValueAndUnits).
 * Drawing labels always use conventional unit symbols — the "spec unit names"
 * setting only affects the Properties panel, never the rendered diagram.
 */
export function formatForRepresentation(value: DataValue, repType: string): string {
  if (isElement(value) && value.getAttribute("type") === "Core/PhysicalQuantities.PhysicalQuantity") {
    const magnitude = numberFromData(value, "Value", Number.NaN);
    const rawUnit = dataValue(getData(value, "Unit"));
    const unit = isDataReference(rawUnit) ? unitSymbol(rawUnit.target, "symbol") : refLocalName(rawUnit);
    if (repType === "Units") {
      return unit;
    }

    const text = Number.isNaN(magnitude) ? "" : String(magnitude);
    return repType === "ValueAndUnits" ? [text, unit].filter(Boolean).join(" ") : text;
  }

  return formatDataValue(value, "symbol");
}

// -----------------------------------------------------------------------------
// Entry point
// -----------------------------------------------------------------------------

/**
 * Replaces every templated text primitive's value with its resolved template
 * text (fragment by fragment). Fragments that fail to resolve contribute
 * nothing; if the whole template resolves empty, the literal snapshot stays.
 */
export function resolveTemplateTexts(root: Element, nodes: readonly SceneNode[]): SceneNode[] {
  const hasTemplates = nodes.some(
    (n) => n.kind === "prim" && n.prim.kind === "text" && n.prim.template !== undefined,
  );
  if (!hasTemplates) {
    return [...nodes];
  }

  const index = buildLookupIndex(root);

  const resolveFragment = (fragment: TemplateFragment, fallbackObjectId: string | null): string => {
    if (fragment.kind === "literal") {
      return fragment.text;
    }

    const objectId = fragment.objectId ?? fallbackObjectId;
    if (!objectId || !fragment.attributeName) {
      return "";
    }

    const value = lookupAttribute(index, objectId, fragment.attributeName);
    return value === undefined ? "" : formatForRepresentation(value, fragment.repType);
  };

  return nodes.map((node) => {
    if (node.kind !== "prim" || node.prim.kind !== "text" || !node.prim.template) {
      return node;
    }

    const resolved = node.prim.template.map((f) => resolveFragment(f, node.objectId)).join("");
    if (resolved.trim().length === 0) {
      return node;
    }

    return { ...node, prim: { ...node.prim, value: resolved } };
  });
}
