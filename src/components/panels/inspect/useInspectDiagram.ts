import { useEffect, useMemo, useState } from "react";
import { objectElementToJson } from "../../../lib/dexpi/objectJson.ts";
import { fullPlantModel, nearestRepresentedId } from "../../../lib/dexpi/plantModel.ts";
import type { ValidationIssue } from "../../../lib/dexpi/validation.ts";
import { buildObjectDiagram, MIN_DIAGRAM_DEPTH } from "../../../lib/graph/objectDiagram.ts";
import { type InspectLayout, layoutObjectDiagram } from "../../../lib/graph/objectDiagramLayout.ts";
import { requestDiagramReveal } from "../../../state/diagramReveal/diagramReveal.actions.ts";
import { clearInspectReveal } from "../../../state/inspectReveal/inspectReveal.actions.ts";
import { inspectRevealState } from "../../../state/inspectReveal/inspectReveal.state.ts";
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

/** A panel-local re-center, tagged with the context it is valid for — see
 *  `activeLocalCenter`. */
type LocalCenter = Readonly<{
  id: string;
  forSelectedId: string | null;
  forShowDrawing: boolean;
  forDocRevision: number;
}>;

type InspectDiagram = Readonly<{
  hasFile: boolean;
  layout: InspectLayout | null;
  depth: number;
  setDepth: (depth: number) => void;
  showDrawing: boolean;
  setShowDrawing: (on: boolean) => void;
  /** Re-centers this panel's graph on the clicked card — always, so
   *  drilling into a synthetic (id-less) drawing object's own neighbors
   *  keeps working. A real id, or the nearest ancestor that actually
   *  Represents/Object-links a real object, is also pointed to by global
   *  selection as a best-effort side notification to the rest of the app. */
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
 * synthetic XPath ids — this panel always re-centers on whatever was
 * clicked (see `navigate`), real id or not, so drilling into a synthetic
 * object's own neighbors keeps working the same way real objects do.
 */
export function useInspectDiagram(): InspectDiagram {
  const { file, docRevision } = viewerState.use();
  const { selectedId } = selectionState.use();
  const { overrides } = validationConfigState.use();
  const [depth, setDepth] = useState(MIN_DIAGRAM_DEPTH);
  const [showDrawing, setShowDrawing] = useState(false);
  const [localCenter, setLocalCenter] = useState<LocalCenter | null>(null);

  // A panel-local re-center is only valid for the context it was made in:
  // it dies the moment global selection, drawing mode, or the document
  // moves on. Recording that context beats resetting it from an effect —
  // this panel's own navigation writes those very values (navigate()
  // nudges the global selection, the reveal handler forces drawing mode),
  // so a "was that me?" flag would have to be consumed by exactly one
  // later run, and silently leaks whenever the write it guards turns out
  // to be a no-op (e.g. forcing drawing mode that is already on).
  const activeLocalCenter =
    localCenter &&
    localCenter.forSelectedId === selectedId &&
    localCenter.forShowDrawing === showDrawing &&
    localCenter.forDocRevision === docRevision
      ? localCenter.id
      : null;

  // Mirrors requestDiagramReveal: the Diagram Tree panel (whose rows are
  // mostly synthetic ids global selection can't carry) asks this panel to
  // center on the EXACT row clicked, switching into drawing mode since
  // every Diagram Tree row lives only in the diagram-inclusive model.
  // Rows that exist in no model at all — `groupByProperty`'s synthetic
  // `parent::Property` group rows — are ignored: centering on one would
  // blank the panel.
  const { requestedId: inspectRequestedId, nonce: inspectRevealNonce } = inspectRevealState.use();
  // biome-ignore lint/correctness/useExhaustiveDependencies: nonce is the sole re-trigger; everything else is read fresh each fire.
  useEffect(() => {
    const doc = getLoadedDocument();
    if (!inspectRequestedId || !doc || !fullPlantModel(doc.root).byId.has(inspectRequestedId)) {
      return;
    }

    setShowDrawing(true);
    setLocalCenter({
      id: inspectRequestedId,
      forSelectedId: selectedId,
      forShowDrawing: true,
      forDocRevision: docRevision,
    });
  }, [inspectRevealNonce]);

  // Drop a re-center once its context has moved on, so it can't come back
  // to life later: without this, re-selecting the very object a synthetic
  // node was centered FOR would re-activate that stale center instead of
  // showing the object just selected.
  useEffect(() => {
    if (localCenter && !activeLocalCenter) {
      setLocalCenter(null);
    }
  }, [localCenter, activeLocalCenter]);

  // A fresh document invalidates any pending reveal request from before it loaded.
  useEffect(() => {
    void docRevision;
    clearInspectReveal();
  }, [docRevision]);

  const layout = useMemo(() => {
    void docRevision;
    const doc = getLoadedDocument();
    const centerId = activeLocalCenter ?? selectedId;
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
    const profile = getLoadedProfile();
    const diagram = buildObjectDiagram(
      model,
      centerId,
      profile?.instances,
      depth,
      issuesById,
      profile?.symbols,
    );
    return diagram ? layoutObjectDiagram(diagram) : null;
  }, [docRevision, selectedId, activeLocalCenter, depth, showDrawing, overrides]);

  const navigate = (id: string): void => {
    const doc = getLoadedDocument();
    const model = doc ? (showDrawing ? fullPlantModel(doc.root) : doc.plant) : null;
    const node = model?.byId.get(id);
    // A real id (a conceptual object, or a diagram-side object that itself
    // carries one, e.g. an InstrumentationNodePosition) selects directly —
    // centerId below then follows it through `selectedId`.
    if (node && node.id !== node.xpath) {
      setLocalCenter(null);
      setSelectedObject(id);
      return;
    }

    // A synthetic (id-less) drawing object: always re-center THIS panel on
    // exactly what was clicked, so its own neighbors (children, Represents,
    // …) are what "expanding" into it shows — never skip past it to
    // something else. Ask the Diagram Tree panel to reveal this EXACT node
    // (global selection can't carry a synthetic id meaningfully for other
    // panels, but the Diagram Tree shares this same id space). Global
    // selection separately best-effort follows the nearest ancestor that
    // actually Represents/Object-links a real object, so Properties/canvas
    // have something meaningful too — the local center records the
    // selection it is made FOR, so that nudge can't invalidate it.
    requestDiagramReveal(id);
    const represented = model ? nearestRepresentedId(model, id) : null;
    if (represented && represented !== selectedId) {
      setSelectedObject(represented);
    }
    setLocalCenter({
      id,
      forSelectedId: represented ?? selectedId,
      forShowDrawing: showDrawing,
      forDocRevision: docRevision,
    });
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
