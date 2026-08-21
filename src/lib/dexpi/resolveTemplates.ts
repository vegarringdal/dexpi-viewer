import { isRenderableLabelValue } from "./labelPolicy.ts";
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

/** Comparable identity of a DataValue, for same-depth ambiguity checks. */
function valueKey(value: DataValue): string {
  if (value === null) {
    return "null";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return `${typeof value}:${String(value)}`;
  }

  if (isDataReference(value)) {
    return `ref:${value.target}`;
  }

  return `el:${value.outerHTML}`;
}

/**
 * The attribute's value on the object — or, when absent there, on the
 * nearest related object within two hops of Components children and
 * References targets (breadth-first; several standard label templates name
 * attributes that live on a referenced object, not the labelled one).
 * When several objects at the SAME hop distance carry the attribute with
 * differing values (e.g. a PropertyBreak's nested logical-break records),
 * no single one owns it — picking any would be arbitrary, so the lookup
 * reports the attribute as unresolved (director's rule: a value may only
 * be used when its ownership is unambiguous).
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
    let found: { readonly value: DataValue } | null = null;
    let isAmbiguous = false;
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
            if (!found) {
              found = { value };
            } else if (valueKey(found.value) !== valueKey(value)) {
              isAmbiguous = true;
            }
          }
        }
        next.push(neighbor);
      }
    }
    if (found) {
      return isAmbiguous ? undefined : found.value;
    }
    frontier = next;
  }
  return undefined;
}

function isElement(value: DataValue): value is Element {
  return typeof value === "object" && value !== null && "tagName" in value;
}

/**
 * Attribute lookup for DRAWING text: the spec pairs enumeration/quantity
 * attributes with a `<Attr>Representation` twin holding the readable code
 * ("FailAction: FailRetainPosition" ↔ "FailActionRepresentation: FM") and
 * says graphics should reference the representation — so when a template
 * names the base attribute, the representation wins if the object carries
 * one. Panels keep showing the raw data; this is display-text only.
 */
