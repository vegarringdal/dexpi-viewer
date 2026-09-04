import type { NodePositionMarker, NodePositionSource } from "./types.ts";

export type NodePositionKindRow = Readonly<{
  source: NodePositionSource;
  kind: string;
  count: number;
}>;

/**
 * The distinct node-position kinds a scene actually contains, as the Node
 * Positions panel's rows: file kinds first, then profile kinds, each group
 * by descending count then name — so the dominant kind (usually piping) is
 * the first thing to reach for.
 */
export function collectNodePositionKinds(
  markers: readonly NodePositionMarker[],
): readonly NodePositionKindRow[] {
  const counts = new Map<string, NodePositionKindRow>();
  for (const marker of markers) {
    const key = `${marker.source}:${marker.kind}`;
    const row = counts.get(key);
    counts.set(
      key,
      row ? { ...row, count: row.count + 1 } : { source: marker.source, kind: marker.kind, count: 1 },
    );
  }
  return [...counts.values()].sort((a, b) => {
    if (a.source !== b.source) {
      return a.source === "file" ? -1 : 1;
    }

    return b.count - a.count || a.kind.localeCompare(b.kind);
  });
}
