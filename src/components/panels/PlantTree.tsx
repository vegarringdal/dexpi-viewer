import { IconChevronDown, IconChevronRight, IconFile, IconFolder } from "@tabler/icons-react";
import { type JSX, useEffect, useMemo, useRef, useState } from "react";
import type { DiscProfile } from "../../lib/dexpi/discProfile.ts";
import type { PlantNode } from "../../lib/dexpi/plantModel.ts";
import { resolveSymbolReferenceName } from "../../lib/dexpi/profileSymbolSummary.ts";
import { setHoveredObject } from "../../state/selection/selection.actions.ts";
import { flattenVisibleNodes } from "./plantTreeFilter.ts";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** The plant hierarchy after search filtering/pruning. */
export type FilteredNode = Readonly<{
  node: PlantNode;
  children: readonly FilteredNode[];
}>;

/** Which modifier the click carried (drives multi-select behaviour). */
export type SelectModifiers = Readonly<{
  toggle: boolean;
  range: boolean;
}>;

/** Extra columns a tree row can display beside the name. */
export type ShowField = "type" | "id" | "persistentId";

/** A request to scroll one row into view. `nonce` forces the effect to
 *  re-fire even when `id` repeats (e.g. re-selecting the same object from
 *  the drawing after having scrolled away from it in the tree). */
export type RevealRequest = Readonly<{ id: string; nonce: number }> | null;

type PlantTreeProps = Readonly<{
  nodes: readonly FilteredNode[];
  selectedIds: ReadonlySet<string>;
  /** Ids of expanded group rows (ignored while forceExpand). */
  expanded: ReadonlySet<string>;
  /** Render everything expanded (active search). */
  forceExpand: boolean;
  /** Which extra columns to render on every row. */
  show: ReadonlySet<ShowField>;
  /** When true, the type column gets a fixed width (the
   *  `--pt-type-col-width` CSS var, set by an ancestor) and a divider line,
   *  so it reads as a real resizable column instead of trailing text —
   *  used by the ConceptualModel/Diagram Tree panels. Explorer omits this
   *  and keeps today's auto-width layout. */
  resizableTypeColumn?: boolean;
  /** Resolves a ShapeUsage/SymbolUsage row's Symbol/Shape reference for the
   *  type column, when its label carries no more specific name of its own. */
  profile?: DiscProfile | null;
  /** Scrolls the named row into view once, when this changes. */
  revealRequest?: RevealRequest;
  onSelect: (id: string, modifiers: SelectModifiers) => void;
  onToggle: (id: string) => void;
  onContextMenu: (id: string, x: number, y: number) => void;
}>;

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Every row is forced to exactly this height so the windowed rendering's
 *  offset math (`index * ROW_HEIGHT_PX`) stays exact. */
const ROW_HEIGHT_PX = 22;

/** Extra rows rendered beyond the viewport so a fast scroll or a
 *  programmatic reveal doesn't flash empty space before the next paint. */
const OVERSCAN_ROWS = 8;

/** The row tooltip's fixed-width box only wraps at whitespace — cap a
 *  single unbroken token (a synthetic drawing id) below that width. */
const TOOLTIP_ID_MAX_CHARS = 60;

/** Elides the middle of a long, space-free token — keeps both the leading
 *  and trailing context, which for a positional XPath id is usually the
 *  most identifying part. */
function truncateMiddle(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }

  const keep = Math.floor((maxChars - 1) / 2);
  return `${value.slice(0, keep)}…${value.slice(value.length - keep)}`;
}

// -----------------------------------------------------------------------------
// Row
// -----------------------------------------------------------------------------

type RowProps = Readonly<{
  item: FilteredNode;
  depth: number;
  top: number;
  isOpen: boolean;
  selectedIds: ReadonlySet<string>;
  show: ReadonlySet<ShowField>;
  resizableTypeColumn: boolean | undefined;
  profile: DiscProfile | null | undefined;
  onSelect: (id: string, modifiers: SelectModifiers) => void;
  onToggle: (id: string) => void;
  onContextMenu: (id: string, x: number, y: number) => void;
}>;

