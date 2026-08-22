import { isFlowReferenceProperty } from "./connectivity.ts";
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

/** A per-rule user override: force a severity, or drop the rule's findings. */
export type SeverityOverride = IssueSeverity | "ignore";

export type ValidationCategory = "schema" | "graphics" | "connectivity" | "metadata";

export type ValidationIssue = Readonly<{
  ruleId: string;
  severity: IssueSeverity;
  message: string;
  /** Object to select/zoom to when the issue is clicked, if addressable. */
  objectId: string | null;
  /** How to fix it. */
  suggestion?: string;
}>;

/**
 * Panel group titles per rule. Rule ids are prefixed by category (SCH/GFX/
 * CON/META) — DEXPI publishes no standard error-code catalogue (neither the
 * 2.0 spec nor DEXPI_XML_Schema.xsd defines one), so this is the app's own
 * stable taxonomy. Legacy V01–V09 ids map as documented in DESIGN.md.
 */
export const RULE_TITLES: Readonly<Record<string, string>> = {
  "SCH-001": "Duplicate object ids",
  "SCH-002": "Dangling references",
  "SCH-003": "Invalid object id syntax",
  "SCH-004": "Invalid reference syntax",
  "GFX-001": "Unknown catalogue shapes",
  "GFX-002": "Undrawable connector lines",
  "GFX-003": "Missing diagram extent",
  "CON-001": "Unconnected flow items",
  "CON-002": "Orphaned piping nodes",
  "CON-003": "Unconnected nozzles",
  "CON-004": "Nominal diameter mismatch",
  "CON-005": "Piping class change without property break",
  "META-001": "Missing required meta data",
  "META-002": "Invalid template attribute references",
};

export const CATEGORY_LABELS: Readonly<Record<ValidationCategory, string>> = {
  schema: "Schema",
  graphics: "Graphics",
  connectivity: "Connectivity",
  metadata: "Meta data",
};

/** Category of a rule, derived from its id prefix. */
export function categoryOfRule(ruleId: string): ValidationCategory {
  if (ruleId.startsWith("SCH")) {
    return "schema";
  }

  if (ruleId.startsWith("GFX")) {
    return "graphics";
  }

  if (ruleId.startsWith("CON")) {
    return "connectivity";
  }

  return "metadata";
}

// -----------------------------------------------------------------------------
// Schema rules (SCH) — XML integrity plus the lexical constraints from
// DEXPI_XML_Schema.xsd (the id/name-reference patterns), which the browser's
// DOMParser does not enforce.
// -----------------------------------------------------------------------------

/** SCH-001 — every object id must be unique (one finding per reused id). */
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
        ruleId: "SCH-001",
        severity: "error",
        message: `Duplicate object id "${id}" (${count} occurrences).`,
        objectId: id,
        suggestion: "Give every object a unique id — duplicated ids break references and selection.",
      });
    }
  }
}

/**
 * SCH-002 — every References target must exist in the document. Namespace-
 * qualified targets (containing "/") reference PUBLISHED models, not this
 * document (real DISC sheets reference enum literals like
 * "DiscProfile/InformationModel.…" — same identifier-only stance as the
 * data.dexpi.org model URIs): they are exempt, except `property="Symbol"`
 * catalogue references, which resolve against the loaded DISC profile and
 * aggregate to ONE finding per symbol otherwise (a sheet references the
 * same symbol many times).
 */
function checkDanglingReferences(
  root: Element,
  byId: ReadonlyMap<string, Element>,
  issues: ValidationIssue[],
): void {
  for (const refs of root.querySelectorAll("References")) {
    const owner = refs.parentElement;
    const ownerId = owner?.getAttribute("id") ?? null;
    const property = refs.getAttribute("property") ?? "?";
    for (const raw of (refs.getAttribute("objects") ?? "").split(/\s+/)) {
      const target = raw.startsWith("#") ? raw.slice(1) : raw;
      if (!target || byId.has(target)) {
        continue;
      }

      if (target.includes("/")) {
        continue; // published-model reference (enum literal, profile symbol) — GFX-001 owns catalogue resolution
      }

      issues.push({
        ruleId: "SCH-002",
        severity: "error",
        message: `Reference "${property}" points to missing object "${target}".`,
        objectId: ownerId,
        suggestion: "Remove the reference or add the missing object.",
      });
    }
  }
}

const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z_0-9]*$/;
const NAME_FRAGMENT = "[A-Za-z_][A-Za-z_0-9]*";
/** `#id` or `name?/name(.name)*` — the XSD's name-or-id-reference pattern. */
const REFERENCE_TOKEN_PATTERN = new RegExp(
  `^(#${NAME_FRAGMENT}|(${NAME_FRAGMENT})?/${NAME_FRAGMENT}(\\.${NAME_FRAGMENT})*)$`,
);

