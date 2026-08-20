import { buildLookupIndex, lookupAttribute } from "./resolveTemplates.ts";
import {
  componentObjects,
  directChildrenByTag,
  numberFromData,
  referenceTargets,
  stringFromData,
} from "./xml.ts";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type IssueSeverity = "error" | "warning" | "info";

export type ValidationIssue = Readonly<{
  ruleId: string;
  severity: IssueSeverity;
  message: string;
  /** Object to select/zoom to when the issue is clicked, if addressable. */
  objectId: string | null;
  /** How to fix it. */
  suggestion?: string;
}>;

/** Panel group titles per rule. */
export const RULE_TITLES: Readonly<Record<string, string>> = {
  V01: "Duplicate object ids",
  V02: "Dangling references",
  V03: "Unknown catalogue shapes",
  V04: "Undrawable connector lines",
  V05: "Unconnected flow items",
  V06: "Missing diagram extent",
  V07: "Orphaned piping nodes",
  V08: "Missing required meta data",
  V09: "Invalid template attribute references",
};

// -----------------------------------------------------------------------------
// Rules
//
// A deliberately small, high-confidence starter set (M6): structural XML
// integrity and drawing-topology basics. Engineering-semantics rules can
// grow here later, one function per rule.
// -----------------------------------------------------------------------------

