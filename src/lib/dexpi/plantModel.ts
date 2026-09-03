import { formatDataValue } from "./values.ts";
import { componentObjects, dataValue, dataValues, directChildrenByTag, getData } from "./xml.ts";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type PlantAttribute = Readonly<{ name: string; value: string }>;

export type PlantReference = Readonly<{ property: string; targets: readonly string[] }>;

export type PlantNode = Readonly<{
  id: string;
  type: string;
  /** Bare class name, e.g. "Process.Stream". */
  typeName: string;
  label: string;
  parentId: string | null;
  /** The `<Components property=…>` bucket this object was found under in
   *  its parent (e.g. "ActuatingSystems"); "" for top-level roots. */
  ownerProperty: string;
  /** Core/PersistentIdentifier entries (name = Context, value = Value). */
  persistentIds: readonly PlantAttribute[];
  attributes: readonly PlantAttribute[];
  /** Data properties present in the XML but carrying <Undefined/> / empty
   *  values — shown (never hidden), but kept out of `attributes` so value
   *  consumers (classification, labels) cannot pick up placeholders. */
  undefinedAttributes: readonly string[];
  /** Outgoing References (property → target ids). */
  references: readonly PlantReference[];
  /** Positional XPath of the object's element in the source XML. */
  xpath: string;
  children: readonly PlantNode[];
}>;

export type IncomingReference = Readonly<{ fromId: string; property: string }>;

/** Which `EngineeringModel` composition(s) `buildPlantModel` walks:
 *  "conceptual" (default) = `ConceptualModel` only; "diagram" = `Diagram`
 *  only (synthetic xpath ids, since real Diagram objects carry none);
 *  "full" = both, merged into one root list (Inspect's "drawing" mode). */
export type PlantModelBranch = "conceptual" | "diagram" | "full";

export type PlantModel = Readonly<{
  roots: readonly PlantNode[];
  byId: ReadonlyMap<string, PlantNode>;
  /** target id → objects referencing it ("Referenced by"). */
  referencedBy: ReadonlyMap<string, readonly IncomingReference[]>;
  /** id → source element, for raw-data tooling (copy as JSON). */
  elementsById: ReadonlyMap<string, Element>;
}>;

// -----------------------------------------------------------------------------
// Classification
// -----------------------------------------------------------------------------

/** Core/* objects (QualifiedValue, quantities, strings) are values, not tree nodes. */
function isValueObject(type: string): boolean {
  return type.startsWith("Core/") && !type.startsWith("Core/Diagram");
}

/**
 * Positional XPath of an element (`/Model/Object[2]/Components[1]/Object[4]`)
 * — pastes into `xmllint --xpath` etc., and pinpoints the element even when
 * ids are duplicated. Indices are 1-based per tag name, XPath-style, and
 * omitted for an only child of its tag.
 */
export function elementXPath(el: Element): string {
  const segments: string[] = [];
  let current: Element | null = el;
  while (current) {
    const parent: Element | null = current.parentElement;
    let index = 1;
    let hasSiblingsOfTag = false;
    if (parent) {
      for (const sibling of parent.children) {
        if (sibling === current) {
          break;
        }
        if (sibling.tagName === current.tagName) {
          index++;
        }
      }
      hasSiblingsOfTag = [...parent.children].filter((s) => s.tagName === current?.tagName).length > 1;
    }
    segments.unshift(hasSiblingsOfTag ? `${current.tagName}[${index}]` : current.tagName);
    current = parent;
  }
  return `/${segments.join("/")}`;
}

/** Drawing-side objects: excluded from the plant model, kept (with synthetic
 *  ids) by the diagram-inclusive model — Inspect renders them dashed. */
export function isDiagramType(type: string): boolean {
  return type.includes("Diagram");
}

const LABEL_PRIORITY = [
  "TagName",
  "DiscProfile/ItemTag",
  "PositionNumber",
  "InstrumentationLoopFunctionNumber",
  "ActuatingSystemNumber",
  "SegmentNumber",
  "SubTagName",
  "DiscProfile/ObjectDisplayName",
  "Identifier",
  "Name",
  "Description",
] as const;

