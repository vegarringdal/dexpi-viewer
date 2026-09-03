import { IconChevronsDown, IconChevronsUp } from "@tabler/icons-react";
import { PanelBody } from "@tredespace/ui/dockable";
import { Button, TextInput } from "@tredespace/ui/widgets";
import { type JSX, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  diagramPlantModel,
  groupByProperty,
  nearestRepresentedId,
  type PlantModel,
} from "../../../lib/dexpi/plantModel.ts";
import { clearDiagramReveal } from "../../../state/diagramReveal/diagramReveal.actions.ts";
import { diagramRevealState } from "../../../state/diagramReveal/diagramReveal.state.ts";
import { requestInspectReveal } from "../../../state/inspectReveal/inspectReveal.actions.ts";
import { setSelectedObject } from "../../../state/selection/selection.actions.ts";
import { selectionState } from "../../../state/selection/selection.state.ts";
import { getLoadedDocument, getLoadedProfile } from "../../../state/viewer/viewer.actions.ts";
import { viewerState } from "../../../state/viewer/viewer.state.ts";
import { ObjectDataView } from "../objectDataView/ObjectDataView.tsx";
import { type FilteredNode, PlantTree, type RevealRequest } from "../PlantTree.tsx";
import { ALL_SEARCH_FIELDS, ancestorIds, collectGroupIds, filterNode } from "../plantTreeFilter.ts";
import { TreeDataSplit } from "../TreeDataSplit.tsx";

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const SHOW_FIELDS = new Set<"type">(["type"]);

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
    // Mirrors Inspect's navigate(): ask Inspect to center on the EXACT
    // clicked row directly (most Diagram-side rows carry a synthetic id
    // global selection can't resolve for other panels), and separately
    // best-effort push global selection to the nearest represented real
    // object, when there is one, for Properties/canvas/trace.
    requestInspectReveal(id);
    if (diagramModel) {
      const target = nearestRepresentedId(diagramModel, id);
      if (target) {
        setSelectedObject(target);
      }
    }
  };

  /** Selects `id` in this tree, expands its ancestor chain, and scrolls it
   *  into view — the shared tail of both sync paths below. */
  const revealDiagramNode = useCallback(
    (id: string): void => {
      setSelectedDiagramId(id);
      const chain = ancestorIds(grouped ?? undefined, id);
      setExpanded((prev) => new Set([...prev, ...chain]));
      revealNonceRef.current += 1;
      setRevealRequest({ id, nonce: revealNonceRef.current });
    },
    [grouped],
  );

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

  // A selection made elsewhere (drawing, ConceptualModel Tree, Inspect, …)
  // reveals its Diagram-side representation here, unless the row already
  // shown already represents it (don't fight a user's pick among
  // duplicates). Direct match first — the selected id can itself be a
  // diagram-side object with a real id (e.g. an InstrumentationNodePosition,
  // which nothing Represents/Object-references) — then the usual
  // Represents/Object cross-link for a real conceptual object.
  useEffect(() => {
    if (!selectedId || !diagramModel) {
      return;
    }

    if (selectionFromTreeRef.current) {
      selectionFromTreeRef.current = false;
      return;
    }

    if (selectedDiagramId && nearestRepresentedId(diagramModel, selectedDiagramId) === selectedId) {
      return;
    }

    if (diagramModel.byId.has(selectedId)) {
      if (selectedDiagramId !== selectedId) {
        revealDiagramNode(selectedId);
      }
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

    revealDiagramNode(match.fromId);
  }, [selectedId, diagramModel, selectedDiagramId, revealDiagramNode]);

  // Inspect (and anything else) can ask for the EXACT node to be revealed —
  // independent of global selection, which can't carry a synthetic id
  // meaningfully for other panels. `nonce` is the sole trigger so
  // re-requesting the same id still re-fires (e.g. clicking the same
  // Inspect card twice).
  const { requestedId, nonce } = diagramRevealState.use();
  // biome-ignore lint/correctness/useExhaustiveDependencies: nonce is the sole re-trigger; requestedId/diagramModel/revealDiagramNode are read fresh each fire.
  useEffect(() => {
    if (requestedId && diagramModel?.byId.has(requestedId)) {
      revealDiagramNode(requestedId);
    }
  }, [nonce]);

  // A fresh document invalidates any pending reveal request from before it loaded.
  useEffect(() => {
    void docRevision;
    clearDiagramReveal();
  }, [docRevision]);

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
              profile={getLoadedProfile()}
              revealRequest={revealRequest}
              onSelect={handleSelect}
              onToggle={handleToggle}
              onContextMenu={handleSelect}
            />
          }
          data={
            <ObjectDataView
              plant={diagramModel}
              nodeId={selectedDiagramId}
              onSelect={handleSelect}
              profile={getLoadedProfile()}
            />
          }
        />
      </div>
    </PanelBody>
  );
}
