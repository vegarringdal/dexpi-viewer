import { type DiscProfile, type ProfileLabelTemplate, pickVariant } from "./discProfile.ts";
import {
  buildHeatTraceOverlays,
  buildHeatTraceSymbolOverlays,
  collectHeatTracedIds,
  resolveHeatTraceStyle,
} from "./heatTracing.ts";
import { parseConnectorPolyline, parsePrimitive } from "./primitives.ts";
import { buildProfileLabelOverlays, type PendingProfileLabels } from "./profileLabels.ts";
import { buildLookupIndex, resolveTemplateTexts } from "./resolveTemplates.ts";
import { buildSignalMarkPrims, signalLineStyle } from "./signalLines.ts";
import { layoutTextLines } from "./textLayout.ts";
import type {
  Bounds,
  ElementRole,
  Point,
  SceneGraph,
  SceneNode,
  ScenePrimitive,
  ShapeDef,
  UseTransform,
} from "./types.ts";
import {
  aggregateFromData,
  booleanFromData,
  componentObjects,
  numberFromData,
  pointFromAggregate,
  referenceTargets,
  stringFromData,
} from "./xml.ts";

// -----------------------------------------------------------------------------
// Shape catalogue
// -----------------------------------------------------------------------------

function parseShape(node: Element): ShapeDef | null {
  const id = node.getAttribute("id");
  if (!id) {
    return null;
  }

  const primitives = [...componentObjects(node, "Primitives"), ...componentObjects(node, "Elements")]
    .map((el) => parsePrimitive(el))
    .filter((p): p is ScenePrimitive => p !== null);
  return { id, name: stringFromData(node, "Name") || id, primitives };
}

function parseShapeCatalogues(root: Element): Map<string, ShapeDef> {
  const shapes = new Map<string, ShapeDef>();
  for (const catalogue of root.querySelectorAll('Object[type="Core/Diagram.ShapeCatalogue"]')) {
    for (const shapeEl of componentObjects(catalogue, "Shapes")) {
      const shape = parseShape(shapeEl);
      if (shape) {
        shapes.set(shape.id, shape);
      }
    }
  }
  return shapes;
}

// -----------------------------------------------------------------------------
// Group traversal
// -----------------------------------------------------------------------------

function parseUseTransform(node: Element): UseTransform {
  return {
    position: pointFromAggregate(aggregateFromData(node, "Position")) ?? { x: 0, y: 0 },
    rotation: numberFromData(node, "Rotation", 0),
    scaleX: numberFromData(node, "ScaleX", 1),
    scaleY: numberFromData(node, "ScaleY", 1),
    isMirrored: booleanFromData(node, "IsMirrored"),
  };
}

type WalkContext = {
  readonly nodes: SceneNode[];
  readonly visited: Set<Element>;
  /** *NodePosition object id → point, for ConnectorLine endpoint stitching. */
  readonly nodePositions: ReadonlyMap<string, Point>;
  /** Mutable: profile symbol variants register here as they get used. */
  readonly shapes: Map<string, ShapeDef>;
  readonly profile: DiscProfile | null;
  /** id → element, for evaluating profile variant conditions. */
  readonly objectsById: ReadonlyMap<string, Element>;
  /** Profile-symbol placements whose LabelTemplates resolve in a post-pass. */
  readonly profileLabels: PendingProfileLabels[];
};

/**
 * ConnectorLine endpoints reference PipingNodePosition / Instrumentation-
 * NodePosition / NodePosition objects; many connectors carry no inner points
 * at all, so without this map they would draw nothing.
 */
function parseNodePositions(root: Element): Map<string, Point> {
  const map = new Map<string, Point>();
  for (const el of root.querySelectorAll("Object[id]")) {
    if (!(el.getAttribute("type") ?? "").endsWith("NodePosition")) {
      continue;
    }

    const id = el.getAttribute("id");
    const position = pointFromAggregate(aggregateFromData(el, "Position"));
    if (id && position) {
      map.set(id, position);
    }
  }
  return map;
}

const USAGE_TYPES = new Set(["Core/Diagram.ShapeUsage", "Profile/SymbolUsage"]);
const USAGE_REF_PROPS = ["Shape", "Symbol"];

/**
 * Resolves a usage's shape reference: the document's own catalogue first,
 * then the loaded DISC profile (by full "DiscProfile/x" key or bare name),
 * where the variant is picked against the represented object's attributes
 * and registered as a ShapeDef on first use.
 */
type ResolvedShape = Readonly<{
  shapeId: string;
  labelTemplates: readonly ProfileLabelTemplate[];
}>;

