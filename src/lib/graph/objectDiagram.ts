import type { ProfileInstanceData } from "../dexpi/discProfile.ts";
import { isDiagramType, type PlantModel, type PlantNode } from "../dexpi/plantModel.ts";
import type { IssueSeverity, ValidationIssue } from "../dexpi/validation.ts";

// -----------------------------------------------------------------------------
// Object diagram (Inspect panel)
//
// A UML-style instance diagram of ONE object: its full raw Data as rows in a
// center card, and its relations as neighbor cards with each edge labeled by
// the actual reference/containment property — the debug view of "how is
// this connected" that raw XML makes hard to see. Incoming relations chain
// LEFT of the center (referenced-by of referenced-by at depth 2, …),
// outgoing chain RIGHT. Published-model targets become stub cards carrying
// the profile instance's data.
// -----------------------------------------------------------------------------

export type DiagramRowTone = "normal" | "undefined" | "issue";

export type DiagramRow = Readonly<{
  name: string;
  value: string;
  tone: DiagramRowTone;
  /** Full finding message for "issue" rows, surfaced as a tooltip. */
  tooltip?: string;
}>;

export type DiagramCard = Readonly<{
  id: string;
  title: string;
  subtitle: string;
  rows: readonly DiagramRow[];
  /** Worst validation severity attached to this object, if any. */
  severity: IssueSeverity | null;
  /** Findings shown in the card (severity-colored), "ruleId: message". */
  issueRows: readonly string[];
  /** True for a reference target that resolves to nothing — shown, in red. */
  broken: boolean;
  /** False for profile-instance stubs and unresolved targets. */
  navigable: boolean;
  /** Drawing-side (Core/Diagram) object — rendered with a dashed border. */
  drawing: boolean;
  /** Positional XPath of the object's element in the source XML. */
  xpath: string | null;
}>;

export type DiagramRelation = "reference" | "referencedBy" | "parent" | "child" | "profile";

export type DiagramSide = "in" | "out";

export type DiagramNeighbor = Readonly<{
  /** Unique placement key (an object can appear once per diagram only). */
  key: string;
  /** "center" or another neighbor's key — the card this edge connects to. */
  fromKey: string;
  side: DiagramSide;
  /** 1 = adjacent to the center. */
  level: number;
  card: DiagramCard;
  /** The References/Components property naming the edge. */
  property: string;
  relation: DiagramRelation;
}>;

export type ObjectDiagram = Readonly<{
  center: DiagramCard;
  neighbors: readonly DiagramNeighbor[];
}>;

export const MIN_DIAGRAM_DEPTH = 1;
export const MAX_DIAGRAM_DEPTH = 3;

/** Neighbors per side and level before collapsing into a "+n more" stub. */
const MAX_NEIGHBORS_PER_LEVEL = 20;

/** Findings listed inside a card before collapsing into "+n more". */
const MAX_ISSUE_ROWS = 3;

export type IssuesById = ReadonlyMap<string, readonly ValidationIssue[]>;

const SEVERITY_RANK: Readonly<Record<IssueSeverity, number>> = { error: 0, warning: 1, info: 2 };

function worstSeverity(issues: readonly ValidationIssue[]): IssueSeverity | null {
  let worst: IssueSeverity | null = null;
  for (const issue of issues) {
    if (worst === null || SEVERITY_RANK[issue.severity] < SEVERITY_RANK[worst]) {
      worst = issue.severity;
    }
  }
  return worst;
}

function issueRowsFor(issues: readonly ValidationIssue[]): string[] {
  const rows = issues.slice(0, MAX_ISSUE_ROWS).map((i) => `${i.ruleId}: ${i.message}`);
  if (issues.length > MAX_ISSUE_ROWS) {
    rows.push(`+ ${issues.length - MAX_ISSUE_ROWS} more findings…`);
  }
  return rows;
}

/**
 * Findings that name a property merge into the card's rows: an existing
 * row turns red (bad value), a named-but-absent property becomes a red
 * "(missing)" row — the structural reading of the finding. Only findings
 * without a property name remain as ⚠ message rows.
 */
function buildRows(
  node: PlantNode,
  issues: readonly ValidationIssue[],
): { rows: DiagramRow[]; unmapped: ValidationIssue[] } {
  const byAttribute = new Map<string, ValidationIssue>();
  const unmapped: ValidationIssue[] = [];
  for (const issue of issues) {
    if (issue.attributeName && !byAttribute.has(issue.attributeName)) {
      byAttribute.set(issue.attributeName, issue);
    } else if (!issue.attributeName) {
      unmapped.push(issue);
    }
  }

  const toRow = (name: string, value: string, fallbackTone: DiagramRowTone): DiagramRow => {
    const issue = byAttribute.get(name);
    if (!issue) {
      return { name, value, tone: fallbackTone };
    }

    byAttribute.delete(name);
    return { name, value, tone: "issue", tooltip: `${issue.ruleId}: ${issue.message}` };
  };

  const rows = [
    ...node.attributes.map((a) => toRow(a.name, a.value, "normal")),
    ...node.undefinedAttributes.map((name) => toRow(name, "(undefined)", "undefined")),
    ...node.persistentIds.map(
      (p): DiagramRow => ({ name: `PersistentId (${p.name})`, value: p.value, tone: "normal" }),
    ),
    ...[...byAttribute.values()].map(
      (issue): DiagramRow => ({
        name: issue.attributeName ?? "",
        value: "(missing)",
        tone: "issue",
        tooltip: `${issue.ruleId}: ${issue.message}`,
      }),
    ),
  ];
  return { rows, unmapped };
}