/**
 * The object's display name: a naming/tagging attribute when present, else
 * the raw id (usually already readable — "Pipe1", "ActuatingSystem2"; never
 * shortened here — display truncation is the UI's job). The type is NOT part
 * of the label; it renders separately (tree note column, properties header).
 */
function resolveLabel(attributes: readonly PlantAttribute[], id: string): string {
  for (const key of LABEL_PRIORITY) {
    const found = attributes.find((a) => a.name === key && a.value.length > 0);
    if (found) {
      return found.value;
    }
  }

  return id;
}

// -----------------------------------------------------------------------------
// Walk
// -----------------------------------------------------------------------------

function collectAttributes(node: Element): { attributes: PlantAttribute[]; undefined: string[] } {
  const attributes: PlantAttribute[] = [];
  const undefinedNames: string[] = [];
  for (const data of directChildrenByTag(node, "Data")) {
    const name = data.getAttribute("property") ?? "";
    // Multi-valued properties (InnerPoints, …) carry one child per value.
    const value = dataValues(data)
      .map((v) => formatDataValue(v))
      .filter((v) => v.length > 0)
      .join(" ");
    if (name && value) {
      attributes.push({ name, value });
    } else if (name) {
      undefinedNames.push(name);
    }
  }

  for (const comp of directChildrenByTag(node, "Components")) {
    const property = comp.getAttribute("property") ?? "";
    if (property === "PersistentIdentifiers") {
      continue; // collected separately, with their Context
    }

    for (const child of directChildrenByTag(comp, "Object")) {
      if (!isValueObject(child.getAttribute("type") ?? "")) {
        continue;
      }

      const value = formatDataValue(dataValue(getData(child, "Value")));
      if (property && value) {
        attributes.push({ name: property, value });
      }
    }
  }

  return { attributes, undefined: undefinedNames };
}

function collectPersistentIds(node: Element): PlantAttribute[] {
  const out: PlantAttribute[] = [];
  for (const pid of componentObjects(node, "PersistentIdentifiers")) {
    const context = formatDataValue(dataValue(getData(pid, "Context")));
    const value = formatDataValue(dataValue(getData(pid, "Value")));
    if (value) {
      out.push({ name: context || "Identifier", value });
    }
  }
  return out;
}

function collectReferences(node: Element): PlantReference[] {
  const references: PlantReference[] = [];
  for (const refs of directChildrenByTag(node, "References")) {
    const property = refs.getAttribute("property") ?? "";
    const targets = (refs.getAttribute("objects") ?? "")
      .split(/\s+/)
      .filter((t) => t.length > 0)
      .map((t) => (t.startsWith("#") ? t.slice(1) : t));
    if (property && targets.length > 0) {
      references.push({ property, targets });
    }
  }
  return references;
}

/** Objects under `<Components property=…>` children, paired with the
 *  property name of the block each one was found under. */
function componentObjectsWithProperty(
  node: Element,
): readonly Readonly<{ property: string; element: Element }>[] {
  const out: { property: string; element: Element }[] = [];
  for (const comp of directChildrenByTag(node, "Components")) {
    const property = comp.getAttribute("property") ?? "";
    for (const child of directChildrenByTag(comp, "Object")) {
      out.push({ property, element: child });
    }
  }
  return out;
}