export function lookupDisplayAttribute(
  index: LookupIndex,
  objectId: string,
  attributeName: string,
): DataValue | undefined {
  if (!attributeName.endsWith("Representation")) {
    const representation = lookupAttribute(index, objectId, `${attributeName}Representation`);
    if (representation !== undefined) {
      return representation;
    }
  }

  return lookupAttribute(index, objectId, attributeName);
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

type TemplatedTextRef = Readonly<{
  /** Position in the input node list. */
  index: number;
  /** The current literal snapshot value. */
  literal: string;
  /** The full-template result, or null when any fragment failed. */
  resolved: string | null;
}>;

/**
 * Node indices whose template assignment is ambiguous within one
 * represented-object label context: two or more texts with DISTINCT
 * non-empty literals (separate label parts — prefix, type code, marker,
 * sequence/suffix…) resolving to the SAME non-empty result. Replacing that
 * subset would erase the distinct parts with duplicates, so its literals
 * stay. Detection is per identical-result subset, not whole-context: an
 * independent sibling label (reference/status text with its own template
 * and a different result) neither becomes part of the main tag nor stops
 * the tag parts from being protected, and a text whose result is unique in
 * the context still updates normally.
 */
function collectAmbiguousIndices(refs: readonly TemplatedTextRef[]): Set<number> {
  const byResult = new Map<string, TemplatedTextRef[]>();
  for (const ref of refs) {
    const result = ref.resolved?.trim() ?? "";
    if (result.length === 0) {
      continue;
    }

    const subset = byResult.get(result) ?? [];
    subset.push(ref);
    byResult.set(result, subset);
  }

  const ambiguous = new Set<number>();
  for (const subset of byResult.values()) {
    if (subset.length < 2) {
      continue;
    }

    const literals = new Set(subset.map((r) => r.literal.trim()).filter((v) => v.length > 0));
    if (literals.size > 1) {
      for (const ref of subset) {
        ambiguous.add(ref.index);
      }
    }
  }
  return ambiguous;
}

/**
 * Replaces every templated text primitive's value with its resolved template
 * text — but only all-or-nothing (director's rule): the label's XML `Text`
 * value is the real display value, and the template may replace it only when
 * EVERY attribute fragment resolves to a non-empty value. A fragment that is
 * missing its target, unsupported, or resolves empty keeps the original
 * snapshot unchanged — never a partial concatenation of the fragments that
 * happened to resolve.
 *
 * Replacement is also gated per represented-object label context (director's
 * rule): texts of one object's labels — inside one Label group OR spread
 * over sibling one-text label groups — that hold distinct literal parts but
 * resolve to one identical result are an ambiguous assignment; resolving
 * would repeat one value in every position, so those literals stay (see
 * collectAmbiguousIndices).
 *
 * Enum display policy (director's rule, e.g. slope labels): an enumeration
 * reference resolves through its published display mapping — the
 * `<Attr>Representation` twin — when one exists. Without a mapping the only
 * available text is the raw technical local name ("Sloped"), which must not
 * overwrite a non-empty authored literal; the short human-readable label in
 * the XML wins. The raw name is still used when the literal is empty or a
 * sentinel — better than a blank label. The viewer never converts a
 * classification into a directional word.
 */
export function resolveTemplateTexts(root: Element, nodes: readonly SceneNode[]): SceneNode[] {
  const hasTemplates = nodes.some(
    (n) => n.kind === "prim" && n.prim.kind === "text" && n.prim.template !== undefined,
  );
  if (!hasTemplates) {
    return [...nodes];
  }

  const index = buildLookupIndex(root);

  type ResolvedFragment = Readonly<{
    text: string;
    /** The value is a bare enum reference shown by its technical local name. */
    isRawEnumName: boolean;
  }>;

  /** null = the fragment failed to resolve (missing, unsupported, or empty). */
  const resolveFragment = (
    fragment: TemplateFragment,
    fallbackObjectId: string | null,
  ): ResolvedFragment | null => {
    if (fragment.kind === "literal") {
      return { text: fragment.text, isRawEnumName: false };
    }

    const objectId = fragment.objectId ?? fallbackObjectId;
    if (!objectId || !fragment.attributeName) {
      return null;
    }

    const value = lookupDisplayAttribute(index, objectId, fragment.attributeName);
    if (value === undefined) {
      return null;
    }

    const formatted = formatForRepresentation(value, fragment.repType);
    if (!isRenderableLabelValue(formatted)) {
      return null;
    }

    return { text: formatted, isRawEnumName: isDataReference(value) };
  };

  const resolveTemplate = (
    template: readonly TemplateFragment[],
    fallbackObjectId: string | null,
  ): ResolvedFragment | null => {
    const parts: string[] = [];
    let usedRawEnumName = false;
    for (const fragment of template) {
      const part = resolveFragment(fragment, fallbackObjectId);
      if (part === null) {
        return null;
      }

      parts.push(part.text);
      usedRawEnumName = usedRawEnumName || part.isRawEnumName;
    }
    return { text: parts.join(""), isRawEnumName: usedRawEnumName };
  };

  // Pass 1: resolve every templated text and group the refs by the label
  // they belong to — sibling texts of one label share the represented
  // object id and role; texts without an object id stand alone.
  const groups = new Map<string, TemplatedTextRef[]>();
  nodes.forEach((node, nodeIndex) => {
    if (node.kind !== "prim" || node.prim.kind !== "text" || !node.prim.template) {
      return;
    }

    const literal = node.prim.value;
    const result = resolveTemplate(node.prim.template, node.objectId);
    // Enum display policy: a technical-only result (raw enum local name,
    // no Representation mapping) never replaces an authored, renderable
    // label — the short human-readable literal wins.
    const resolved =
      result === null || (result.isRawEnumName && isRenderableLabelValue(literal)) ? null : result.text;

    const key = node.objectId ? `${node.objectId} ${node.role}` : `#${nodeIndex}`;
    const refs = groups.get(key) ?? [];
    refs.push({ index: nodeIndex, literal, resolved });
    groups.set(key, refs);
  });

  // Pass 2: apply unambiguous results; ambiguous same-result subsets keep
  // every literal.
  const accepted = new Map<number, string>();
  for (const refs of groups.values()) {
    const ambiguous = collectAmbiguousIndices(refs);
    for (const ref of refs) {
      if (!ambiguous.has(ref.index) && ref.resolved !== null && ref.resolved.trim().length > 0) {
        accepted.set(ref.index, ref.resolved);
      }
    }
  }

  return nodes.map((node, nodeIndex) => {
    const resolved = accepted.get(nodeIndex);
    if (resolved === undefined || node.kind !== "prim" || node.prim.kind !== "text") {
      return node;
    }

    return { ...node, prim: { ...node.prim, value: resolved } };
  });
}
