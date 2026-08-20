import { IconChevronDown, IconChevronRight, IconFile, IconFolder } from "@tabler/icons-react";
import type { JSX } from "react";
import type { PlantNode } from "../../lib/dexpi/plantModel.ts";
import { setHoveredObject } from "../../state/selection/selection.actions.ts";

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

type PlantTreeProps = Readonly<{
  nodes: readonly FilteredNode[];
  selectedIds: ReadonlySet<string>;
  /** Ids of expanded group rows (ignored while forceExpand). */
  expanded: ReadonlySet<string>;
  /** Render everything expanded (active search). */
  forceExpand: boolean;
  /** Which extra columns to render on every row. */
  show: ReadonlySet<ShowField>;
  onSelect: (id: string, modifiers: SelectModifiers) => void;
  onToggle: (id: string) => void;
  onContextMenu: (id: string, x: number, y: number) => void;
}>;

// -----------------------------------------------------------------------------
// Rows
// -----------------------------------------------------------------------------

type RowProps = PlantTreeProps & Readonly<{ item: FilteredNode; depth: number }>;

function TreeRow(props: RowProps): JSX.Element {
  const { item, depth, selectedIds, expanded, forceExpand, show, onSelect, onToggle, onContextMenu } = props;
  const { node } = item;
  const hasChildren = item.children.length > 0;
  const isOpen = forceExpand || expanded.has(node.id);
  const isSelected = selectedIds.has(node.id);
  const shortType = node.typeName.split(".").pop() ?? node.typeName;
  const persistentIds = node.persistentIds.map((pid) => pid.value).join(", ");
  const tooltip = [
    `Name: ${node.label}`,
    `Type: ${shortType}`,
    `ID: ${node.id}`,
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
    <>
      <div
        data-object-id={node.id}
        className={`flex w-full items-center gap-1 pr-1.5 text-xs ${
          isSelected ? "bg-blue-950 text-blue-100" : "text-slate-300 hover:bg-slate-800"
        }`}
        style={{ paddingLeft: `${6 + depth * 14}px` }}
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
            {node.label}
            {show.has("id") && <span className="font-mono text-[10px] text-slate-500"> #{node.id}</span>}
          </span>
          {show.has("persistentId") && persistentIds.length > 0 && (
            <span className="max-w-[35%] shrink-0 truncate font-mono text-[10px] text-slate-500">
              {persistentIds}
            </span>
          )}
          {show.has("type") && <span className="shrink-0 text-[10px] text-slate-500">{shortType}</span>}
        </button>
      </div>
      {hasChildren &&
        isOpen &&
        item.children.map((child) => (
          <TreeRow key={child.node.id} {...props} item={child} depth={depth + 1} />
        ))}
    </>
  );
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * The object hierarchy: name first, bare type right-aligned on every row
 * (groups included), chevron toggles. Selection is multi-capable — plain
 * click, ctrl-toggle and shift-range all report through onSelect with the
 * click's modifiers; right-click reports through onContextMenu. Collapse
 * state is fully controlled by the parent.
 */
export function PlantTree(props: PlantTreeProps): JSX.Element {
  if (props.nodes.length === 0) {
    return <div className="p-3 text-center text-slate-500 text-xs">No objects match.</div>;
  }

  return (
    <div>
      {props.nodes.map((item) => (
        <TreeRow key={item.node.id} {...props} item={item} depth={0} />
      ))}
    </div>
  );
}
