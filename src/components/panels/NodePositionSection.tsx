import { Button, Checkbox } from "@tredespace/ui/widgets";
import { type JSX, useMemo } from "react";
import { collectNodePositionKinds, type NodePositionKindRow } from "../../lib/dexpi/nodePositionKinds.ts";
import { setHighlightDimDrawing } from "../../state/highlight/highlight.actions.ts";
import { highlightState } from "../../state/highlight/highlight.state.ts";
import {
  getNodePositionSettings,
  resetAllNodePositionScales,
  setAllNodePositionKinds,
} from "../../state/nodePositions/nodePositions.actions.ts";
import { nodePositionsState } from "../../state/nodePositions/nodePositions.state.ts";
import { getLoadedDocument } from "../../state/viewer/viewer.actions.ts";
import { viewerState } from "../../state/viewer/viewer.state.ts";
import { NodePositionRow } from "./NodePositionRow.tsx";

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * Connection-point markers: a circle per node position the DEXPI file
 * declares, an X per attachment point the profile symbol declares. Rows come
 * from the loaded drawing, so a profile that introduces a new
 * Profile/NodePositionType shows up without a code change.
 */
export function NodePositionSection(): JSX.Element {
  const { docRevision } = viewerState.use();
  // The values themselves come through getNodePositionSettings so the
  // defaults live in one place; this subscribes the section to their changes.
  const { kinds } = nodePositionsState.use();
  const { dimDrawing } = highlightState.use();

  const rows = useMemo<readonly NodePositionKindRow[]>(() => {
    void docRevision;
    const doc = getLoadedDocument();
    return doc ? collectNodePositionKinds(doc.scene.nodePositionMarkers) : [];
  }, [docRevision]);

  if (rows.length === 0) {
    return <div className="text-slate-500 text-xs">This drawing declares no node positions.</div>;
  }

  const anyEnabled = rows.some((row) => getNodePositionSettings(row.source, row.kind).enabled);
  // Reset covers stored kinds this drawing does not contain, so it reads the
  // whole store rather than the visible rows.
  const anyScaled = Object.values(kinds).some((settings) => settings.scale !== 1);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Checkbox
          checked={dimDrawing}
          onChange={setHighlightDimDrawing}
          label="Dim drawing"
          tooltip="Fade the drawing so the overlays stand out. Shared with the other Highlight sections — it sits below every overlay, so it never dims one of them"
          className="min-w-0 flex-1"
        />
        <Button
          onClick={resetAllNodePositionScales}
          disabled={!anyScaled}
          tooltip="Put every marker size back to 1×"
        >
          Reset scale
        </Button>
        <Button
          onClick={() => setAllNodePositionKinds(rows, !anyEnabled)}
          tooltip="Turn every kind below on or off at once"
        >
          {anyEnabled ? "None" : "All"}
        </Button>
      </div>
      {rows.map((row) => (
        <NodePositionRow
          key={`${row.source}:${row.kind}`}
          row={row}
          settings={getNodePositionSettings(row.source, row.kind)}
        />
      ))}
    </div>
  );
}