/** SCH-003 — object ids must match the schema's identifier pattern. */
function checkIdSyntax(root: Element, issues: ValidationIssue[]): void {
  for (const el of root.querySelectorAll("Object[id]")) {
    const id = el.getAttribute("id");
    if (id && !IDENTIFIER_PATTERN.test(id)) {
      issues.push({
        ruleId: "SCH-003",
        severity: "error",
        message: `Object id "${id}" is not a valid DEXPI identifier (letters, digits, underscores; no leading digit).`,
        objectId: id,
        suggestion: "Rename the id to match [A-Za-z_][A-Za-z_0-9]*.",
      });
    }
  }
}

/** SCH-004 — References tokens must be `#id` or a qualified name reference. */
function checkReferenceSyntax(root: Element, issues: ValidationIssue[]): void {
  for (const refs of root.querySelectorAll("References")) {
    const property = refs.getAttribute("property") ?? "?";
    for (const token of (refs.getAttribute("objects") ?? "").split(/\s+/)) {
      if (token && !REFERENCE_TOKEN_PATTERN.test(token)) {
        issues.push({
          ruleId: "SCH-004",
          severity: "error",
          message: `Reference "${property}" token "${token}" is neither "#id" nor a qualified name reference.`,
          objectId: refs.parentElement?.getAttribute("id") ?? null,
          suggestion:
            'Local objects are referenced as "#TheirId", published-model names as "Model/Name.Name".',
        });
      }
    }
  }
}

// -----------------------------------------------------------------------------
// Graphics rules (GFX) — drawing topology and catalogue resolution.
// -----------------------------------------------------------------------------

/**
 * GFX-001 — every ShapeUsage/SymbolUsage must resolve to a catalogue Shape,
 * either the document's own ShapeCatalogue or the loaded DISC profile.
 * Unresolved PROFILE symbols aggregate to one finding per symbol (a real
 * DISC sheet places the same symbol many times) and are warnings when no
 * profile is loaded at all — the fix is loading one, not editing the file.
 */
function checkShapeUsages(
  root: Element,
  profileSymbols: ReadonlySet<string>,
  issues: ValidationIssue[],
): void {
  const shapeIds = new Set<string>();
  for (const catalogue of root.querySelectorAll('Object[type="Core/Diagram.ShapeCatalogue"]')) {
    for (const shape of componentObjects(catalogue, "Shapes")) {
      const id = shape.getAttribute("id");
      if (id) {
        shapeIds.add(id);
      }
    }
  }

  const unresolvedProfileShapes = new Map<string, number>();
  for (const usage of root.querySelectorAll(
    'Object[type="Core/Diagram.ShapeUsage"], Object[type="Profile/SymbolUsage"]',
  )) {
    const ref = [...referenceTargets(usage, "Shape"), ...referenceTargets(usage, "Symbol")][0];
    if (!ref || shapeIds.has(ref) || profileSymbols.has(ref)) {
      continue;
    }

    if (ref.includes("/")) {
      unresolvedProfileShapes.set(ref, (unresolvedProfileShapes.get(ref) ?? 0) + 1);
      continue;
    }

    issues.push({
      ruleId: "GFX-001",
      severity: "error",
      message: `Shape usage references unknown catalogue shape "${ref}".`,
      objectId: nearestId(usage),
      suggestion: "Add the shape to a ShapeCatalogue, or load the DISC profile that defines it.",
    });
  }

  const hasProfile = profileSymbols.size > 0;
  for (const [ref, count] of unresolvedProfileShapes) {
    // Rootless names like "/Border" are well-known representation shapes
    // (Core/Diagram.Border) whose geometry no published catalogue ships —
    // the exporting tool draws them. Real files carry them routinely, so
    // they warn instead of erroring even with a profile loaded.
    const isWellKnown = ref.startsWith("/");
    issues.push({
      ruleId: "GFX-001",
      severity: hasProfile && !isWellKnown ? "error" : "warning",
      message: isWellKnown
        ? `Shape "${ref}" is a well-known representation shape with no published geometry — the viewer cannot draw it.`
        : hasProfile
          ? `Profile symbol "${ref}" is placed ${count}× but the loaded DISC profile does not define it.`
          : `Profile symbol "${ref}" is placed ${count}× but no DISC profile is loaded.`,
      objectId: null,
      suggestion: isWellKnown
        ? "The exporting tool renders this (e.g. the sheet border); no catalogue provides its geometry."
        : hasProfile
          ? "Load a DISC profile that defines this symbol."
          : "Load the bundled Profile 0.6.3 (or a custom DiscProfile.xml) so profile symbols resolve.",
    });
  }
}

