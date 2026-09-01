import { IconChevronsDown, IconChevronsUp } from "@tabler/icons-react";
import { PanelBody } from "@tredespace/ui/dockable";
import { Button, TextInput } from "@tredespace/ui/widgets";
import { type JSX, useEffect, useMemo, useRef, useState } from "react";
import { groupByProperty, type PlantModel } from "../../../lib/dexpi/plantModel.ts";
import { setSelectedObject } from "../../../state/selection/selection.actions.ts";
import { selectionState } from "../../../state/selection/selection.state.ts";
import { getLoadedDocument } from "../../../state/viewer/viewer.actions.ts";
import { viewerState } from "../../../state/viewer/viewer.state.ts";
import { ObjectDataView } from "../objectDataView/ObjectDataView.tsx";
import { type FilteredNode, PlantTree, type RevealRequest, type SelectModifiers } from "../PlantTree.tsx";
import { ALL_SEARCH_FIELDS, ancestorIds, collectGroupIds, filterNode } from "../plantTreeFilter.ts";
import { TreeContextMenu } from "../TreeContextMenu.tsx";
import { TreeDataSplit } from "../TreeDataSplit.tsx";
import { useTreeSelection } from "../useTreeSelection.ts";

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const SHOW_FIELDS = new Set<"type">(["type"]);

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * Mirrors the file's raw `ConceptualModel` XML containment exactly — one
 * expandable group row per `<Components property=…>` bucket, one row per
 * object underneath — with the selected object's Data and Inverse
 * References embedded below. Starts fully collapsed; reveals and follows
 * the app's global selection like the Explorer does.
 */
export function ConceptualModelTreePanel(): JSX.Element {
  const { docRevision, file } = viewerState.use();
  const { selectedId, selectedIds } = selectionState.use();
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [revealRequest, setRevealRequest] = useState<RevealRequest>(null);
  const revealNonceRef = useRef(0);
  const selectionFromTreeRef = useRef(false);

  const plant = useMemo<PlantModel | null>(() => {
    void docRevision;
    return getLoadedDocument()?.plant ?? null;
  }, [docRevision]);

  const grouped = useMemo<PlantModel | null>(() => (plant ? groupByProperty(plant) : null), [plant]);

  const roots = useMemo<readonly FilteredNode[]>(() => {
    const normalized = query.trim().toLowerCase();
    return (grouped?.roots ?? [])
      .map((r) => filterNode(r, normalized, new Set(ALL_SEARCH_FIELDS)))
      .filter((c): c is FilteredNode => c !== null);
  }, [grouped, query]);

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

  // A fresh document starts fully collapsed.
  useEffect(() => {
    void docRevision;
    setExpanded(new Set());
  }, [docRevision]);

  // A selection made anywhere else must become visible here: expand its
  // ancestors and scroll the row into view.
  useEffect(() => {
    if (!selectedId) {
      return;
    }

    if (selectionFromTreeRef.current) {
      selectionFromTreeRef.current = false;
      return;
    }

    const chain = ancestorIds(grouped ?? undefined, selectedId);
    setExpanded((prev) => new Set([...prev, ...chain]));
    revealNonceRef.current += 1;
    setRevealRequest({ id: selectedId, nonce: revealNonceRef.current });
  }, [selectedId, grouped]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!file || !plant) {
    return (
      <PanelBody className="flex h-full items-center justify-center p-4 text-center text-slate-500 text-xs">
        Open a DEXPI file to get started.
      </PanelBody>
    );
  }

  return (
    <PanelBody className="flex h-full flex-col p-0">
      <div className="flex shrink-0 items-center gap-1 p-2 pb-1">
        <TextInput value={query} onChange={setQuery} placeholder="Search objects…" className="flex-1" />
        <Button iconOnly icon={<IconChevronsDown />} tooltip="Expand all" onClick={handleExpandAll} />
        <Button iconOnly icon={<IconChevronsUp />} tooltip="Collapse all" onClick={handleCollapseAll} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <TreeDataSplit
          tree={
            <PlantTree
              nodes={roots}
              selectedIds={new Set(selectedIds)}
              expanded={expanded}
              forceExpand={forceExpand}
              show={SHOW_FIELDS}
              resizableTypeColumn
              revealRequest={revealRequest}
              onSelect={handleSelect}
              onToggle={handleToggle}
              onContextMenu={treeSelection.handleContextMenu}
            />
          }
          data={<ObjectDataView plant={plant} nodeId={selectedId} onSelect={setSelectedObject} />}
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
