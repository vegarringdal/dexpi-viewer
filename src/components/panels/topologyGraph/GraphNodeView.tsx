import type { JSX, PointerEvent as ReactPointerEvent } from "react";
import {
  CHAR_WIDTH_PX,
  type LayoutNode,
  NODE_PADDING_X,
  TYPE_CHAR_FACTOR,
  truncateLabel,
} from "../../../lib/graph/layeredLayout.ts";
import type { LinkTint } from "../../../lib/graph/linkedTints.ts";
import type { NodeCategory, SemanticNode } from "../../../lib/graph/semanticGraph.ts";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type GraphNodeViewProps = Readonly<{
  node: SemanticNode;
  placement: LayoutNode;
  isSelected: boolean;
  isHovered: boolean;
  /** Relation to the selected node, tinting this node's background. */
  linkTint?: LinkTint | undefined;
  onClick: (id: string, isToggle: boolean) => void;
  onDoubleClick: (id: string) => void;
  onHover: (id: string | null) => void;
}>;

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const LABEL_BASELINE_Y = 15;
const TYPE_BASELINE_Y = 28;
const MAX_TOOLTIP_ATTRIBUTES = 8;

// The @tredespace/ui light theme remaps only the slate/blue token scales, so
// the box fill must stay on slate (it inverts with the theme) and the category
// reads from the border, in mid-scale tones legible on both backgrounds.
// Translucent mid-scale tints read on both themes (the fill underneath is the
// remapped slate). Amber/green mirror the app's upstream/downstream trace colors.
const LINK_TINT_FILL: Readonly<Record<LinkTint, string>> = {
  upstream: "fill-amber-500/20",
  downstream: "fill-green-500/20",
  signal: "fill-violet-500/25",
};

const CATEGORY_STROKE: Readonly<Record<NodeCategory, string>> = {
  equipment: "stroke-emerald-600",
  piping: "stroke-slate-500",
  instrumentation: "stroke-violet-500",
  process: "stroke-cyan-600",
  connection: "stroke-slate-500",
  other: "stroke-slate-600",
};

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/** One graph node: rounded rect, label + type lines, attribute tooltip. */
export function GraphNodeView({
  node,
  placement,
  isSelected,
  isHovered,
  linkTint,
  onClick,
  onDoubleClick,
  onHover,
}: GraphNodeViewProps): JSX.Element {
  const fill = isSelected ? "fill-blue-950" : "fill-slate-900";
  const stroke = isSelected
    ? "stroke-blue-400"
    : isHovered
      ? "stroke-blue-500"
      : CATEGORY_STROKE[node.category];
  const tooltip = [
    `${node.label} — ${node.typeName}`,
    ...node.attributes.slice(0, MAX_TOOLTIP_ATTRIBUTES).map((a) => `${a.name}: ${a.value}`),
  ].join("\n");

  const handlePointerDown = (e: ReactPointerEvent<SVGGElement>): void => {
    e.stopPropagation();
  };

  const isMini = node.category === "connection";

  return (
    // biome-ignore lint/a11y/useSemanticElements: SVG has no native button element.
    <g
      role="button"
      tabIndex={-1}
      data-tooltip={tooltip}
      transform={`translate(${placement.x} ${placement.y})`}
      className="cursor-pointer"
      onPointerDown={handlePointerDown}
      onPointerEnter={() => onHover(node.id)}
      onPointerLeave={() => onHover(null)}
      onClick={(e) => onClick(node.id, e.ctrlKey || e.metaKey)}
      onDoubleClick={() => onDoubleClick(node.id)}
    >
      <rect
        width={placement.width}
        height={placement.height}
        rx={isMini ? placement.height / 2 : 6}
        strokeWidth={isSelected ? 1.5 : 1}
        strokeDasharray={isMini ? "3 2" : undefined}
        className={`${fill} ${stroke}`}
      />
      {linkTint !== undefined && !isSelected && (
        <rect
          width={placement.width}
          height={placement.height}
          rx={isMini ? placement.height / 2 : 6}
          className={`pointer-events-none ${LINK_TINT_FILL[linkTint]}`}
        />
      )}
      {isMini ? (
        <text
          x={placement.width / 2}
          y={placement.height / 2 + 3}
          fontSize={9}
          textAnchor="middle"
          className={isSelected ? "fill-blue-100" : "fill-slate-300"}
        >
          {truncateLabel(node.label, placement.width, CHAR_WIDTH_PX * TYPE_CHAR_FACTOR)}
        </text>
      ) : (
        <>
          <text
            x={NODE_PADDING_X}
            y={LABEL_BASELINE_Y}
            fontSize={11}
            className={isSelected ? "fill-blue-100" : "fill-slate-200"}
          >
            {truncateLabel(node.label, placement.width)}
          </text>
          <text
            x={NODE_PADDING_X}
            y={TYPE_BASELINE_Y}
            fontSize={9}
            className={isSelected ? "fill-blue-300" : "fill-slate-500"}
          >
            {truncateLabel(node.typeName, placement.width, CHAR_WIDTH_PX * TYPE_CHAR_FACTOR)}
          </text>
        </>
      )}
    </g>
  );
}
