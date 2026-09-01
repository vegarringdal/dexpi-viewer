import type { PlantModel, PlantNode } from "../../lib/dexpi/plantModel.ts";
import type { FilteredNode } from "./PlantTree.tsx";

// -----------------------------------------------------------------------------
// Plant-model filtering for the object tree (pure logic, no rendering)
// -----------------------------------------------------------------------------

/** Which object fields the tree search matches against. */
export type SearchField = "name" | "type" | "id" | "persistentId";

export const ALL_SEARCH_FIELDS: readonly SearchField[] = ["name", "type", "id", "persistentId"];

function matchesQuery(node: PlantNode, query: string, fields: ReadonlySet<SearchField>): boolean {
  if (fields.has("name") && node.label.toLowerCase().includes(query)) {
    return true;
  }

  if (fields.has("type") && node.typeName.toLowerCase().includes(query)) {
    return true;
  }

  if (fields.has("id") && node.id.toLowerCase().includes(query)) {
    return true;
  }

  return (
    fields.has("persistentId") && node.persistentIds.some((pid) => pid.value.toLowerCase().includes(query))
  );
}

/** Prunes to `query` matches in the enabled fields (keeping their ancestors). */
export function filterNode(
  node: PlantNode,
  query: string,
  fields: ReadonlySet<SearchField>,
): FilteredNode | null {
  const children = node.children
    .map((c) => filterNode(c, query, fields))
    .filter((c): c is FilteredNode => c !== null);
  if (query && children.length === 0 && !matchesQuery(node, query, fields)) {
    return null;
  }

  return { node, children };
}

/** Ids of every group row (rows with children), for expand-all. */
export function collectGroupIds(items: readonly FilteredNode[], out: Set<string>): Set<string> {
  for (const item of items) {
    if (item.children.length > 0) {
      out.add(item.node.id);
      collectGroupIds(item.children, out);
    }
  }
  return out;
}

/** The id chain from root down to (excluding) the object. */
export function ancestorIds(plant: PlantModel | undefined, id: string): string[] {
  const chain: string[] = [];
  let current = plant?.byId.get(id)?.parentId ?? null;
  while (current) {
    chain.push(current);
    current = plant?.byId.get(current)?.parentId ?? null;
  }
  return chain;
}

/** A tree row plus the depth it renders at, in on-screen order. */
export type FlatRow = Readonly<{ item: FilteredNode; depth: number }>;

/**
 * Flattens the tree into its visible rows, in display order — a collapsed
 * group's children are skipped entirely. Shared by `PlantTree`'s
 * virtualized rendering and `useTreeSelection`'s shift-range math, so the
 * two can never disagree on "what order do rows appear in."
 */
export function flattenVisibleNodes(
  items: readonly FilteredNode[],
  expanded: ReadonlySet<string>,
  forceExpand: boolean,
  depth = 0,
  out: FlatRow[] = [],
): FlatRow[] {
  for (const item of items) {
    out.push({ item, depth });
    if (item.children.length > 0 && (forceExpand || expanded.has(item.node.id))) {
      flattenVisibleNodes(item.children, expanded, forceExpand, depth + 1, out);
    }
  }
  return out;
}
