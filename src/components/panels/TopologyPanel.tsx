import { IconChevronsDown, IconChevronsUp } from "@tabler/icons-react";
import { PanelBody } from "@tredespace/ui/dockable";
import { Button, TextInput } from "@tredespace/ui/widgets";
import { type JSX, useEffect, useMemo, useRef, useState } from "react";
import { requestZoomToObject } from "../../state/selection/selection.actions.ts";
import { selectionState } from "../../state/selection/selection.state.ts";
import { getLoadedDocument } from "../../state/viewer/viewer.actions.ts";
import { viewerState } from "../../state/viewer/viewer.state.ts";
import { FieldToggleRow } from "./FieldToggleRow.tsx";
import { type FilteredNode, PlantTree, type SelectModifiers, type ShowField } from "./PlantTree.tsx";
import {
  ALL_SEARCH_FIELDS,
  ancestorIds,
  collectGroupIds,
  filterNode,
  type SearchField,
} from "./plantTreeFilter.ts";
import { TreeContextMenu } from "./TreeContextMenu.tsx";
import { useTreeSelection } from "./useTreeSelection.ts";

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Lets the expanded rows render before scrolling the revealed row into view. */
const REVEAL_SCROLL_DELAY_MS = 60;

const SEARCH_FIELD_LABELS: Readonly<Record<SearchField, string>> = {
  name: "Name",
  type: "Type",
  id: "ID",
  persistentId: "Persistent ID",
};

const SHOW_FIELDS: readonly ShowField[] = ["type", "id", "persistentId"];

const SHOW_FIELD_LABELS: Readonly<Record<ShowField, string>> = {
  type: "Type",
  id: "ID",
  persistentId: "Persistent ID",
};

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function TopologyPanel(): JSX.Element {
  const { docRevision, file } = viewerState.use();
  const { selectedId, selectedIds } = selectionState.use();
  const [query, setQuery] = useState("");
  const [searchFields, setSearchFields] = useState<ReadonlySet<SearchField>>(new Set(ALL_SEARCH_FIELDS));
  const [showFields, setShowFields] = useState<ReadonlySet<ShowField>>(new Set(["type"]));
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectionFromTreeRef = useRef(false);

  const roots = useMemo<readonly FilteredNode[]>(() => {
    void docRevision;
    const normalized = query.trim().toLowerCase();
    return (getLoadedDocument()?.plant.roots ?? [])
      .map((r) => filterNode(r, normalized, searchFields))
      .filter((c): c is FilteredNode => c !== null);
  }, [docRevision, query, searchFields]);

  const forceExpand = query.trim().length > 0;
  const treeSelection = useTreeSelection(roots, expanded, forceExpand);

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  const handleSelect = (id: string, modifiers: SelectModifiers): void => {
    selectionFromTreeRef.current = true;
    treeSelection.handleSelect(id, modifiers);
  };

  const handleToggle = (id: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleExpandAll = (): void => setExpanded(collectGroupIds(roots, new Set()));
  const handleCollapseAll = (): void => setExpanded(new Set());

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  // A fresh document starts fully expanded.
  // biome-ignore lint/correctness/useExhaustiveDependencies: expand once per document, not per search keystroke.
  useEffect(() => {
    void docRevision;
    setExpanded(collectGroupIds(roots, new Set()));
  }, [docRevision]);

  // A selection made in the drawing must become visible here: expand its
  // ancestors and scroll the row into view.
  useEffect(() => {
    if (!selectedId) {
      return;
    }

    if (selectionFromTreeRef.current) {
      selectionFromTreeRef.current = false;
      return;
    }

    const chain = ancestorIds(getLoadedDocument()?.plant, selectedId);
    setExpanded((prev) => new Set([...prev, ...chain]));
    const timer = setTimeout(() => {
      const container = containerRef.current;
      const row = container?.querySelector(`[data-object-id="${CSS.escape(selectedId)}"]`);
      if (container && row instanceof HTMLElement) {
        container.scrollTop = row.offsetTop - container.clientHeight / 2;
      }
    }, REVEAL_SCROLL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [selectedId]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!file) {
    return (
      <PanelBody className="flex h-full items-center justify-center p-4 text-center text-slate-500 text-xs">
        Open a DEXPI file to get started.
      </PanelBody>
    );
  }

  return (
    <PanelBody className="flex h-full flex-col gap-2 p-2">
      <div className="flex shrink-0 items-center gap-1">
        <TextInput value={query} onChange={setQuery} placeholder="Search objects…" className="flex-1" />
        <Button iconOnly icon={<IconChevronsDown />} tooltip="Expand all" onClick={handleExpandAll} />
        <Button iconOnly icon={<IconChevronsUp />} tooltip="Collapse all" onClick={handleCollapseAll} />
        <Button
          disabled={!selectedId}
          onClick={() => selectedId && requestZoomToObject(selectedId)}
          tooltip="Zoom the drawing to the selected object"
        >
          Zoom to
        </Button>
      </div>
      <FieldToggleRow
        label="Search in:"
        fields={ALL_SEARCH_FIELDS}
        labels={SEARCH_FIELD_LABELS}
        active={searchFields}
        requireOne
        onChange={setSearchFields}
      />
      <FieldToggleRow
        label="Show:"
        fields={SHOW_FIELDS}
        labels={SHOW_FIELD_LABELS}
        active={showFields}
        onChange={setShowFields}
      />
      <div ref={containerRef} className="min-h-0 flex-1 overflow-auto">
        <PlantTree
          nodes={roots}
          selectedIds={new Set(selectedIds)}
          expanded={expanded}
          forceExpand={forceExpand}
          show={showFields}
          onSelect={handleSelect}
          onToggle={handleToggle}
          onContextMenu={treeSelection.handleContextMenu}
        />
      </div>
      {treeSelection.menu && (
        <TreeContextMenu
          x={treeSelection.menu.x}
          y={treeSelection.menu.y}
          items={treeSelection.menuItems}
          onClose={treeSelection.closeMenu}
        />
      )}
    </PanelBody>
  );
}
