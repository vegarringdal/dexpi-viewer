import { useEffect, useMemo, useState } from "react";
import { objectElementToJson } from "../../../lib/dexpi/objectJson.ts";
import { fullPlantModel } from "../../../lib/dexpi/plantModel.ts";
import type { ValidationIssue } from "../../../lib/dexpi/validation.ts";
import { buildObjectDiagram, MIN_DIAGRAM_DEPTH } from "../../../lib/graph/objectDiagram.ts";
import { type InspectLayout, layoutObjectDiagram } from "../../../lib/graph/objectDiagramLayout.ts";
import { setSelectedObject } from "../../../state/selection/selection.actions.ts";
import { selectionState } from "../../../state/selection/selection.state.ts";
import { getEffectiveIssues } from "../../../state/validation/validation.actions.ts";
import { validationConfigState } from "../../../state/validation/validation.state.ts";
import { getLoadedDocument, getLoadedProfile } from "../../../state/viewer/viewer.actions.ts";
import { viewerState } from "../../../state/viewer/viewer.state.ts";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type CardExport = Readonly<{ json: string; xpath: string }>;

type InspectDiagram = Readonly<{
  hasFile: boolean;
  layout: InspectLayout | null;
  depth: number;
  setDepth: (depth: number) => void;
  showDrawing: boolean;
  setShowDrawing: (on: boolean) => void;
  /** Re-centers on a card: real objects go through global selection;
   *  synthetic drawing objects re-center this panel only. */
  navigate: (id: string) => void;
  /** Raw-data export for the copy menu; null for profile stubs. */
  exportCard: (id: string) => CardExport | null;
}>;

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

/**
 * Builds the Inspect panel's diagram state. In drawing mode the diagram
 * runs over the diagram-inclusive model, whose Core/Diagram objects carry
 * synthetic XPath ids — those exist only here, so navigating onto one must
 * not touch the global selection (nothing else could resolve it).
 */
export function useInspectDiagram(): InspectDiagram {
  const { file, docRevision } = viewerState.use();
  const { selectedId } = selectionState.use();
  const { overrides } = validationConfigState.use();
  const [depth, setDepth] = useState(MIN_DIAGRAM_DEPTH);
  const [showDrawing, setShowDrawing] = useState(false);
  const [localCenter, setLocalCenter] = useState<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: selectedId/showDrawing are reset triggers — a new global selection or leaving drawing mode drops the local re-center.
  useEffect(() => {
    setLocalCenter(null);
  }, [selectedId, showDrawing]);

  const layout = useMemo(() => {
    void docRevision;
    const doc = getLoadedDocument();
    const centerId = localCenter ?? selectedId;
    if (!doc || !centerId) {
      return null;
    }

    const issuesById = new Map<string, ValidationIssue[]>();
    void overrides;
    for (const issue of getEffectiveIssues()) {
      if (issue.objectId) {
        issuesById.set(issue.objectId, [...(issuesById.get(issue.objectId) ?? []), issue]);
      }
    }
    const model = showDrawing ? fullPlantModel(doc.root) : doc.plant;
    const diagram = buildObjectDiagram(model, centerId, getLoadedProfile()?.instances, depth, issuesById);
    return diagram ? layoutObjectDiagram(diagram) : null;
  }, [docRevision, selectedId, localCenter, depth, showDrawing, overrides]);

  const navigate = (id: string): void => {
    const doc = getLoadedDocument();
    if (doc?.plant.byId.has(id)) {
      setLocalCenter(null);
      setSelectedObject(id);
      return;
    }

    setLocalCenter(id);
  };

  const exportCard = (id: string): CardExport | null => {
    const doc = getLoadedDocument();
    if (!doc) {
      return null;
    }

    const model = showDrawing ? fullPlantModel(doc.root) : doc.plant;
    const node = model.byId.get(id);
    const el = model.elementsById.get(id);
    if (!node || !el) {
      return null;
    }

    return { json: JSON.stringify(objectElementToJson(el), null, 2), xpath: node.xpath };
  };

  return {
    hasFile: file !== null,
    layout,
    depth,
    setDepth,
    showDrawing,
    setShowDrawing,
    navigate,
    exportCard,
  };
}