function walkPlant(
  node: Element,
  parentId: string | null,
  ownerProperty: string,
  byId: Map<string, PlantNode>,
  referencedBy: Map<string, IncomingReference[]>,
  elementsById: Map<string, Element>,
  branch: PlantModelBranch,
): PlantNode | null {
  const type = node.getAttribute("type") ?? "";
  if (isValueObject(type)) {
    return null;
  }
  if (branch === "conceptual" && isDiagramType(type)) {
    return null;
  }

  const xpath = elementXPath(node);
  const explicitId = node.getAttribute("id") ?? "";
  // Drawing objects in real files carry no ids — in diagram/full mode the
  // positional XPath stands in as a stable synthetic identity.
  const id = explicitId || (branch !== "conceptual" ? xpath : "");
  if (!id) {
    return null;
  }

  const typeName = type.split("/").pop() ?? type;
  const collected = collectAttributes(node);
  const attributes = collected.attributes;
  const references = collectReferences(node);
  for (const reference of references) {
    for (const target of reference.targets) {
      const list = referencedBy.get(target) ?? [];
      list.push({ fromId: id, property: reference.property });
      referencedBy.set(target, list);
    }
  }
  const children = componentObjectsWithProperty(node)
    .map(({ property, element }) =>
      walkPlant(element, id, property, byId, referencedBy, elementsById, branch),
    )
    .filter((c): c is PlantNode => c !== null);

  const plantNode: PlantNode = {
    id,
    type,
    typeName,
    label: resolveLabel(attributes, explicitId || typeName),
    parentId,
    ownerProperty,
    persistentIds: collectPersistentIds(node),
    attributes,
    undefinedAttributes: collected.undefined,
    references,
    xpath,
    children,
  };
  byId.set(id, plantNode);
  elementsById.set(id, node);
  return plantNode;
}

// -----------------------------------------------------------------------------
// Entry point
// -----------------------------------------------------------------------------

function normalizeBranch(branch: PlantModelBranch | boolean): PlantModelBranch {
  if (typeof branch === "boolean") {
    return branch ? "full" : "conceptual";
  }
  return branch;
}

/**
 * Extracts the object hierarchy for one `EngineeringModel` composition (or
 * both) for the tree/properties panels. Core value objects (QualifiedValue
 * etc.) are always folded into their owner's attributes instead of
 * appearing as tree nodes.
 *
 * `branch` selects which composition(s) to walk (see `PlantModelBranch`).
 * `true`/`false` are accepted for backward compatibility, mapping to
 * `"full"`/`"conceptual"`. Diagram-side objects (Diagram and full mode)
 * carry no ids in real files — their positional XPath becomes a synthetic
 * id — matching what Inspect's "drawing" mode already relied on.
 */
export function buildPlantModel(
  root: Element,
  branch: PlantModelBranch | boolean = "conceptual",
): PlantModel {
  const mode = normalizeBranch(branch);
  const byId = new Map<string, PlantNode>();
  const referencedBy = new Map<string, IncomingReference[]>();
  const elementsById = new Map<string, Element>();
  const roots: PlantNode[] = [];

  const engineering = root.querySelector('Object[type="Core/EngineeringModel"]');
  const wrapped = engineering
    ? mode === "full"
      ? componentObjects(engineering)
      : componentObjects(engineering, mode === "diagram" ? "Diagram" : "ConceptualModel")
    : [];
  const startNodes = wrapped.length > 0 ? wrapped : directChildrenByTag(root, "Object");

  for (const start of startNodes) {
    const node = walkPlant(start, null, "", byId, referencedBy, elementsById, mode);
    if (node) {
      roots.push(node);
    }
  }
  return { roots, byId, referencedBy, elementsById };
}

const fullModels = new WeakMap<Element, PlantModel>();

/** The diagram-inclusive model for Inspect's "drawing" mode, memoized per document root. */
export function fullPlantModel(root: Element): PlantModel {
  const cached = fullModels.get(root);
  if (cached) {
    return cached;
  }

  const model = buildPlantModel(root, "full");
  fullModels.set(root, model);
  return model;
}

const diagramModels = new WeakMap<Element, PlantModel>();

/** The Diagram-branch-only model for the Diagram Tree panel, memoized per document root. */
export function diagramPlantModel(root: Element): PlantModel {
  const cached = diagramModels.get(root);
  if (cached) {
    return cached;
  }

  const model = buildPlantModel(root, "diagram");
  diagramModels.set(root, model);
  return model;
}

/** Reference properties that tie a Diagram-side object back to the
 *  ConceptualModel object it draws (a shape/group) or annotates (a label). */
export const REPRESENTS_REFERENCE_PROPERTIES = ["Represents", "Object"] as const;