/** GFX-002 — ConnectorLines need resolvable endpoints or enough inner points. */
function checkConnectorLines(
  root: Element,
  byId: ReadonlyMap<string, Element>,
  issues: ValidationIssue[],
): void {
  for (const line of root.querySelectorAll('Object[type="Core/Diagram.ConnectorLine"]')) {
    const source = referenceTargets(line, "Source")[0];
    const target = referenceTargets(line, "Target")[0];
    const innerPoints = directChildrenByTag(line, "Data").find(
      (d) => d.getAttribute("property") === "InnerPoints",
    );
    const innerCount = innerPoints ? directChildrenByTag(innerPoints, "AggregatedDataValue").length : 0;
    const endpoints = (source && byId.has(source) ? 1 : 0) + (target && byId.has(target) ? 1 : 0);
    if (endpoints + innerCount < 2) {
      issues.push({
        ruleId: "GFX-002",
        severity: "warning",
        message: "ConnectorLine has fewer than two resolvable points and cannot be drawn.",
        objectId: nearestId(line),
        suggestion: "Give the connector Source/Target node positions or at least two InnerPoints.",
      });
    }
  }
}

/** GFX-003 — a Diagram should declare a usable extent. */
function checkDiagramExtent(root: Element, issues: ValidationIssue[]): void {
  for (const diagram of root.querySelectorAll('Object[type="Core/Diagram.Diagram"]')) {
    const width = numberFromData(diagram, "MaxX", 0) - numberFromData(diagram, "MinX", 0);
    const height = numberFromData(diagram, "MaxY", 0) - numberFromData(diagram, "MinY", 0);
    if (width <= 0 || height <= 0) {
      issues.push({
        ruleId: "GFX-003",
        severity: "warning",
        message: "Diagram declares no usable Min/Max extent; bounds were computed from geometry.",
        objectId: diagram.getAttribute("id"),
        suggestion: "Set MinX/MinY/MaxX/MaxY on the Diagram object.",
      });
    }
  }
}

// -----------------------------------------------------------------------------
// Connectivity rules (CON) — port-to-port topology and cross-connection
// engineering attributes.
// -----------------------------------------------------------------------------

/** CON-001 — flow items (pipes/streams) should have both a source and a target. */
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
        ruleId: "CON-001",
        severity: "warning",
        message: `Flow item is missing its ${missing} connection.`,
        objectId: el.getAttribute("id"),
        suggestion: "Connect the item, or confirm it intentionally ends at a drawing boundary (off-page).",
      });
    }
  }
}

/** Every id targeted by a flow-family reference (Source/Target family, Inlet, Outlet, …). */
function collectFlowTargets(root: Element): Set<string> {
  const targets = new Set<string>();
  for (const refs of root.querySelectorAll("References")) {
    if (!isFlowReferenceProperty(refs.getAttribute("property") ?? "")) {
      continue;
    }

    for (const raw of (refs.getAttribute("objects") ?? "").split(/\s+/)) {
      const target = raw.startsWith("#") ? raw.slice(1) : raw;
      if (target) {
        targets.add(target);
      }
    }
  }
  return targets;
}

/** CON-002 — a PipingNode should be the source or target of some connection. */
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
        ruleId: "CON-002",
        severity: "warning",
        message: `PipingNode "${id}" is not referenced by any connection.`,
        objectId: id,
        suggestion: "Connect this piping node to a pipe connection, or remove it if unused.",
      });
    }
  }
}

/**
 * CON-003 — a nozzle should be reachable by flow: either the nozzle itself
 * or one of its nodes is targeted by a flow-family reference. Unconnected
 * nozzles are legitimate as spares, so this is informational.
 */
function checkUnconnectedNozzles(root: Element, issues: ValidationIssue[]): void {
  const targets = collectFlowTargets(root);
  for (const nozzle of root.querySelectorAll('Object[type="Plant/ProcessEquipment.Nozzle"]')) {
    const id = nozzle.getAttribute("id");
    if (!id) {
      continue;
    }

    const nodeIds = componentObjects(nozzle, "Nodes")
      .map((n) => n.getAttribute("id"))
      .filter((n): n is string => n !== null);
    if (targets.has(id) || nodeIds.some((n) => targets.has(n))) {
      continue;
    }

    issues.push({
      ruleId: "CON-003",
      severity: "info",
      message: `Nozzle "${id}" has no piping connected to it or its nodes.`,
      objectId: id,
      suggestion: "Connect the nozzle, or confirm it is an intentional spare.",
    });
  }
}

