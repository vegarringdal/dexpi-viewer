import { useState } from "react";
import {
  setSelectedObject,
  setSelectedObjects,
  toggleSelectedObject,
} from "../../state/selection/selection.actions.ts";
import { selectionState } from "../../state/selection/selection.state.ts";
import { getLoadedDocument, setViewerError } from "../../state/viewer/viewer.actions.ts";
import type { FilteredNode, SelectModifiers } from "./PlantTree.tsx";
import type { MenuItem } from "./TreeContextMenu.tsx";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type MenuState = Readonly<{ x: number; y: number; targetId: string }>;

type TreeSelection = Readonly<{
  menu: MenuState | null;
  menuItems: readonly MenuItem[];
  closeMenu: () => void;
  handleSelect: (id: string, modifiers: SelectModifiers) => void;
  handleContextMenu: (id: string, x: number, y: number) => void;
}>;

// -----------------------------------------------------------------------------
// Helper functions
// -----------------------------------------------------------------------------

/** The subtree rooted at `id` (that node included), or null if not in the tree. */
function findSubtree(items: readonly FilteredNode[], id: string): FilteredNode | null {
  for (const item of items) {
    if (item.node.id === id) {
      return item;
    }

    const hit = findSubtree(item.children, id);
    if (hit) {
      return hit;
    }
  }
  return null;
}

function collectSubtreeIds(item: FilteredNode, out: string[] = []): string[] {
  out.push(item.node.id);
  for (const child of item.children) {
    collectSubtreeIds(child, out);
  }
  return out;
}

/** Row ids in on-screen order (respecting collapse state) for range-select. */
function visibleRowIds(
  items: readonly FilteredNode[],
  expanded: ReadonlySet<string>,
  forceExpand: boolean,
  out: string[] = [],
): string[] {
  for (const item of items) {
    out.push(item.node.id);
    if (item.children.length > 0 && (forceExpand || expanded.has(item.node.id))) {
      visibleRowIds(item.children, expanded, forceExpand, out);
    }
  }
  return out;
}

function copyLine(id: string, kind: "label" | "type" | "full"): string {
  const node = getLoadedDocument()?.plant.byId.get(id);
  const label = node?.label ?? id;
  const type = node?.typeName.split(".").pop() ?? "";
  if (kind === "label") {
    return label;
  }

  if (kind === "type") {
    return type;
  }

  return [label, type, id].join("\t");
}

async function copySelection(kind: "label" | "type" | "full"): Promise<void> {
  const { selectedIds } = selectionState.get();
  const text = selectedIds.map((id) => copyLine(id, kind)).join("\n");
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    setViewerError("Could not write to the clipboard.");
  }
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

/**
 * Multi-select + context-menu behaviour for the object tree: plain click
 * replaces the selection, ctrl/cmd toggles, shift selects the visible-row
 * range from the anchor. Right-click selects the row (unless it is already
 * in the selection) and opens copy options acting on the whole selection.
 */
export function useTreeSelection(
  roots: readonly FilteredNode[],
  expanded: ReadonlySet<string>,
  forceExpand: boolean,
): TreeSelection {
  const [menu, setMenu] = useState<MenuState | null>(null);

  const handleSelect = (id: string, modifiers: SelectModifiers): void => {
    if (modifiers.toggle) {
      toggleSelectedObject(id);
      return;
    }

    const anchor = selectionState.get().selectedId;
    if (modifiers.range && anchor) {
      const rows = visibleRowIds(roots, expanded, forceExpand);
      const from = rows.indexOf(anchor);
      const to = rows.indexOf(id);
      if (from >= 0 && to >= 0) {
        const range = rows.slice(Math.min(from, to), Math.max(from, to) + 1);
        setSelectedObjects(range, id);
        return;
      }
    }

    setSelectedObject(id);
  };

  const handleContextMenu = (id: string, x: number, y: number): void => {
    if (!selectionState.get().selectedIds.includes(id)) {
      setSelectedObject(id);
    }
    setMenu({ x, y, targetId: id });
  };

  const handleSelectChildren = (targetId: string): void => {
    const subtree = findSubtree(roots, targetId);
    if (subtree) {
      setSelectedObjects(collectSubtreeIds(subtree), targetId);
    }
  };

  const targetSubtree = menu ? findSubtree(roots, menu.targetId) : null;
  const menuItems: readonly MenuItem[] = [
    ...(menu && (targetSubtree?.children.length ?? 0) > 0
      ? [{ label: "Select children", onClick: () => handleSelectChildren(menu.targetId) }]
      : []),
    { label: "Copy label", onClick: () => void copySelection("label") },
    { label: "Copy type", onClick: () => void copySelection("type") },
    { label: "Copy label + type + id", onClick: () => void copySelection("full") },
  ];

  return { menu, menuItems, closeMenu: () => setMenu(null), handleSelect, handleContextMenu };
}
