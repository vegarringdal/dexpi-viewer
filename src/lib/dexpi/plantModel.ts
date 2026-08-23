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
function elementXPath(el: Element): string {
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

function walkPlant(
  node: Element,
  parentId: string | null,
  byId: Map<string, PlantNode>,
  referencedBy: Map<string, IncomingReference[]>,
  elementsById: Map<string, Element>,
  includeDiagram: boolean,
): PlantNode | null {
  const type = node.getAttribute("type") ?? "";
  if (isValueObject(type)) {
    return null;
  }
  if (!includeDiagram && isDiagramType(type)) {
    return null;
  }

  const xpath = elementXPath(node);
  const explicitId = node.getAttribute("id") ?? "";
  // Drawing objects in real files carry no ids — in diagram mode the
  // positional XPath stands in as a stable synthetic identity.
  const id = explicitId || (includeDiagram ? xpath : "");
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
  const children = componentObjects(node)
    .map((child) => walkPlant(child, id, byId, referencedBy, elementsById, includeDiagram))
    .filter((c): c is PlantNode => c !== null);

  const plantNode: PlantNode = {
    id,
    type,
    typeName,
    label: resolveLabel(attributes, explicitId || typeName),
    parentId,
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

/**
 * Extracts the conceptual object hierarchy (the "plant"/process structure)
 * for the tree and properties panels. Diagram objects are excluded; Core
 * value objects (QualifiedValue etc.) are folded into their owner's
 * attributes instead of appearing as tree nodes.
 *
 * With `includeDiagram` the walk also keeps Core/Diagram objects (which
 * carry no ids in real files — their positional XPath becomes a synthetic
 * id) and starts from the document root so the Diagram trees are reached —
 * the Inspect panel's "drawing" mode.
 */
export function buildPlantModel(root: Element, includeDiagram = false): PlantModel {
  const byId = new Map<string, PlantNode>();
  const referencedBy = new Map<string, IncomingReference[]>();
  const elementsById = new Map<string, Element>();
  const roots: PlantNode[] = [];

  const engineering = root.querySelector('Object[type="Core/EngineeringModel"]');
  const wrapped = engineering
    ? includeDiagram
      ? componentObjects(engineering)
      : componentObjects(engineering, "ConceptualModel")
    : [];
  const startNodes = wrapped.length > 0 ? wrapped : directChildrenByTag(root, "Object");

  for (const start of startNodes) {
    const node = walkPlant(start, null, byId, referencedBy, elementsById, includeDiagram);
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

  const model = buildPlantModel(root, true);
  fullModels.set(root, model);
  return model;
}