function resolveShapeId(ctx: WalkContext, ref: string, objectId: string | null): ResolvedShape | null {
  if (ctx.shapes.has(ref)) {
    return { shapeId: ref, labelTemplates: [] };
  }

  const symbol =
    ctx.profile?.symbols.get(ref) ?? ctx.profile?.symbols.get(ref.split("/").pop() ?? ref) ?? null;
  if (!symbol) {
    return null;
  }

  const instanceEl = objectId ? (ctx.objectsById.get(objectId) ?? null) : null;
  const variant = pickVariant(symbol, instanceEl);
  if (!ctx.shapes.has(variant.shapeId)) {
    ctx.shapes.set(variant.shapeId, {
      id: variant.shapeId,
      name: symbol.name,
      primitives: variant.primitives,
    });
  }
  return { shapeId: variant.shapeId, labelTemplates: variant.labelTemplates };
}

function pushUsage(ctx: WalkContext, el: Element, objectId: string | null, role: ElementRole): void {
  const ref = USAGE_REF_PROPS.flatMap((p) => referenceTargets(el, p))[0];
  if (!ref) {
    return;
  }

  const resolved = resolveShapeId(ctx, ref, objectId);
  if (!resolved) {
    return;
  }

  const transform = parseUseTransform(el);
  ctx.nodes.push({ kind: "use", shapeId: resolved.shapeId, transform, objectId, role });
  if (resolved.labelTemplates.length > 0 && objectId) {
    ctx.profileLabels.push({ templates: resolved.labelTemplates, transform, objectId });
  }
}

/**
 * Recursively walks a diagram group tree. Any object can carry Elements
 * (leaf primitives / shape usages) and Groups (nested groups); a Represents
 * reference on the way down tags emitted nodes with the conceptual object
 * they draw, and Core/Diagram.Label groups mark their content as labels.
 */
function walkGroup(
  ctx: WalkContext,
  node: Element,
  inheritedId: string | null,
  inheritedRole: ElementRole,
): void {
  if (ctx.visited.has(node)) {
    return;
  }

  ctx.visited.add(node);
  const type = node.getAttribute("type") ?? "";
  const isLabelGroup = type === "Core/Diagram.Label" || type.endsWith("Label");
  const role: ElementRole = isLabelGroup ? "label" : inheritedRole;
  const objectId = referenceTargets(node, "Represents")[0] ?? inheritedId;

  for (const el of componentObjects(node, "Elements")) {
    const elType = el.getAttribute("type") ?? "";
    if (USAGE_TYPES.has(elType)) {
      pushUsage(ctx, el, objectId, role);
      continue;
    }

    if (elType === "Core/Diagram.ConnectorLine") {
      const source = ctx.nodePositions.get(referenceTargets(el, "Source")[0] ?? "") ?? null;
      const target = ctx.nodePositions.get(referenceTargets(el, "Target")[0] ?? "") ?? null;
      let prim = parseConnectorPolyline(el, source, target);
      if (prim.kind === "polyline" && prim.points.length >= 2) {
        const style = signalLineStyle(
          objectId ? (ctx.objectsById.get(objectId) ?? null) : null,
          ctx.profile?.signalStrokes,
        );
        if (style) {
          prim = {
            ...prim,
            stroke: {
              ...prim.stroke,
              dash: style.dash,
              ...(style.color ? { color: style.color } : {}),
              ...(style.width !== undefined ? { width: style.width } : {}),
            },
          };
        }
        if (!style?.hideLine) {
          ctx.nodes.push({ kind: "prim", prim, objectId, role: "connector" });
        }
        if (style?.mark) {
          for (const markPrim of buildSignalMarkPrims(prim.points, style.mark, prim.stroke)) {
            ctx.nodes.push({ kind: "prim", prim: markPrim, objectId, role: "connector" });
          }
        }
      }
      continue;
    }

    const prim = parsePrimitive(el);
    if (prim) {
      ctx.nodes.push({ kind: "prim", prim, objectId, role });
      continue;
    }

    walkGroup(ctx, el, objectId, role);
  }

  for (const group of componentObjects(node, "Groups")) {
    walkGroup(ctx, group, objectId, role);
  }
}

// -----------------------------------------------------------------------------
// Explicit-label ownership
// -----------------------------------------------------------------------------

const TEXT_TYPES = new Set(["Core/Diagram.Text"]);

function hasAuthoredText(el: Element): boolean {
  return (stringFromData(el, "Value") || stringFromData(el, "Text")).trim().length > 0;
}

/**
 * Ids of every object with explicit, non-empty AUTHORED diagram label text
 * anywhere in its representation — the set that suppresses profile
 * LabelTemplate overlays. Computed on the XML group tree, not the emitted
 * scene nodes, so the association survives layouts where the label group
 * and the symbol group are siblings and the Represents reference sits at a
 * different nesting level: a label text with no Represents on its own
 * chain is attributed to the nearest enclosing subtree that represents
 * exactly ONE object. A subtree representing several objects never
 * guesses, and ownership uses authored literals only — template
 * resolution can never move an object in or out of this set.
 */
