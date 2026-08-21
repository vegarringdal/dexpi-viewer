import { IconHelp, IconMinus, IconPlus, IconZoomIn, IconZoomOut } from "@tabler/icons-react";
import { Button } from "@tredespace/ui/widgets";
import type { JSX } from "react";
import type { GraphEdgeKind, HardwareKind } from "../../../lib/graph/semanticGraph.ts";
import { FieldToggleRow } from "../FieldToggleRow.tsx";
import {
  MAX_GAP_SCALE,
  MAX_GRAPH_DEPTH,
  MIN_GAP_SCALE,
  MIN_GRAPH_DEPTH,
  setGraphDepth,
  setGraphEdgeKinds,
  setGraphGapScale,
  setGraphHardwareKinds,
  setGraphHighlightLinked,
  setGraphMode,
} from "./topologyGraph.actions.ts";
import { GRAPH_EDGE_KINDS, GRAPH_HARDWARE_KINDS, topologyGraphState } from "./topologyGraph.state.ts";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type GraphToolbarProps = Readonly<{
  onFit: () => void;
  onZoom: (factor: number) => void;
  isHelpOpen: boolean;
  onToggleHelp: () => void;
}>;

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const EDGE_KIND_LABELS: Readonly<Record<GraphEdgeKind, string>> = {
  flow: "Flow",
  containment: "Containment",
  reference: "References",
};

const HARDWARE_KIND_LABELS: Readonly<Record<HardwareKind, string>> = {
  nozzle: "Nozzles",
  chamber: "Chambers",
  pipingNode: "Piping nodes",
  port: "Ports",
};

const ZOOM_STEP_FACTOR = 1.4;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/** Mode switch, ego depth stepper, edge/hardware toggles, zoom and fit. */
export function GraphToolbar({ onFit, onZoom, isHelpOpen, onToggleHelp }: GraphToolbarProps): JSX.Element {
  const { mode, depth, kinds, hardware, gapScale, highlightLinked } = topologyGraphState.use();

  return (
    <div className="flex shrink-0 flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1">
        <Button
          active={mode === "neighborhood"}
          tooltip="Graph around the current selection"
          onClick={() => setGraphMode("neighborhood")}
        >
          Neighborhood
        </Button>
        <Button
          active={mode === "document"}
          tooltip="Graph of the whole document"
          onClick={() => setGraphMode("document")}
        >
          Document
        </Button>
        {mode === "neighborhood" && (
          <>
            <Button
              iconOnly
              icon={<IconMinus />}
              tooltip="Fewer hops"
              disabled={depth <= MIN_GRAPH_DEPTH}
              onClick={() => setGraphDepth(depth - 1)}
            />
            <span className="text-slate-400 text-xs tabular-nums">Depth {depth}</span>
            <Button
              iconOnly
              icon={<IconPlus />}
              tooltip="More hops"
              disabled={depth >= MAX_GRAPH_DEPTH}
              onClick={() => setGraphDepth(depth + 1)}
            />
          </>
        )}
        <Button
          iconOnly
          icon={<IconMinus />}
          tooltip="Tighter vertical spacing"
          disabled={gapScale <= MIN_GAP_SCALE}
          onClick={() => setGraphGapScale(gapScale - 1)}
        />
        <span className="text-slate-400 text-xs tabular-nums">Gap {gapScale}×</span>
        <Button
          iconOnly
          icon={<IconPlus />}
          tooltip="More vertical spacing"
          disabled={gapScale >= MAX_GAP_SCALE}
          onClick={() => setGraphGapScale(gapScale + 1)}
        />
        <Button
          active={highlightLinked}
          tooltip="Tint the selection's direct neighbours: amber = upstream, green = downstream, violet = signal"
          onClick={() => setGraphHighlightLinked(!highlightLinked)}
        >
          Linked
        </Button>
        <Button
          iconOnly
          icon={<IconZoomIn />}
          tooltip="Zoom in (or mouse wheel over the graph)"
          onClick={() => onZoom(ZOOM_STEP_FACTOR)}
        />
        <Button
          iconOnly
          icon={<IconZoomOut />}
          tooltip="Zoom out (or mouse wheel over the graph)"
          onClick={() => onZoom(1 / ZOOM_STEP_FACTOR)}
        />
        <Button tooltip="Fit the graph in view" onClick={onFit}>
          Fit
        </Button>
        <Button
          iconOnly
          icon={<IconHelp />}
          active={isHelpOpen}
          tooltip="What the lines, borders and tints mean"
          onClick={onToggleHelp}
        />
      </div>
      <FieldToggleRow
        label="Edges:"
        fields={GRAPH_EDGE_KINDS}
        labels={EDGE_KIND_LABELS}
        active={new Set(kinds)}
        requireOne
        onChange={setGraphEdgeKinds}
      />
      <FieldToggleRow
        label="Show:"
        fields={GRAPH_HARDWARE_KINDS}
        labels={HARDWARE_KIND_LABELS}
        active={new Set(hardware)}
        onChange={setGraphHardwareKinds}
      />
    </div>
  );
}
