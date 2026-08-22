import { PanelBody } from "@tredespace/ui/dockable";
import { Button, Select, type SelectOption } from "@tredespace/ui/widgets";
import { type JSX, useEffect, useMemo, useRef, useState } from "react";
import {
  buildObjectDiagram,
  MAX_DIAGRAM_DEPTH,
  MIN_DIAGRAM_DEPTH,
} from "../../../lib/graph/objectDiagram.ts";
import { layoutObjectDiagram, type PlacedCard } from "../../../lib/graph/objectDiagramLayout.ts";
import { setSelectedObject } from "../../../state/selection/selection.actions.ts";
import { selectionState } from "../../../state/selection/selection.state.ts";
import { getLoadedDocument, getLoadedProfile } from "../../../state/viewer/viewer.actions.ts";
import { viewerState } from "../../../state/viewer/viewer.state.ts";
import { useSvgPanZoom } from "../../hooks/useSvgPanZoom.ts";
import { InspectCardView } from "./InspectCardView.tsx";
import { InspectEdgeView } from "./InspectEdgeView.tsx";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type PendingPin = Readonly<{ id: string; screenX: number; screenY: number; scale: number }>;

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const DEPTH_OPTIONS: readonly SelectOption[] = Array.from(
  { length: MAX_DIAGRAM_DEPTH - MIN_DIAGRAM_DEPTH + 1 },
  (_, i) => ({
    value: String(MIN_DIAGRAM_DEPTH + i),
    label: `${MIN_DIAGRAM_DEPTH + i} level${MIN_DIAGRAM_DEPTH + i > 1 ? "s" : ""}`,
  }),
);

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * Debug panel: a UML-style instance diagram of the selected object — its full
 * raw Data as rows plus its relations up to the chosen depth (references,
 * referenced-by, containment, profile-instance stubs), edges labeled with
 * the actual property names. Clicking a neighbor re-centers on it, pinning
 * the clicked card's screen position so the view does not jump.
 */
export function InspectPanel(): JSX.Element {
  const { file, docRevision } = viewerState.use();
  const { selectedId } = selectionState.use();
  const [depth, setDepth] = useState(MIN_DIAGRAM_DEPTH);

  const layout = useMemo(() => {
    void docRevision;
    const doc = getLoadedDocument();
    if (!doc || !selectedId) {
      return null;
    }

    const diagram = buildObjectDiagram(doc.plant, selectedId, getLoadedProfile()?.instances, depth);
    return diagram ? layoutObjectDiagram(diagram) : null;
  }, [docRevision, selectedId, depth]);

  const panZoom = useSvgPanZoom(layout?.width ?? 0, layout?.height ?? 0);
  const { fitToContent, setViewTransform, transform } = panZoom;
  const { x, y, scale } = transform;
  const pendingPinRef = useRef<PendingPin | null>(null);

  // A pinned re-center (neighbor card click) restores the clicked card's
  // screen position for the new center; anything else re-fits.
  // biome-ignore lint/correctness/useExhaustiveDependencies: anchor once per layout, with that render's transform.
  useEffect(() => {
    const pin = pendingPinRef.current;
    pendingPinRef.current = null;
    if (pin && layout && layout.center.card.id === pin.id) {
      setViewTransform({
        scale: pin.scale,
        x: pin.screenX - layout.center.x * pin.scale,
        y: pin.screenY - layout.center.y * pin.scale,
      });
      return;
    }

    fitToContent();
  }, [layout]);

  if (!file) {
    return (
      <PanelBody className="flex h-full items-center justify-center p-4 text-center text-slate-500 text-xs">
        Open a DEXPI file to get started.
      </PanelBody>
    );
  }

  if (!layout) {
    return (
      <PanelBody className="flex h-full items-center justify-center p-4 text-center text-slate-500 text-xs">
        Select an object (drawing, Explorer, or a neighbor card) to inspect it.
      </PanelBody>
    );
  }

  const handleNavigate = (placed: PlacedCard): void => {
    pendingPinRef.current = {
      id: placed.card.id,
      scale,
      screenX: x + placed.x * scale,
      screenY: y + placed.y * scale,
    };
    setSelectedObject(placed.card.id);
  };

  return (
    <PanelBody className="flex h-full flex-col gap-2 p-2">
      <div className="flex shrink-0 items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-400">
          {layout.center.card.title} — {layout.center.card.subtitle}
        </span>
        <div className="w-24 shrink-0">
          <Select
            value={String(depth)}
            options={[...DEPTH_OPTIONS]}
            onChange={(value) => setDepth(Number.parseInt(value ?? "1", 10) || MIN_DIAGRAM_DEPTH)}
          />
        </div>
        <Button onClick={fitToContent}>Fit</Button>
      </div>
      <div
        ref={panZoom.containerRef}
        className="relative min-h-0 flex-1 cursor-grab touch-none select-none overflow-hidden rounded border border-slate-800 bg-slate-950/40"
        onPointerDown={panZoom.handlePointerDown}
        onPointerMove={panZoom.handlePointerMove}
        onPointerUp={panZoom.handlePointerUp}
      >
        <svg role="img" aria-label="Object diagram" className="h-full w-full">
          <defs>
            <marker
              id="inspect-arrow"
              viewBox="0 0 8 8"
              refX="7"
              refY="4"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 8 4 L 0 8 z" className="fill-slate-500" />
            </marker>
          </defs>
          <g transform={`translate(${x} ${y}) scale(${scale})`}>
            {layout.edges.map((edge, i) => (
              <InspectEdgeView key={`${edge.label}-${String(i)}`} edge={edge} />
            ))}
            {layout.neighbors.map((placed) => (
              <InspectCardView
                key={placed.key}
                placed={placed}
                isCenter={false}
                onNavigate={() => handleNavigate(placed)}
              />
            ))}
            <InspectCardView placed={layout.center} isCenter onNavigate={() => undefined} />
          </g>
        </svg>
      </div>
    </PanelBody>
  );
}