export function collectExplicitlyLabelledIds(root: Element): Set<string> {
  const labelled = new Set<string>();
  const visited = new Set<Element>();

  type SubtreeInfo = Readonly<{
    /** Distinct Represents targets in the subtree. */
    repIds: ReadonlySet<string>;
    /** Authored label texts still lacking an object association. */
    unowned: number;
  }>;

  const walk = (node: Element, inheritedId: string | null, inheritedLabel: boolean): SubtreeInfo => {
    if (visited.has(node)) {
      return { repIds: new Set(), unowned: 0 };
    }

    visited.add(node);
    const type = node.getAttribute("type") ?? "";
    const isLabelContext = inheritedLabel || type === "Core/Diagram.Label" || type.endsWith("Label");
    const ownRep = referenceTargets(node, "Represents")[0] ?? null;
    const objectId = ownRep ?? inheritedId;

    const repIds = new Set<string>(ownRep ? [ownRep] : []);
    let unowned = 0;
    const merge = (child: SubtreeInfo): void => {
      for (const id of child.repIds) {
        repIds.add(id);
      }
      unowned += child.unowned;
    };

    for (const el of componentObjects(node, "Elements")) {
      const elType = el.getAttribute("type") ?? "";
      if (TEXT_TYPES.has(elType)) {
        if (isLabelContext && hasAuthoredText(el)) {
          if (objectId) {
            labelled.add(objectId);
          } else {
            unowned += 1;
          }
        }
        continue;
      }

      if (USAGE_TYPES.has(elType) || elType === "Core/Diagram.ConnectorLine") {
        continue;
      }

      merge(walk(el, objectId, isLabelContext));
    }

    for (const group of componentObjects(node, "Groups")) {
      merge(walk(group, objectId, isLabelContext));
    }

    if (unowned > 0 && repIds.size === 1) {
      for (const id of repIds) {
        labelled.add(id);
      }
      unowned = 0;
    }

    return { repIds, unowned };
  };

  const diagrams = [...root.querySelectorAll('Object[type="Core/Diagram.Diagram"]')];
  const roots =
    diagrams.length > 0
      ? diagrams
      : [...root.querySelectorAll('Object[type="Core/Diagram.RepresentationGroup"]')];
  for (const groupRoot of roots) {
    walk(groupRoot, null, false);
  }
  return labelled;
}

// -----------------------------------------------------------------------------
// Bounds
// -----------------------------------------------------------------------------

type MutableBounds = { minX: number; minY: number; maxX: number; maxY: number };

function extend(b: MutableBounds, x: number, y: number): void {
  b.minX = Math.min(b.minX, x);
  b.minY = Math.min(b.minY, y);
  b.maxX = Math.max(b.maxX, x);
  b.maxY = Math.max(b.maxY, y);
}

function extendByPrimitive(
  b: MutableBounds,
  prim: ScenePrimitive,
  dx: number,
  dy: number,
  scale: number,
): void {
  switch (prim.kind) {
    case "polyline":
    case "polygon":
      for (const p of prim.points) {
        extend(b, dx + p.x * scale, dy + p.y * scale);
      }
      break;
    case "circle":
      extend(b, dx + (prim.center.x - prim.radius) * scale, dy + (prim.center.y - prim.radius) * scale);
      extend(b, dx + (prim.center.x + prim.radius) * scale, dy + (prim.center.y + prim.radius) * scale);
      break;
    case "ellipse":
    case "ellipseArc": {
      const r = Math.max(prim.rx, prim.ry);
      extend(b, dx + (prim.center.x - r) * scale, dy + (prim.center.y - r) * scale);
      extend(b, dx + (prim.center.x + r) * scale, dy + (prim.center.y + r) * scale);
      break;
    }
    case "rect": {
      const r = Math.hypot(prim.width, prim.height) / 2;
      extend(b, dx + (prim.center.x - r) * scale, dy + (prim.center.y - r) * scale);
      extend(b, dx + (prim.center.x + r) * scale, dy + (prim.center.y + r) * scale);
      break;
    }
    case "text": {
      const lines = layoutTextLines(prim.value, prim.size, prim.vAlign);
      const maxChars = Math.max(...lines.map((l) => l.value.length));
      const w = maxChars * prim.size * 0.6;
      const firstOffset = lines[0]?.offsetY ?? 0;
      const lastOffset = lines[lines.length - 1]?.offsetY ?? 0;
      extend(b, dx + prim.position.x * scale - w, dy + prim.position.y * scale + firstOffset - prim.size);
      extend(b, dx + prim.position.x * scale + w, dy + prim.position.y * scale + lastOffset + prim.size);
      break;
    }
  }
}

