import { IconChevronsDown, IconChevronsUp } from "@tabler/icons-react";
import { PanelBody } from "@tredespace/ui/dockable";
import { Button, TextInput } from "@tredespace/ui/widgets";
import { type JSX, useEffect, useMemo, useRef, useState } from "react";
import { diagramPlantModel, groupByProperty, type PlantModel } from "../../../lib/dexpi/plantModel.ts";
import { setSelectedObject } from "../../../state/selection/selection.actions.ts";
import { selectionState } from "../../../state/selection/selection.state.ts";
import { getLoadedDocument } from "../../../state/viewer/viewer.actions.ts";
import { viewerState } from "../../../state/viewer/viewer.state.ts";
import { ObjectDataView } from "../objectDataView/ObjectDataView.tsx";
import { type FilteredNode, PlantTree, type RevealRequest } from "../PlantTree.tsx";
import { ALL_SEARCH_FIELDS, ancestorIds, collectGroupIds, filterNode } from "../plantTreeFilter.ts";
import { TreeDataSplit } from "../TreeDataSplit.tsx";

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const SHOW_FIELDS = new Set<"type">(["type"]);

/** The reference properties that tie a Diagram-side object back to the
 *  ConceptualModel object it draws (a shape/group) or annotates (a label). */
const CROSS_LINK_PROPERTIES = ["Represents", "Object"];

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function crossLinkTarget(diagramModel: PlantModel, diagramNodeId: string): string | undefined {
  const node = diagramModel.byId.get(diagramNodeId);
  for (const property of CROSS_LINK_PROPERTIES) {
    const target = node?.references.find((r) => r.property === property)?.targets[0];
    if (target) {
      return target;
    }
  }
  return undefined;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * Mirrors the file's raw `Diagram` XML containment exactly — same shape as
 * ConceptualModelTreePanel, but over the sibling `Diagram` composition.
 * Diagram objects carry synthetic (positional-xpath) ids that aren't valid
 * global selection targets, so selection here is local; a row is
 * cross-linked to the app's global selection via its own `Represents`/
 * `Object` reference back to a real conceptual object, in both directions.
 */
export function DiagramTreePanel(): JSX.Element {
  const { docRevision, file } = viewerState.use();
  const { selectedId } = selectionState.use();
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [selectedDiagramId, setSelectedDiagramId] = useState<string | null>(null);
  const [revealRequest, setRevealRequest] = useState<RevealRequest>(null);
  const revealNonceRef = useRef(0);
  const selectionFromTreeRef = useRef(false);

  const diagramModel = useMemo<PlantModel | null>(() => {
    void docRevision;
    const doc = getLoadedDocument();
    return doc ? diagramPlantModel(doc.root) : null;
  }, [docRevision]);

  const grouped = useMemo<PlantModel | null>(
    () => (diagramModel ? groupByProperty(diagramModel) : null),
    [diagramModel],
  );

  const roots = useMemo<readonly FilteredNode[]>(() => {
    const normalized = query.trim().toLowerCase();
    return (grouped?.roots ?? [])
      .map((r) => filterNode(r, normalized, new Set(ALL_SEARCH_FIELDS)))
      .filter((c): c is FilteredNode => c !== null);
  }, [grouped, query]);

  const forceExpand = query.trim().length > 0;

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  const handleSelect = (id: string): void => {
    selectionFromTreeRef.current = true;
    setSelectedDiagramId(id);
    if (diagramModel) {
      const target = crossLinkTarget(diagramModel, id);
      if (target) {
        setSelectedObject(target);
      }
    }
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

  // A fresh document starts fully collapsed, with nothing locally selected.
  useEffect(() => {
    void docRevision;
    setExpanded(new Set());
    setSelectedDiagramId(null);
  }, [docRevision]);

  // A selection made elsewhere (drawing, ConceptualModel Tree, …) reveals
  // its Diagram-side representation here, unless the row already shown
  // already represents it (don't fight a user's pick among duplicates).
  useEffect(() => {
    if (!selectedId || !diagramModel) {
      return;
    }

    if (selectionFromTreeRef.current) {
      selectionFromTreeRef.current = false;
      return;
    }

    if (selectedDiagramId && crossLinkTarget(diagramModel, selectedDiagramId) === selectedId) {
      return;
    }

    const candidates = diagramModel.referencedBy.get(selectedId) ?? [];
    const match =
      candidates.find((c) => c.property === "Represents") ??
      candidates.find((c) => c.property === "Object") ??
      candidates[0];
    if (!match) {
      return;
    }

    setSelectedDiagramId(match.fromId);
    const chain = ancestorIds(grouped ?? undefined, match.fromId);
    setExpanded((prev) => new Set([...prev, ...chain]));
    revealNonceRef.current += 1;
    setRevealRequest({ id: match.fromId, nonce: revealNonceRef.current });
  }, [selectedId, diagramModel, grouped, selectedDiagramId]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!file || !diagramModel) {
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
              selectedIds={new Set(selectedDiagramId ? [selectedDiagramId] : [])}
              expanded={expanded}
              forceExpand={forceExpand}
              show={SHOW_FIELDS}
              resizableTypeColumn
              revealRequest={revealRequest}
              onSelect={handleSelect}
              onToggle={handleToggle}
              onContextMenu={handleSelect}
            />
          }
          data={<ObjectDataView plant={diagramModel} nodeId={selectedDiagramId} onSelect={handleSelect} />}
        />
      </div>
    </PanelBody>
  );
}