const DN_NUMERIC_PROP = "NominalDiameterNumericalValueRepresentation";
const DN_TEXT_PROP = "NominalDiameterRepresentation";
const SEGMENT_TYPE = "Plant/Piping.PipingNetworkSegment";

type NominalDiameter = Readonly<{ numeric: string; text: string }>;

/** Both nominal-diameter representations of an element, normalized. */
function nominalDiameterOf(el: Element): NominalDiameter {
  const rawNumeric = stringFromData(el, DN_NUMERIC_PROP).trim();
  const parsed = Number.parseFloat(rawNumeric);
  return {
    numeric: rawNumeric && Number.isFinite(parsed) ? String(parsed) : rawNumeric,
    text: stringFromData(el, DN_TEXT_PROP).trim(),
  };
}

/**
 * Compares like representations only (numeric vs numeric, else text vs
 * text) — real files mix "14″" text on one node with a numeric value on its
 * mate, which is not comparable. Returns the differing pair, or null.
 */
function diameterMismatch(a: NominalDiameter, b: NominalDiameter): readonly [string, string] | null {
  if (a.numeric && b.numeric) {
    return a.numeric !== b.numeric ? [a.numeric, b.numeric] : null;
  }

  if (a.text && b.text) {
    return a.text !== b.text ? [a.text, b.text] : null;
  }

  return null;
}

/** Nearest ancestor-or-self PipingNetworkSegment, if any. */
function enclosingSegment(el: Element): Element | null {
  let current: Element | null = el;
  while (current) {
    if (current.getAttribute("type") === SEGMENT_TYPE) {
      return current;
    }

    current = current.parentElement;
  }
  return null;
}

/**
 * CON-004 — the two nodes a connection (Pipe, DirectPipingConnection, …)
 * joins must declare the same nominal diameter. Segments are skipped: their
 * endpoint references legitimately span DN changes (a PipeReducer inside),
 * and they repeat their first/last connection's node pair anyway.
 */
function checkNominalDiameterMismatch(
  root: Element,
  byId: ReadonlyMap<string, Element>,
  issues: ValidationIssue[],
): void {
  const seenPairs = new Set<string>();
  for (const el of root.querySelectorAll("Object")) {
    if (el.getAttribute("type") === SEGMENT_TYPE) {
      continue;
    }

    const sourceNodeId = referenceTargets(el, "SourceNode")[0];
    const targetNodeId = referenceTargets(el, "TargetNode")[0];
    if (!sourceNodeId || !targetNodeId) {
      continue;
    }

    const pairKey = `${sourceNodeId}->${targetNodeId}`;
    if (seenPairs.has(pairKey)) {
      continue;
    }

    seenPairs.add(pairKey);
    const sourceNode = byId.get(sourceNodeId);
    const targetNode = byId.get(targetNodeId);
    if (!sourceNode || !targetNode) {
      continue;
    }

    const mismatch = diameterMismatch(nominalDiameterOf(sourceNode), nominalDiameterOf(targetNode));
    if (mismatch) {
      issues.push({
        ruleId: "CON-004",
        severity: "warning",
        message: `Connection joins mismatched nominal diameters: ${sourceNodeId} = ${mismatch[0]}, ${targetNodeId} = ${mismatch[1]}.`,
        objectId: nearestId(el),
        suggestion: "Align the nominal diameters, or insert a reducer between the two sides.",
      });
    }
  }
}

/** Nearest ancestor-or-self PipingClassCode, walking segment → system. */
function effectivePipingClassOf(el: Element): string {
  let current: Element | null = el;
  while (current) {
    const value = stringFromData(current, "PipingClassCode").trim();
    if (value) {
      return value;
    }

    current = current.parentElement;
  }
  return "";
}

/**
 * CON-005 — when a segment connects to an item that lives in another segment
 * with a different effective PipingClassCode, a PropertyBreak should mark
 * the transition. Informational: class breaks are often intentional.
 */
