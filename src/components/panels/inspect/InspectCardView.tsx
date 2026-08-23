import type { JSX, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import type { DiagramRow, DiagramRowTone } from "../../../lib/graph/objectDiagram.ts";
import {
  CARD_WIDTH,
  HEADER_HEIGHT,
  type PlacedCard,
  ROW_HEIGHT,
} from "../../../lib/graph/objectDiagramLayout.ts";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type InspectCardViewProps = Readonly<{
  placed: PlacedCard;
  isCenter: boolean;
  onNavigate: (id: string) => void;
  /** Right-click: open the copy menu at the pointer position. */
  onMenu: (id: string, x: number, y: number) => void;
}>;

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const NAME_COLUMN_CHARS = 24;
const VALUE_COLUMN_CHARS = 22;
const ISSUE_ROW_CHARS = 48;

const SEVERITY_STROKE: Readonly<Record<string, string>> = {
  error: "stroke-red-500",
  warning: "stroke-amber-500",
  info: "stroke-sky-500",
};

const SEVERITY_TEXT: Readonly<Record<string, string>> = {
  error: "fill-red-400",
  warning: "fill-amber-400",
  info: "fill-sky-400",
};

const ROW_NAME_FILL: Readonly<Record<DiagramRowTone, string>> = {
  normal: "fill-slate-400",
  undefined: "fill-slate-500",
  issue: "fill-red-400",
};

const ROW_VALUE_FILL: Readonly<Record<DiagramRowTone, string>> = {
  normal: "fill-slate-200",
  undefined: "fill-slate-500",
  issue: "fill-red-300",
};

// -----------------------------------------------------------------------------
// Helper functions
// -----------------------------------------------------------------------------

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function rowTooltip(row: DiagramRow): string | undefined {
  if (row.tooltip) {
    return row.tooltip;
  }
  if (row.name.length > NAME_COLUMN_CHARS || row.value.length > VALUE_COLUMN_CHARS) {
    return `${row.name}: ${row.value}`;
  }

  return undefined;
}

/** Drawing cards have XPath ids — too long for a tooltip; say what the card
 *  IS instead (right-click still copies the XPath). */
function cardTooltip(card: PlacedCard["card"]): string | undefined {
  if (card.drawing) {
    return "Drawing-side object — not in the Properties panel. Click to inspect; right-click to copy data or XPath.";
  }
  if (card.navigable) {
    return `${card.id} — click to inspect`;
  }

  return card.id || undefined;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/** One UML-style card: title, type, and name/value attribute rows. Drawing-side
 *  objects get a dashed border — they never feed the plant-data views. */
export function InspectCardView({ placed, isCenter, onNavigate, onMenu }: InspectCardViewProps): JSX.Element {
  const { card } = placed;
  const rows = card.rows;

  const handlePointerDown = (e: ReactPointerEvent<SVGGElement>): void => {
    if (card.navigable) {
      e.stopPropagation();
    }
  };

  const handleClick = (): void => {
    if (card.navigable) {
      onNavigate(card.id);
    }
  };

  const handleContextMenu = (e: ReactMouseEvent<SVGGElement>): void => {
    if (!card.id) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    onMenu(card.id, e.clientX, e.clientY);
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: SVG has no native button element.
    <g
      role="button"
      tabIndex={-1}
      transform={`translate(${placed.x} ${placed.y})`}
      className={card.navigable ? "cursor-pointer" : ""}
      data-tooltip={cardTooltip(card)}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      <rect
        width={placed.width}
        height={placed.height}
        rx={6}
        strokeWidth={card.severity ? 1.5 : isCenter ? 1.5 : 1}
        strokeDasharray={card.drawing ? "5 3" : undefined}
        className={`${isCenter ? "fill-blue-950" : "fill-slate-900"} ${
          card.severity
            ? SEVERITY_STROKE[card.severity]
            : isCenter
              ? "stroke-blue-400"
              : "stroke-slate-600 hover:stroke-blue-500"
        }`}
      />
      <text
        x={8}
        y={13}
        className={`${card.broken ? "fill-red-400" : "fill-slate-100"} font-semibold text-[10px]`}
      >
        {truncate(card.title, 30)}
      </text>
      <text x={8} y={24} className={`${card.broken ? "fill-red-400" : "fill-slate-400"} text-[8px]`}>
        {truncate(card.subtitle, 40)}
      </text>
      {rows.length > 0 && (
        <line
          x1={0}
          y1={HEADER_HEIGHT - 2}
          x2={CARD_WIDTH}
          y2={HEADER_HEIGHT - 2}
          className="stroke-slate-700"
        />
      )}
      {rows.map((row, i) => (
        <text
          key={row.name + String(i)}
          x={8}
          y={HEADER_HEIGHT + 8 + i * ROW_HEIGHT}
          className="text-[8px]"
          data-tooltip={rowTooltip(row)}
        >
          <tspan className={ROW_NAME_FILL[row.tone]}>{truncate(row.name, NAME_COLUMN_CHARS)} </tspan>
          <tspan className={ROW_VALUE_FILL[row.tone]}>{truncate(row.value, VALUE_COLUMN_CHARS)}</tspan>
        </text>
      ))}
      {card.issueRows.map((line, i) => (
        <text
          key={line + String(i)}
          x={8}
          y={HEADER_HEIGHT + 8 + (rows.length + i) * ROW_HEIGHT}
          className={`text-[8px] ${SEVERITY_TEXT[card.severity ?? "error"]}`}
          data-tooltip={line}
        >
          ⚠ {truncate(line, ISSUE_ROW_CHARS)}
        </text>
      ))}
    </g>
  );
}