function TreeRow(props: RowProps): JSX.Element {
  const {
    item,
    depth,
    top,
    isOpen,
    selectedIds,
    show,
    resizableTypeColumn,
    profile,
    onSelect,
    onToggle,
    onContextMenu,
  } = props;
  const { node } = item;
  const hasChildren = item.children.length > 0;
  const isSelected = selectedIds.has(node.id);
  const shortType = node.typeName.split(".").pop() ?? node.typeName;
  // In resizable-column mode the main column carries the type (matching
  // the raw XML property-grid layout) and the side column carries the
  // resolved value/tag — the reverse of the Explorer's name-first layout.
  // A row with no naming attribute falls back to its type name (see
  // plantModel.ts's resolveLabel) in EITHER spelling — `SymbolUsage` or
  // the qualified `Diagram.ShapeUsage` — so both mean "the label adds
  // nothing here"; for a ShapeUsage/SymbolUsage the profile Symbol/Shape
  // reference it draws is the far more useful thing to put there. Only
  // when that resolves: a shape from the document's own catalogue (not
  // the profile's) still falls through to the plain label rule below.
  const labelIsJustItsType = node.label === shortType || node.label === node.typeName;
  const resolvedSymbolName = labelIsJustItsType ? resolveSymbolReferenceName(node, profile) : null;
  const mainText = resizableTypeColumn ? shortType : node.label;
  const sideText = resizableTypeColumn
    ? (resolvedSymbolName ?? (node.label === shortType ? "" : node.label))
    : shortType;
  const persistentIds = node.persistentIds.map((pid) => pid.value).join(", ");
  // A Diagram-side object with no id="" in the source XML is keyed by its
  // positional XPath instead (plantModel.ts's walkPlant) — an internal-only
  // stand-in, not a real DEXPI id, so it's left off this line entirely
  // (the Data panel below always shows the XPath properly labeled). A real
  // id is still truncated: the tooltip widget only wraps at whitespace, and
  // an unbroken long token would overflow its fixed-width box otherwise.
  const isSyntheticId = node.id === node.xpath;
  const tooltip = [
    `Name: ${node.label}`,
    `Type: ${shortType}`,
    ...(isSyntheticId ? [] : [`ID: ${truncateMiddle(node.id, TOOLTIP_ID_MAX_CHARS)}`]),
    `Persistent ID: ${persistentIds || "—"}`,
  ].join("\n");

  const handleClick = (e: React.MouseEvent): void => {
    onSelect(node.id, { toggle: e.ctrlKey || e.metaKey, range: e.shiftKey });
  };

  const handleContextMenu = (e: React.MouseEvent): void => {
    e.preventDefault();
    onContextMenu(node.id, e.clientX, e.clientY);
  };

  return (
    <div
      data-object-id={node.id}
      className={`absolute flex w-full items-center gap-1 pr-1.5 text-xs ${
        isSelected ? "bg-blue-950 text-blue-100" : "text-slate-300 hover:bg-slate-800"
      }`}
      style={{ top, height: ROW_HEIGHT_PX, paddingLeft: `${6 + depth * 14}px` }}
    >
      {hasChildren ? (
        <button
          type="button"
          aria-label={isOpen ? "Collapse" : "Expand"}
          onClick={() => onToggle(node.id)}
          className="shrink-0 cursor-pointer py-0.5 text-slate-500 hover:text-slate-300"
        >
          {isOpen ? <IconChevronDown size={13} /> : <IconChevronRight size={13} />}
        </button>
      ) : (
        <span className="w-[13px] shrink-0" />
      )}
      <button
        type="button"
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setHoveredObject(node.id)}
        onMouseLeave={() => setHoveredObject(null)}
        data-tooltip={tooltip}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-1 py-0.5 text-left"
      >
        {hasChildren ? (
          <IconFolder size={13} className="shrink-0 text-slate-500" />
        ) : (
          <IconFile size={13} className="shrink-0 text-slate-500" />
        )}
        <span className="min-w-0 flex-1 truncate">
          {mainText}
          {show.has("id") && <span className="font-mono text-[10px] text-slate-500"> #{node.id}</span>}
        </span>
        {show.has("persistentId") && persistentIds.length > 0 && (
          <span className="max-w-[35%] shrink-0 truncate font-mono text-[10px] text-slate-500">
            {persistentIds}
          </span>
        )}
        {show.has("type") && (
          <span
            className={
              resizableTypeColumn
                ? "shrink-0 truncate border-slate-800 border-l pl-1.5 text-[10px] text-slate-500"
                : "shrink-0 text-[10px] text-slate-500"
            }
            style={resizableTypeColumn ? { width: "var(--pt-type-col-width, 96px)" } : undefined}
          >
            {sideText}
          </span>
        )}
      </button>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * The object hierarchy, chevron toggles. Selection is multi-capable — plain
 * click, ctrl-toggle and shift-range all report through onSelect with the
 * click's modifiers; right-click reports through onContextMenu. Collapse
 * state is fully controlled by the parent.
 *
 * Column layout: normally name first, bare type trailing. With
 * `resizableTypeColumn` this reverses — type leads (matching the raw XML
 * property-grid the ConceptualModel/Diagram Tree panels mirror) and the
 * resolved value/tag sits in the resizable side column, blank when it
 * wouldn't add information (e.g. synthetic property-group rows).
 *
 * Owns its own scrolling and windows the row list (only rows within
 * `OVERSCAN_ROWS` of the viewport actually mount) — large, mostly-expanded
 * trees (a PipingNetworkSystems subtree with hundreds of segments) stay
 * smooth to scroll regardless of total row count.
 */
export function PlantTree(props: PlantTreeProps): JSX.Element {
  const {
    nodes,
    selectedIds,
    expanded,
    forceExpand,
    show,
    resizableTypeColumn,
    profile,
    revealRequest,
    onSelect,
    onToggle,
    onContextMenu,
  } = props;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  const flatRows = useMemo(
    () => flattenVisibleNodes(nodes, expanded, forceExpand),
    [nodes, expanded, forceExpand],
  );
  // Always current, read (not reacted to) by the reveal effect below — a
  // reveal must not re-fire just because unrelated rows expanded/collapsed.
  const flatRowsRef = useRef(flatRows);
  flatRowsRef.current = flatRows;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }

    const updateHeight = (): void => setViewportHeight(el.clientHeight);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!revealRequest) {
      return;
    }

    const index = flatRowsRef.current.findIndex((row) => row.item.node.id === revealRequest.id);
    const el = scrollRef.current;
    if (index < 0 || !el) {
      return;
    }

    el.scrollTop = Math.max(0, index * ROW_HEIGHT_PX - el.clientHeight / 2);
    setScrollTop(el.scrollTop);
  }, [revealRequest]);

  if (flatRows.length === 0) {
    return <div className="p-3 text-center text-slate-500 text-xs">No objects match.</div>;
  }

  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT_PX) - OVERSCAN_ROWS);
  const end = Math.min(
    flatRows.length,
    Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT_PX) + OVERSCAN_ROWS,
  );

  return (
    <div
      ref={scrollRef}
      className="h-full w-full overflow-auto"
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div className="relative" style={{ height: flatRows.length * ROW_HEIGHT_PX }}>
        {flatRows.slice(start, end).map((row, i) => (
          <TreeRow
            key={row.item.node.id}
            item={row.item}
            depth={row.depth}
            top={(start + i) * ROW_HEIGHT_PX}
            isOpen={forceExpand || expanded.has(row.item.node.id)}
            selectedIds={selectedIds}
            show={show}
            resizableTypeColumn={resizableTypeColumn}
            profile={profile}
            onSelect={onSelect}
            onToggle={onToggle}
            onContextMenu={onContextMenu}
          />
        ))}
      </div>
    </div>
  );
}