/**
 * The conceptual object a diagram-side node actually draws: `id`'s own
 * Represents/Object reference if it carries one, else the nearest
 * ancestor's — a bare leaf (e.g. a SymbolUsage with no id of its own)
 * represents the same real object as its enclosing group. Null when
 * nothing in the chain up to the root carries one.
 */
export function nearestRepresentedId(model: PlantModel, id: string): string | null {
  let current: PlantNode | undefined = model.byId.get(id);
  while (current) {
    for (const property of REPRESENTS_REFERENCE_PROPERTIES) {
      const target = current.references.find((r) => r.property === property)?.targets[0];
      if (target) {
        return target;
      }
    }
    current = current.parentId ? model.byId.get(current.parentId) : undefined;
  }
  return null;
}

// -----------------------------------------------------------------------------
// Property-grouped view — for the ConceptualModel Tree / Diagram Tree panels
//
// Those panels mirror the raw file structure exactly: each `<Components
// property="X">` bucket becomes an expandable group row between an object
// and its children, instead of `buildPlantModel`'s flat containment (which
// folds every Components block together regardless of property name). Kept
// as a separate, pure transform rather than changing `buildPlantModel`'s
// output: `semanticGraph.ts`'s containment edges, `resolveOwningNode`'s
// ownership walk, and the Properties panel's "Parent" chip all want raw
// physical containment with real `parentId`s, not synthetic group nodes —
// and the existing Explorer/`TopologyPanel` keeps reading `buildPlantModel`
// untouched too.
// -----------------------------------------------------------------------------

const PROPERTY_GROUP_TYPE = "Explorer/PropertyGroup";

function propertyGroupId(parentId: string, property: string): string {
  return `${parentId}::${property}`;
}

function makePropertyGroup(parentId: string, property: string, children: readonly PlantNode[]): PlantNode {
  return {
    id: propertyGroupId(parentId, property),
    type: PROPERTY_GROUP_TYPE,
    typeName: property,
    label: property,
    parentId,
    ownerProperty: property,
    persistentIds: [],
    attributes: [],
    undefinedAttributes: [],
    references: [],
    xpath: "",
    children,
  };
}

/**
 * Rebuilds one node's subtree so its direct children are bucketed under a
 * synthetic group row per distinct `ownerProperty` value, preserving each
 * bucket's original order of first appearance. Recurses first so nested
 * property groups are inserted at every depth.
 */
function groupNodeChildren(node: PlantNode): PlantNode {
  const rebuiltChildren = node.children.map(groupNodeChildren);
  const byProperty = new Map<string, PlantNode[]>();
  const order: string[] = [];
  for (const child of rebuiltChildren) {
    if (!byProperty.has(child.ownerProperty)) {
      byProperty.set(child.ownerProperty, []);
      order.push(child.ownerProperty);
    }
    byProperty.get(child.ownerProperty)?.push(child);
  }

  const children = order.map((property) => {
    const groupId = propertyGroupId(node.id, property);
    const reparented = (byProperty.get(property) ?? []).map((c) => ({ ...c, parentId: groupId }));
    return makePropertyGroup(node.id, property, reparented);
  });

  return { ...node, children };
}

/**
 * Groups every root's descendants by their owning XML property (see the
 * section comment above). Roots themselves are left ungrouped — there is
 * normally exactly one (`PlantModel1` for the conceptual branch, `Diagram1`
 * for the diagram branch), so a top-level wrapper group would add nesting
 * without organizing anything. Pure: does not mutate `plant` —
 * `referencedBy`/`elementsById` are reused as-is (reference data and source
 * elements are unaffected by tree shape).
 */
export function groupByProperty(plant: PlantModel): PlantModel {
  const roots = plant.roots.map(groupNodeChildren);
  const byId = new Map<string, PlantNode>();
  const indexTree = (node: PlantNode): void => {
    byId.set(node.id, node);
    for (const child of node.children) {
      indexTree(child);
    }
  };
  for (const root of roots) {
    indexTree(root);
  }

  return { roots, byId, referencedBy: plant.referencedBy, elementsById: plant.elementsById };
}
