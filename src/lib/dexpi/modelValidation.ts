import { type MetaModel, type MetaProperty, resolveMetaModel } from "./metaModel.ts";
import type { ValidationIssue } from "./validation.ts";
import { dataValue, directChildrenByTag, elementXPath, isDataReference, refLocalName } from "./xml.ts";

// -----------------------------------------------------------------------------
// Model-driven validation (M10)
//
// Validates every base-model object against the DEXPI information model the
// DOCUMENT DECLARES (via its data.dexpi.org Import URIs; see metaModel.ts):
// unknown classes and properties, missing required properties, illegal
// enumeration values, reference cardinality and target-class compatibility.
// Namespaced names ("DiscProfile/…", vendor prefixes) are extension
// territory and out of base-model scope.
// -----------------------------------------------------------------------------

type ResolvedClass = Readonly<{
  isAbstract: boolean;
  /** Own + inherited properties; the nearest (most-derived) wins. */
  properties: ReadonlyMap<string, MetaProperty>;
  /** The class and every ancestor, for target-class compatibility. */
  ancestry: ReadonlySet<string>;
}>;

const resolvedCaches = new WeakMap<MetaModel, Map<string, ResolvedClass | null>>();

function resolveClass(model: MetaModel, type: string): ResolvedClass | null {
  let cache = resolvedCaches.get(model);
  if (!cache) {
    cache = new Map();
    resolvedCaches.set(model, cache);
  }
  const cached = cache.get(type);
  if (cached !== undefined) {
    return cached;
  }

  const cls = model.classes[type];
  if (!cls) {
    cache.set(type, null);
    return null;
  }

  const properties = new Map<string, MetaProperty>();
  const ancestry = new Set<string>([type]);
  for (const superType of cls.superTypes) {
    const parent = resolveClass(model, superType);
    if (parent) {
      for (const [name, prop] of parent.properties) {
        properties.set(name, prop);
      }
      for (const ancestor of parent.ancestry) {
        ancestry.add(ancestor);
      }
    }
  }
  for (const prop of cls.properties) {
    properties.set(prop.name, prop);
  }
  const resolved: ResolvedClass = { isAbstract: cls.isAbstract, properties, ancestry };
  cache.set(type, resolved);
  return resolved;
}

/** True when `type` (or an ancestor) is `target` — reference compatibility. */
function isCompatible(model: MetaModel, type: string, target: string): boolean {
  return resolveClass(model, type)?.ancestry.has(target) ?? false;
}

/**
 * Compatibility that also chases EXTENSION classes (profile-declared
 * superTypes): a DiscProfile/InformationModel.WedgeGateValve reaching
 * Plant/Piping.OperatedValve through the profile hierarchy is compatible.
 * A type unknown to both the model and the extensions cannot be judged —
 * treated as compatible (skip), never guessed at.
 */
function extendedCompatible(
  model: MetaModel,
  extensionSupers: ReadonlyMap<string, readonly string[]>,
  targetType: string,
  required: string,
): boolean {
  const visited = new Set<string>();
  const queue = [targetType];
  let sawKnown = false;
  while (queue.length > 0) {
    const type = queue.pop();
    if (type === undefined || visited.has(type)) {
      continue;
    }

    visited.add(type);
    if (resolveClass(model, type)) {
      sawKnown = true;
      if (isCompatible(model, type, required)) {
        return true;
      }
      continue;
    }
    const supers = extensionSupers.get(type);
    if (supers) {
      sawKnown = true;
      queue.push(...supers);
    }
  }
  return !sawKnown;
}

/** One aggregated finding: how many times it occurred, plus the first
 *  occurrence that is addressable (its owner id and the exact element),
 *  which is what the panel jumps to and the CSV report locates. */
type Aggregate = { count: number; firstId: string | null; first: Element };

function bump(map: Map<string, Aggregate>, key: string, element: Element, objectId: string | null): void {
  const entry = map.get(key);
  if (!entry) {
    map.set(key, { count: 1, firstId: objectId, first: element });
    return;
  }

  entry.count += 1;
  if (entry.firstId === null && objectId !== null) {
    entry.firstId = objectId;
    entry.first = element;
  }
}

/** `{ xpath }` when the element is known, nothing when it isn't. */
function xpathOf(el: Element | undefined): Readonly<{ xpath?: string }> {
  return el ? { xpath: elementXPath(el) } : {};
}