/** Conservative geometry bounds — rotations are approximated by enclosing radii. */
export function computeSceneBounds(
  nodes: readonly SceneNode[],
  shapes: ReadonlyMap<string, ShapeDef>,
): Bounds {
  const b: MutableBounds = {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  };
  for (const node of nodes) {
    if (node.kind === "prim") {
      extendByPrimitive(b, node.prim, 0, 0, 1);
      continue;
    }

    const shape = shapes.get(node.shapeId);
    if (!shape) {
      continue;
    }

    const scale = Math.max(Math.abs(node.transform.scaleX), Math.abs(node.transform.scaleY));
    for (const prim of shape.primitives) {
      extendByPrimitive(b, prim, node.transform.position.x, node.transform.position.y, scale);
    }
  }
  if (!Number.isFinite(b.minX)) {
    return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  }

  return b;
}

/**
 * Bounds of every scene node representing `objectId`, or null when the
 * object has no drawn geometry. Degenerate extents are padded so fitting
 * to a single point/dot still produces a usable viewport.
 */
export function computeObjectBounds(scene: SceneGraph, objectId: string): Bounds | null {
  const nodes = scene.nodes.filter((n) => n.objectId === objectId);
  if (nodes.length === 0) {
    return null;
  }

  const b = computeSceneBounds(nodes, scene.shapes);
  const pad = Math.max((b.maxX - b.minX) * 0.05, (b.maxY - b.minY) * 0.05, 5);
  return { minX: b.minX - pad, minY: b.minY - pad, maxX: b.maxX + pad, maxY: b.maxY + pad };
}

// -----------------------------------------------------------------------------
// Entry point
// -----------------------------------------------------------------------------

/**
 * Builds the render-ready scene graph from a parsed DEXPI 2.0 XML document.
 * Prefers the Diagram object's declared Min/Max extent; falls back to the
 * geometry's own bounds when absent or degenerate.
 */
export function buildSceneGraph(root: Element, profile: DiscProfile | null = null): SceneGraph {
  const shapes = parseShapeCatalogues(root);
  // Needed with or without a profile: variant conditions use it when one is
  // loaded, semantic signal-line styling always does.
  const objectsById = new Map<string, Element>();
  for (const el of root.querySelectorAll("Object[id]")) {
    const id = el.getAttribute("id");
    if (id) {
      objectsById.set(id, el);
    }
  }
  const ctx: WalkContext = {
    nodes: [],
    visited: new Set(),
    nodePositions: parseNodePositions(root),
    shapes,
    profile,
    objectsById,
    profileLabels: [],
  };

  const diagrams = [...root.querySelectorAll('Object[type="Core/Diagram.Diagram"]')];
  for (const diagram of diagrams) {
    walkGroup(ctx, diagram, null, "symbol");
  }
  if (diagrams.length === 0) {
    for (const group of root.querySelectorAll('Object[type="Core/Diagram.RepresentationGroup"]')) {
      walkGroup(ctx, group, null, "symbol");
    }
  }

  let bounds: Bounds | null = null;
  const first = diagrams[0];
  if (first) {
    const declared = {
      minX: numberFromData(first, "MinX", 0),
      minY: numberFromData(first, "MinY", 0),
      maxX: numberFromData(first, "MaxX", 0),
      maxY: numberFromData(first, "MaxY", 0),
    };
    if (declared.maxX > declared.minX && declared.maxY > declared.minY) {
      bounds = declared;
    }
  }

  let nodes = resolveTemplateTexts(root, ctx.nodes);
  if (ctx.profileLabels.length > 0) {
    // Explicit diagram labels are authoritative — objects that carry one
    // never get profile LabelTemplate overlays on top. Ownership comes
    // from the XML representation tree (collectExplicitlyLabelledIds),
    // not the emitted nodes, so sibling label groups whose Represents sits
    // at a different level still suppress their object's templates.
    nodes = [
      ...nodes,
      ...buildProfileLabelOverlays(
        buildLookupIndex(root),
        ctx.profileLabels,
        collectExplicitlyLabelledIds(root),
        profile?.instances,
      ),
    ];
  }
  const tracedIds = collectHeatTracedIds(root);
  const traceStyle = resolveHeatTraceStyle(profile?.heatTraceStroke ?? null);
  nodes = [
    ...nodes,
    ...buildHeatTraceOverlays(nodes, tracedIds, traceStyle),
    ...buildHeatTraceSymbolOverlays(nodes, tracedIds, traceStyle, (n) => computeSceneBounds([n], shapes)),
  ];
  return {
    nodes,
    shapes,
    bounds: bounds ?? computeSceneBounds(nodes, shapes),
    heatTracedIds: tracedIds,
  };
}