function checkPipingClassChange(
  root: Element,
  byId: ReadonlyMap<string, Element>,
  issues: ValidationIssue[],
): void {
  const seenPairs = new Set<string>();
  for (const segment of root.querySelectorAll(`Object[type="${SEGMENT_TYPE}"]`)) {
    const segmentId = segment.getAttribute("id");
    const segmentClass = effectivePipingClassOf(segment);
    if (!segmentId || !segmentClass) {
      continue;
    }

    for (const property of ["SourceItem", "TargetItem"]) {
      for (const itemId of referenceTargets(segment, property)) {
        const item = byId.get(itemId);
        if (!item || (item.getAttribute("type") ?? "").endsWith("PropertyBreak")) {
          continue;
        }

        const itemSegment = enclosingSegment(item);
        if (!itemSegment || itemSegment === segment) {
          continue;
        }

        const itemClass = effectivePipingClassOf(item);
        const itemSegmentId = itemSegment.getAttribute("id") ?? itemId;
        const pairKey = [segmentId, itemSegmentId].sort().join("<->");
        if (!itemClass || itemClass === segmentClass || seenPairs.has(pairKey)) {
          continue;
        }

        seenPairs.add(pairKey);
        if (hasPropertyBreak(segment) || hasPropertyBreak(itemSegment)) {
          continue;
        }

        issues.push({
          ruleId: "CON-005",
          severity: "info",
          message: `Piping class changes from "${segmentClass}" to "${itemClass}" between segments "${segmentId}" and "${itemSegmentId}" without a PropertyBreak.`,
          objectId: segmentId,
          suggestion: "Add a PropertyBreak at the transition, or align the piping classes.",
        });
      }
    }
  }
}

function hasPropertyBreak(segment: Element): boolean {
  return segment.querySelector('Object[type$="PropertyBreak"]') !== null;
}

// -----------------------------------------------------------------------------
// Meta-data rules (META)
// -----------------------------------------------------------------------------

const REQUIRED_META_PROPS = [
  "OriginatingSystemName",
  "OriginatingSystemVendorName",
  "OriginatingSystemVersion",
  "ExportDateTime",
] as const;

/** META-001 — the DEXPI 2.0 meta model requires the EngineeringModel provenance data. */
function checkRequiredMetaData(root: Element, issues: ValidationIssue[]): void {
  const engineering = root.querySelector('Object[type="Core/EngineeringModel"]');
  if (!engineering) {
    return;
  }

  for (const property of REQUIRED_META_PROPS) {
    if (!stringFromData(engineering, property)) {
      issues.push({
        ruleId: "META-001",
        severity: "error",
        message: `Required Data property "${property}" is missing on Core/EngineeringModel (lower bound = 1 per the DEXPI 2.0 meta model).`,
        objectId: engineering.getAttribute("id"),
        suggestion: `Add Data property "${property}" with a value.`,
      });
    }
  }
}

/** META-002 — every AttributeRepresentation must resolve on (or near) its object. */
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
        ruleId: "META-002",
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

const SEVERITY_RANK: Readonly<Record<IssueSeverity, number>> = { error: 0, warning: 1, info: 2 };

function sortBySeverity(issues: ValidationIssue[]): ValidationIssue[] {
  return issues.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

/**
 * Applies per-rule severity overrides to raw findings: "ignore" drops a
 * rule's findings, a severity value replaces theirs. The result is re-sorted
 * errors-first like validateDocument's output.
 */
export function applySeverityOverrides(
  issues: readonly ValidationIssue[],
  overrides: Readonly<Record<string, SeverityOverride>>,
): ValidationIssue[] {
  const mapped: ValidationIssue[] = [];
  for (const issue of issues) {
    const override = overrides[issue.ruleId];
    if (override === "ignore") {
      continue;
    }

    mapped.push(override && override !== issue.severity ? { ...issue, severity: override } : issue);
  }
  return sortBySeverity(mapped);
}

const NO_PROFILE_SYMBOLS: ReadonlySet<string> = new Set();

/** Runs all rules; errors first, then warnings and infos, in rule order. */
export function validateDocument(
  root: Element,
  profileSymbols: ReadonlySet<string> = NO_PROFILE_SYMBOLS,
): ValidationIssue[] {
  const byId = new Map<string, Element>();
  for (const el of root.querySelectorAll("Object[id]")) {
    const id = el.getAttribute("id");
    if (id) {
      byId.set(id, el);
    }
  }

  const issues: ValidationIssue[] = [];
  checkDuplicateIds(root, issues);
  checkDanglingReferences(root, byId, issues);
  checkIdSyntax(root, issues);
  checkReferenceSyntax(root, issues);
  checkShapeUsages(root, profileSymbols, issues);
  checkConnectorLines(root, byId, issues);
  checkDiagramExtent(root, issues);
  checkFlowEndpoints(root, issues);
  checkOrphanedPipingNodes(root, issues);
  checkUnconnectedNozzles(root, issues);
  checkNominalDiameterMismatch(root, byId, issues);
  checkPipingClassChange(root, byId, issues);
  checkRequiredMetaData(root, issues);
  checkTemplateAttributeReferences(root, issues);
  return sortBySeverity(issues);
}
