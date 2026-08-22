import type { DiagramCard, DiagramRelation, ObjectDiagram } from "./objectDiagram.ts";

// -----------------------------------------------------------------------------
// Deterministic column layout for the object diagram: incoming levels stack
// in columns left of the center, outgoing levels right, deeper levels
// further out. All units are SVG px; the panel pans/zooms the result.
// -----------------------------------------------------------------------------

export type PlacedCard = Readonly<{
  key: string;
  card: DiagramCard;
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export type DiagramEdge = Readonly<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  relation: DiagramRelation;
}>;

export type InspectLayout = Readonly<{
  width: number;
  height: number;
  center: PlacedCard;
  neighbors: readonly PlacedCard[];
  edges: readonly DiagramEdge[];
}>;

export const CARD_WIDTH = 210;
export const HEADER_HEIGHT = 30;
export const ROW_HEIGHT = 13;
const CARD_PAD_BOTTOM = 6;
const CARD_GAP_Y = 16;
const COLUMN_GAP = 110;
const MARGIN = 12;

function cardHeight(card: DiagramCard): number {
  return HEADER_HEIGHT + card.rows.length * ROW_HEIGHT + CARD_PAD_BOTTOM;
}

function columnHeight(heights: readonly number[]): number {
  return heights.reduce((sum, h) => sum + h, 0) + Math.max(0, heights.length - 1) * CARD_GAP_Y;
}

/** Anchor y for an edge at a card: the middle of its header band. */
function anchorY(placed: PlacedCard): number {
  return placed.y + Math.min(placed.height, HEADER_HEIGHT) / 2;
}

/** Lays out the diagram; pure and deterministic for a given input. */
export function layoutObjectDiagram(diagram: ObjectDiagram): InspectLayout {
  const inLevels = Math.max(0, ...diagram.neighbors.filter((n) => n.side === "in").map((n) => n.level));
  const outLevels = Math.max(0, ...diagram.neighbors.filter((n) => n.side === "out").map((n) => n.level));

  const columnOf = new Map<string, typeof diagram.neighbors>();
  for (const neighbor of diagram.neighbors) {
    const key = `${neighbor.side}${String(neighbor.level)}`;
    columnOf.set(key, [...(columnOf.get(key) ?? []), neighbor]);
  }

  const centerHeight = cardHeight(diagram.center);
  const columnHeights = [...columnOf.values()].map((entries) =>
    columnHeight(entries.map((n) => cardHeight(n.card))),
  );
  const tallest = Math.max(centerHeight, ...columnHeights);
  const height = tallest + 2 * MARGIN;
  const columnX = (side: "in" | "out", level: number): number => {
    const centerCol = inLevels;
    const col = side === "in" ? centerCol - level : centerCol + level;
    return MARGIN + col * (CARD_WIDTH + COLUMN_GAP);
  };

  const center: PlacedCard = {
    key: "center",
    card: diagram.center,
    x: MARGIN + inLevels * (CARD_WIDTH + COLUMN_GAP),
    y: MARGIN + (tallest - centerHeight) / 2,
    width: CARD_WIDTH,
    height: centerHeight,
  };

  const placedByKey = new Map<string, PlacedCard>([["center", center]]);
  const neighbors: PlacedCard[] = [];
  for (const [, entries] of columnOf) {
    const heights = entries.map((n) => cardHeight(n.card));
    const first = entries[0];
    if (!first) {
      continue;
    }

    const x = columnX(first.side, first.level);
    let y = MARGIN + (tallest - columnHeight(heights)) / 2;
    entries.forEach((neighbor, i) => {
      const placed: PlacedCard = {
        key: neighbor.key,
        card: neighbor.card,
        x,
        y,
        width: CARD_WIDTH,
        height: heights[i] ?? 0,
      };
      neighbors.push(placed);
      placedByKey.set(neighbor.key, placed);
      y += (heights[i] ?? 0) + CARD_GAP_Y;
    });
  }

  // Edges run left-to-right between a neighbor and its fromKey card; the
  // arrow always points rightward (into the center-ward card on the "in"
  // side, out of it on the "out" side).
  const edges: DiagramEdge[] = [];
  for (const neighbor of diagram.neighbors) {
    const placed = placedByKey.get(neighbor.key);
    const from = placedByKey.get(neighbor.fromKey);
    if (!placed || !from) {
      continue;
    }

    const [left, right] = neighbor.side === "in" ? [placed, from] : [from, placed];
    edges.push({
      x1: left.x + CARD_WIDTH,
      y1: anchorY(left),
      x2: right.x,
      y2: anchorY(right),
      label: neighbor.property,
      relation: neighbor.relation,
    });
  }

  return {
    width: 2 * MARGIN + (inLevels + outLevels + 1) * CARD_WIDTH + (inLevels + outLevels) * COLUMN_GAP,
    height,
    center,
    neighbors,
    edges,
  };
}
