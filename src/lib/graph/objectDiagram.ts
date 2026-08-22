import type { ProfileInstanceData } from "../dexpi/discProfile.ts";
import type { PlantModel, PlantNode } from "../dexpi/plantModel.ts";

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

export type DiagramRow = Readonly<{ name: string; value: string }>;

export type DiagramCard = Readonly<{
  id: string;
  title: string;
  subtitle: string;
  rows: readonly DiagramRow[];
  /** False for profile-instance stubs and unresolved targets. */
  navigable: boolean;
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

function cardFor(node: PlantNode, navigable: boolean): DiagramCard {
  return {
    id: node.id,
    title: node.label || node.id,
    subtitle: node.type,
    rows: [
      ...node.attributes,
      ...node.persistentIds.map((p) => ({ name: `PersistentId (${p.name})`, value: p.value })),
    ],
    navigable,
  };
}

function stubCard(target: string, instances: ReadonlyMap<string, ProfileInstanceData>): DiagramCard {
  const data = instances.get(target) ?? instances.get(target.split("/").pop() ?? target);
  return {
    id: target,
    title: target.split(".").pop() ?? target,
    subtitle: data ? "profile instance" : "unresolved target",
    rows: data ? [...data.entries()].map(([name, value]) => ({ name, value })) : [],
    navigable: false,
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
export function buildObjectDiagram(
  plant: PlantModel,
  objectId: string,
  instances: ReadonlyMap<string, ProfileInstanceData> = NO_INSTANCES,
  depth: number = MIN_DIAGRAM_DEPTH,
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
      out.push({ card: cardFor(parent, true), property: "Components", relation: "parent", fromKey });
    }
    for (const ref of plant.referencedBy.get(source.id) ?? []) {
      const from = plant.byId.get(ref.fromId);
      if (from) {
        out.push({ card: cardFor(from, true), property: ref.property, relation: "referencedBy", fromKey });
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
            card: cardFor(targetNode, true),
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
      out.push({ card: cardFor(child, true), property: "Components", relation: "child", fromKey });
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
        card: { id: "", title: `+ ${hidden} more…`, subtitle: "", rows: [], navigable: false },
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

  return { center: cardFor(node, false), neighbors };
}