function cardFor(node: PlantNode, navigable: boolean, issuesById: IssuesById): DiagramCard {
  const issues = issuesById.get(node.id) ?? [];
  const { rows, unmapped } = buildRows(node, issues);
  return {
    id: node.id,
    title: node.label || node.id,
    subtitle: node.type,
    rows,
    severity: worstSeverity(issues),
    issueRows: issueRowsFor(unmapped),
    broken: false,
    navigable,
    drawing: isDiagramType(node.type),
    xpath: node.xpath,
  };
}

function stubCard(target: string, instances: ReadonlyMap<string, ProfileInstanceData>): DiagramCard {
  const data = instances.get(target) ?? instances.get(target.split("/").pop() ?? target);
  return {
    id: target,
    title: target.split(".").pop() ?? target,
    subtitle: data ? "profile instance" : "unresolved target",
    rows: data
      ? [...data.entries()].map(([name, value]): DiagramRow => ({ name, value, tone: "normal" }))
      : [],
    severity: data ? null : "error",
    issueRows: data ? [] : ["Reference target resolves to nothing in this document or the profile"],
    broken: !data,
    navigable: false,
    drawing: false,
    xpath: null,
  };
}

type Pending = Readonly<{ card: DiagramCard; property: string; relation: DiagramRelation; fromKey: string }>;

type Frontier = Readonly<{ id: string; key: string }>;

const NO_INSTANCES: ReadonlyMap<string, ProfileInstanceData> = new Map();

/**
 * Builds the instance diagram around `objectId` up to `depth` hops per side,
 * or null when the id is unknown. Every object places at most once (first
 * side/level to reach it wins), which also breaks reference cycles.
 */
const NO_ISSUES: IssuesById = new Map();

export function buildObjectDiagram(
  plant: PlantModel,
  objectId: string,
  instances: ReadonlyMap<string, ProfileInstanceData> = NO_INSTANCES,
  depth: number = MIN_DIAGRAM_DEPTH,
  issuesById: IssuesById = NO_ISSUES,
): ObjectDiagram | null {
  const node = plant.byId.get(objectId);
  if (!node) {
    return null;
  }

  const seen = new Set<string>([objectId]);
  const neighbors: DiagramNeighbor[] = [];

  const incomingOf = (source: PlantNode, fromKey: string): Pending[] => {
    const out: Pending[] = [];
    const parent = source.parentId ? plant.byId.get(source.parentId) : undefined;
    if (parent) {
      out.push({
        card: cardFor(parent, true, issuesById),
        property: "Components",
        relation: "parent",
        fromKey,
      });
    }
    for (const ref of plant.referencedBy.get(source.id) ?? []) {
      const from = plant.byId.get(ref.fromId);
      if (from) {
        out.push({
          card: cardFor(from, true, issuesById),
          property: ref.property,
          relation: "referencedBy",
          fromKey,
        });
      }
    }
    return out;
  };

  const outgoingOf = (source: PlantNode, fromKey: string): Pending[] => {
    const out: Pending[] = [];
    for (const ref of source.references) {
      for (const target of ref.targets) {
        const targetNode = plant.byId.get(target);
        if (targetNode) {
          out.push({
            card: cardFor(targetNode, true, issuesById),
            property: ref.property,
            relation: "reference",
            fromKey,
          });
        } else {
          out.push({
            card: stubCard(target, instances),
            property: ref.property,
            relation: "profile",
            fromKey,
          });
        }
      }
    }
    for (const child of source.children) {
      out.push({
        card: cardFor(child, true, issuesById),
        property: "Components",
        relation: "child",
        fromKey,
      });
    }
    return out;
  };

  const expand = (
    side: DiagramSide,
    frontier: readonly Frontier[],
    level: number,
    collect: (source: PlantNode, fromKey: string) => Pending[],
  ): Frontier[] => {
    const pending: Pending[] = [];
    for (const entry of frontier) {
      const source = plant.byId.get(entry.id);
      if (source) {
        pending.push(...collect(source, entry.key));
      }
    }

    const fresh = pending.filter((p) => !p.card.id || !seen.has(p.card.id));
    for (const p of fresh) {
      if (p.card.id) {
        seen.add(p.card.id);
      }
    }
    const shown = fresh.slice(0, MAX_NEIGHBORS_PER_LEVEL);
    const next: Frontier[] = [];
    shown.forEach((p, i) => {
      const key = `${side}${String(level)}:${String(i)}`;
      neighbors.push({ ...p, key, side, level });
      if (p.card.navigable) {
        next.push({ id: p.card.id, key });
      }
    });
    const hidden = fresh.length - shown.length;
    if (hidden > 0) {
      neighbors.push({
        key: `${side}${String(level)}:more`,
        fromKey: shown[shown.length - 1]?.fromKey ?? "center",
        side,
        level,
        card: {
          id: "",
          title: `+ ${hidden} more…`,
          subtitle: "",
          rows: [],
          severity: null,
          issueRows: [],
          broken: false,
          navigable: false,
          drawing: false,
          xpath: null,
        },
        property: "",
        relation: "reference",
      });
    }
    return next;
  };

  let inFrontier: readonly Frontier[] = [{ id: objectId, key: "center" }];
  let outFrontier: readonly Frontier[] = [{ id: objectId, key: "center" }];
  const clampedDepth = Math.min(MAX_DIAGRAM_DEPTH, Math.max(MIN_DIAGRAM_DEPTH, Math.round(depth)));
  for (let level = 1; level <= clampedDepth; level++) {
    inFrontier = expand("in", inFrontier, level, incomingOf);
    outFrontier = expand("out", outFrontier, level, outgoingOf);
  }

  return { center: cardFor(node, false, issuesById), neighbors };
}