/** V01 — every object id must be unique (one finding per reused id). */
function checkDuplicateIds(root: Element, issues: ValidationIssue[]): void {
  const counts = new Map<string, number>();
  for (const el of root.querySelectorAll("Object[id]")) {
    const id = el.getAttribute("id");
    if (id) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  for (const [id, count] of counts) {
    if (count > 1) {
      issues.push({
        ruleId: "V01",
        severity: "error",
        message: `Duplicate object id "${id}" (${count} occurrences).`,
        objectId: id,
        suggestion: "Give every object a unique id — duplicated ids break references and selection.",
      });
    }
  }
}

/** V02 — every References target must exist in the document. */
function checkDanglingReferences(root: Element, ids: ReadonlySet<string>, issues: ValidationIssue[]): void {
  for (const refs of root.querySelectorAll("References")) {
    const owner = refs.parentElement;
    const ownerId = owner?.getAttribute("id") ?? null;
    for (const raw of (refs.getAttribute("objects") ?? "").split(/\s+/)) {
      const target = raw.startsWith("#") ? raw.slice(1) : raw;
      if (target && !ids.has(target)) {
        issues.push({
          ruleId: "V02",
          severity: "error",
          message: `Reference "${refs.getAttribute("property") ?? "?"}" points to missing object "${target}".`,
          objectId: ownerId,
          suggestion: "Remove the reference or add the missing object.",
        });
      }
    }
  }
}

/** V03 — every ShapeUsage/SymbolUsage must resolve to a catalogue Shape. */
function checkShapeUsages(root: Element, issues: ValidationIssue[]): void {
  const shapeIds = new Set<string>();
  for (const catalogue of root.querySelectorAll('Object[type="Core/Diagram.ShapeCatalogue"]')) {
    for (const shape of componentObjects(catalogue, "Shapes")) {
      const id = shape.getAttribute("id");
      if (id) {
        shapeIds.add(id);
      }
    }
  }
  for (const usage of root.querySelectorAll(
    'Object[type="Core/Diagram.ShapeUsage"], Object[type="Profile/SymbolUsage"]',
  )) {
    const ref = [...referenceTargets(usage, "Shape"), ...referenceTargets(usage, "Symbol")][0];
    if (ref && !shapeIds.has(ref)) {
      issues.push({
        ruleId: "V03",
        severity: "error",
        message: `Shape usage references unknown catalogue shape "${ref}".`,
        objectId: nearestId(usage),
        suggestion: "Add the shape to a ShapeCatalogue, or load the DISC profile that defines it.",
      });
    }
  }
}

/** V04 — ConnectorLines need resolvable endpoints or enough inner points. */
function checkConnectorLines(root: Element, ids: ReadonlySet<string>, issues: ValidationIssue[]): void {
  for (const line of root.querySelectorAll('Object[type="Core/Diagram.ConnectorLine"]')) {
    const source = referenceTargets(line, "Source")[0];
    const target = referenceTargets(line, "Target")[0];
    const innerPoints = directChildrenByTag(line, "Data").find(
      (d) => d.getAttribute("property") === "InnerPoints",
    );
    const innerCount = innerPoints ? directChildrenByTag(innerPoints, "AggregatedDataValue").length : 0;
    const endpoints = (source && ids.has(source) ? 1 : 0) + (target && ids.has(target) ? 1 : 0);
    if (endpoints + innerCount < 2) {
      issues.push({
        ruleId: "V04",
        severity: "warning",
        message: "ConnectorLine has fewer than two resolvable points and cannot be drawn.",
        objectId: nearestId(line),
        suggestion: "Give the connector Source/Target node positions or at least two InnerPoints.",
      });
    }
  }
}

/** V05 — flow items (pipes/streams) should have both a source and a target. */
function checkFlowEndpoints(root: Element, issues: ValidationIssue[]): void {
  for (const el of root.querySelectorAll(
    'Object[type="Plant/Piping.Pipe"], Object[type="Process/Process.Stream"]',
  )) {
    const hasSource = referenceTargets(el, "Source").length + referenceTargets(el, "SourceItem").length > 0;
    const hasTarget = referenceTargets(el, "Target").length + referenceTargets(el, "TargetItem").length > 0;
    if (!hasSource || !hasTarget) {
      const missing = [!hasSource ? "source" : null, !hasTarget ? "target" : null]
        .filter(Boolean)
        .join(" and ");
      issues.push({
        ruleId: "V05",
        severity: "warning",
        message: `Flow item is missing its ${missing} connection.`,
        objectId: el.getAttribute("id"),
        suggestion: "Connect the item, or confirm it intentionally ends at a drawing boundary (off-page).",
      });
    }
  }
}

/** V06 — a Diagram should declare a usable extent. */
function checkDiagramExtent(root: Element, issues: ValidationIssue[]): void {
  for (const diagram of root.querySelectorAll('Object[type="Core/Diagram.Diagram"]')) {
    const width = numberFromData(diagram, "MaxX", 0) - numberFromData(diagram, "MinX", 0);
    const height = numberFromData(diagram, "MaxY", 0) - numberFromData(diagram, "MinY", 0);
    if (width <= 0 || height <= 0) {
      issues.push({
        ruleId: "V06",
        severity: "warning",
        message: "Diagram declares no usable Min/Max extent; bounds were computed from geometry.",
        objectId: diagram.getAttribute("id"),
        suggestion: "Set MinX/MinY/MaxX/MaxY on the Diagram object.",
      });
    }
  }
}

/** V07 — a PipingNode should be the source or target of some connection. */
function checkOrphanedPipingNodes(root: Element, issues: ValidationIssue[]): void {
  const targeted = new Set<string>();
  for (const refs of root.querySelectorAll("References")) {
    const property = refs.getAttribute("property");
    if (property !== "SourceNode" && property !== "TargetNode") {
      continue;
    }

    for (const raw of (refs.getAttribute("objects") ?? "").split(/\s+/)) {
      targeted.add(raw.startsWith("#") ? raw.slice(1) : raw);
    }
  }
  for (const node of root.querySelectorAll('Object[type="Plant/Piping.PipingNode"]')) {
    const id = node.getAttribute("id");
    if (id && !targeted.has(id)) {
      issues.push({
        ruleId: "V07",
        severity: "warning",
        message: `PipingNode "${id}" is not referenced by any connection.`,
        objectId: id,
        suggestion: "Connect this piping node to a pipe connection, or remove it if unused.",
      });
    }
  }
}

const REQUIRED_META_PROPS = [
  "OriginatingSystemName",
  "OriginatingSystemVendorName",
  "OriginatingSystemVersion",
  "ExportDateTime",
] as const;

/** V08 — the DEXPI 2.0 meta model requires the EngineeringModel provenance data. */
function checkRequiredMetaData(root: Element, issues: ValidationIssue[]): void {
  const engineering = root.querySelector('Object[type="Core/EngineeringModel"]');
  if (!engineering) {
    return;
  }

  for (const property of REQUIRED_META_PROPS) {
    if (!stringFromData(engineering, property)) {
      issues.push({
        ruleId: "V08",
        severity: "error",
        message: `Required Data property "${property}" is missing on Core/EngineeringModel (lower bound = 1 per the DEXPI 2.0 meta model).`,
        objectId: engineering.getAttribute("id"),
        suggestion: `Add Data property "${property}" with a value.`,
      });
    }
  }
}

/** V09 — every AttributeRepresentation must resolve on (or near) its object. */
function checkTemplateAttributeReferences(root: Element, issues: ValidationIssue[]): void {
  const fragments = [...root.querySelectorAll('Object[type="Core/Diagram.AttributeRepresentation"]')];
  if (fragments.length === 0) {
    return;
  }

  const index = buildLookupIndex(root);
  for (const fragment of fragments) {
    const attributeName = stringFromData(fragment, "AttributeName");
    const objectId = referenceTargets(fragment, "Object")[0];
    if (!attributeName || !objectId) {
      continue;
    }

    if (lookupAttribute(index, objectId, attributeName) === undefined) {
      const type = index.byId.get(objectId)?.getAttribute("type") ?? "unknown type";
      issues.push({
        ruleId: "V09",
        severity: "error",
        message: `AttributeName "${attributeName}" is not a valid or reachable attribute of "${objectId}" (${type}). This template fragment resolves to blank text.`,
        objectId,
        suggestion:
          "Correct the AttributeName to a valid property of the object (or one it directly references), or remove the fragment.",
      });
    }
  }
}

// -----------------------------------------------------------------------------
// Helpers & entry point
// -----------------------------------------------------------------------------

/** Nearest ancestor-or-self id, for issues on anonymous drawing elements. */
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

/** Runs all rules; errors first, then warnings, in rule order. */
export function validateDocument(root: Element): ValidationIssue[] {
  const ids = new Set<string>();
  for (const el of root.querySelectorAll("Object[id]")) {
    const id = el.getAttribute("id");
    if (id) {
      ids.add(id);
    }
  }

  const issues: ValidationIssue[] = [];
  checkDuplicateIds(root, issues);
  checkDanglingReferences(root, ids, issues);
  checkShapeUsages(root, issues);
  checkConnectorLines(root, ids, issues);
  checkFlowEndpoints(root, issues);
  checkDiagramExtent(root, issues);
  checkOrphanedPipingNodes(root, issues);
  checkRequiredMetaData(root, issues);
  checkTemplateAttributeReferences(root, issues);
  const rank: Record<IssueSeverity, number> = { error: 0, warning: 1, info: 2 };
  return issues.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
