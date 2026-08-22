import type { JSX, PointerEvent as ReactPointerEvent } from "react";
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

// -----------------------------------------------------------------------------
// Helper functions
// -----------------------------------------------------------------------------

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/** One UML-style card: title, type, and name/value attribute rows. */
export function InspectCardView({ placed, isCenter, onNavigate }: InspectCardViewProps): JSX.Element {
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

  return (
    // biome-ignore lint/a11y/useSemanticElements: SVG has no native button element.
    <g
      role="button"
      tabIndex={-1}
      transform={`translate(${placed.x} ${placed.y})`}
      className={card.navigable ? "cursor-pointer" : ""}
      data-tooltip={card.navigable ? `${card.id} — click to inspect` : card.id || undefined}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
    >
      <rect
        width={placed.width}
        height={placed.height}
        rx={6}
        strokeWidth={card.severity ? 1.5 : isCenter ? 1.5 : 1}
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
        <text key={row.name + String(i)} x={8} y={HEADER_HEIGHT + 8 + i * ROW_HEIGHT} className="text-[8px]">
          <tspan className="fill-slate-400">{truncate(row.name, NAME_COLUMN_CHARS)} </tspan>
          <tspan className="fill-slate-200">{truncate(row.value, VALUE_COLUMN_CHARS)}</tspan>
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