function nearestId(el: Element): string | null {
  let current: Element | null = el;
  while (current) {
    const id = current.getAttribute("id");
    if (id) {
      return id;
    }

    current = current.parentElement;
  }
  return null;
}

/**
 * Runs the model-driven rule family (MDL-*) over every base-model object,
 * against the model version the document declares (fallback reported as
 * MDL-000 so a 2.1 file is never silently judged by 2.0 tables).
 */
const NO_EXTENSIONS: ReadonlyMap<string, readonly string[]> = new Map();

export function validateAgainstModel(
  root: Element,
  extensionSupers: ReadonlyMap<string, readonly string[]> = NO_EXTENSIONS,
): ValidationIssue[] {
  const { model, declaredVersion, isExactMatch } = resolveMetaModel(root);
  const issues: ValidationIssue[] = [];
  if (!isExactMatch && declaredVersion !== null) {
    issues.push({
      ruleId: "MDL-000",
      severity: "warning",
      message: `The document declares DEXPI model version ${declaredVersion}, but this build carries no tables for it — validating against ${model.version} instead.`,
      objectId: null,
      suggestion: "Model findings may be off where the versions differ; update the app's model tables.",
    });
  }

  const topModels = new Set(model.topModels);
  const datatypes = new Set(model.datatypes);
  const typesById = new Map<string, string>();
  for (const el of root.querySelectorAll("Object[id]")) {
    const id = el.getAttribute("id");
    if (id) {
      typesById.set(id, el.getAttribute("type") ?? "");
    }
  }

  const unknownClasses = new Map<string, Aggregate>();
  const abstractClasses = new Map<string, Aggregate>();
  const unknownData = new Map<string, Aggregate>();
  const unknownReferences = new Map<string, Aggregate>();
  const unknownComponents = new Map<string, Aggregate>();

  for (const el of root.querySelectorAll("Object[type]")) {
    const type = el.getAttribute("type") ?? "";
    if (!topModels.has(type.split("/")[0] ?? "") || datatypes.has(type)) {
      continue;
    }

    const objectId = nearestId(el);
    const cls = resolveClass(model, type);
    if (!cls) {
      bump(unknownClasses, type, el, objectId);
      continue;
    }

    if (cls.isAbstract) {
      bump(abstractClasses, type, el, objectId);
    }

    const presentNames = new Set<string>();
    const referenceCounts = new Map<string, number>();
    const referenceElements = new Map<string, Element>();

    for (const data of directChildrenByTag(el, "Data")) {
      const name = data.getAttribute("property") ?? "";
      if (!name || name.includes("/")) {
        continue;
      }

      const prop = cls.properties.get(name);
      if (!prop) {
        bump(unknownData, `${type}|${name}`, data, objectId);
        continue;
      }

      const value = dataValue(data);
      if (value !== null) {
        presentNames.add(name);
      }
      if (prop.kind === "enum" && prop.target && value !== null) {
        const literal = refLocalName(value);
        const literals = model.enums[prop.target] ?? [];
        const wrongEnumPath = isDataReference(value) && !value.target.startsWith(`${prop.target}.`);
        if (literal && (!literals.includes(literal) || wrongEnumPath)) {
          issues.push({
            ruleId: "MDL-004",
            severity: "error",
            message:
              wrongEnumPath && literals.includes(literal)
                ? `"${name}" on ${type} references "${literal}" via the wrong enumeration (expected ${prop.target}).`
                : `"${literal}" is not a literal of ${prop.target} (property "${name}" on ${type}).`,
            objectId,
            suggestion: `Use one of the ${String(literals.length)} literals the DEXPI ${model.version} model defines for ${prop.target}.`,
            attributeName: name,
            xpath: elementXPath(data),
          });
        }
      }
    }

    for (const comp of directChildrenByTag(el, "Components")) {
      const name = comp.getAttribute("property") ?? "";
      if (!name || name.includes("/")) {
        continue;
      }

      presentNames.add(name);
      const prop = cls.properties.get(name);
      if (!prop) {
        bump(unknownComponents, `${type}|${name}`, comp, objectId);
        continue;
      }

      if (prop.kind === "composition" && prop.upper !== null) {
        const childCount = directChildrenByTag(comp, "Object").length;
        if (childCount > prop.upper) {
          issues.push({
            ruleId: "MDL-006",
            severity: "error",
            message: `"${name}" on ${type} holds ${String(childCount)} components; the model allows at most ${String(prop.upper)}.`,
            objectId,
            suggestion: "Remove the extra components.",
            xpath: elementXPath(comp),
          });
        }
      }
    }

    for (const refs of directChildrenByTag(el, "References")) {
      const name = refs.getAttribute("property") ?? "";
      if (!name || name.includes("/")) {
        continue;
      }

      presentNames.add(name);
      const prop = cls.properties.get(name);
      if (!prop) {
        bump(unknownReferences, `${type}|${name}`, refs, objectId);
        continue;
      }

      const targets = (refs.getAttribute("objects") ?? "")
        .split(/\s+/)
        .filter((t) => t.length > 0)
        .map((t) => (t.startsWith("#") ? t.slice(1) : t));
      referenceCounts.set(name, (referenceCounts.get(name) ?? 0) + targets.length);
      if (!referenceElements.has(name)) {
        referenceElements.set(name, refs);
      }

      if ((prop.kind === "reference" || prop.kind === "composition") && prop.target) {
        for (const target of targets) {
          if (target.includes("/")) {
            continue; // published-model target — outside base-model scope
          }

          const targetType = typesById.get(target);
          if (targetType && !extendedCompatible(model, extensionSupers, targetType, prop.target)) {
            issues.push({
              ruleId: "MDL-007",
              severity: "error",
              message: `"${name}" on ${type} points at "${target}" (${targetType}), which is not a ${prop.target}.`,
              objectId,
              suggestion: `The model requires a ${prop.target} (or a subclass) here.`,
              xpath: elementXPath(refs),
            });
          }
        }
      }
    }

    for (const [name, count] of referenceCounts) {
      const prop = cls.properties.get(name);
      if (prop && prop.upper !== null && count > prop.upper) {
        issues.push({
          ruleId: "MDL-006",
          severity: "error",
          message: `"${name}" on ${type} carries ${String(count)} reference targets; the model allows at most ${String(prop.upper)}.`,
          objectId,
          suggestion: "Remove the extra reference targets.",
          ...xpathOf(referenceElements.get(name)),
        });
      }
    }

    for (const [name, prop] of cls.properties) {
      if (prop.lower >= 1 && !presentNames.has(name)) {
        issues.push({
          ruleId: "MDL-003",
          severity: "error",
          message: `Required property "${name}" is missing on ${type} (lower bound = 1 per the DEXPI ${model.version} information model).`,
          objectId,
          suggestion: `Add "${name}" with a value.`,
          attributeName: name,
          xpath: elementXPath(el),
        });
      }
    }
  }

  for (const [type, agg] of unknownClasses) {
    issues.push({
      ruleId: "MDL-001",
      severity: "warning",
      message: `Unknown class "${type}" (${String(agg.count)}×) — not in the DEXPI ${model.version} information model.`,
      objectId: agg.firstId,
      suggestion: "Check the type name against the spec, or namespace-prefix extension classes.",
      xpath: elementXPath(agg.first),
    });
  }
  for (const [type, agg] of abstractClasses) {
    issues.push({
      ruleId: "MDL-009",
      severity: "error",
      message: `Abstract class "${type}" is instantiated (${String(agg.count)}×).`,
      objectId: agg.firstId,
      suggestion: "Use a concrete subclass.",
      xpath: elementXPath(agg.first),
    });
  }
  const aggregated: ReadonlyArray<readonly [Map<string, Aggregate>, string, string]> = [
    [unknownData, "MDL-002", "Data property"],
    [unknownReferences, "MDL-005", "References property"],
    [unknownComponents, "MDL-008", "Components property"],
  ];
  for (const [map, ruleId, label] of aggregated) {
    for (const [key, agg] of map) {
      const [type, name] = key.split("|");
      issues.push({
        ruleId,
        severity: "warning",
        message: `${label} "${name ?? ""}" is not defined for ${type ?? ""} (${String(agg.count)}×).`,
        objectId: agg.firstId,
        suggestion: "Check the property name against the spec, or namespace-prefix extension attributes.",
        xpath: elementXPath(agg.first),
        ...(name ? { attributeName: name } : {}),
      });
    }
  }
  return issues;
}
