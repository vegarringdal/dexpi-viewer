import { traceConnectivity } from "../../lib/dexpi/connectivity.ts";
import { selectionState } from "../selection/selection.state.ts";
import { getLoadedDocument } from "../viewer/viewer.actions.ts";
import { viewerState } from "../viewer/viewer.state.ts";
import { type TraceMode, traceState } from "./trace.state.ts";

// A stale trace makes no sense against a newly loaded document.
let seenDocRevision = viewerState.get().docRevision;
viewerState.subscribe(() => {
  const revision = viewerState.get().docRevision;
  if (revision !== seenDocRevision) {
    seenDocRevision = revision;
    clearTrace();
  }
});

// An active trace follows the primary selection: selecting another object
// re-traces from it, deselecting everything clears the overlay. Guarded on
// selectedId so hover/multi-select churn in the same store doesn't retrace.
let seenSelectedId = selectionState.get().selectedId;
selectionState.subscribe(() => {
  const { selectedId } = selectionState.get();
  if (selectedId === seenSelectedId) {
    return;
  }

  seenSelectedId = selectedId;
  const { mode } = traceState.get();
  if (mode === "off") {
    return;
  }
  if (!selectedId) {
    clearTrace();
    return;
  }
  runTrace(mode, selectedId);
});

function runTrace(mode: Exclude<TraceMode, "off">, originId: string): void {
  const doc = getLoadedDocument();
  if (!doc) {
    return;
  }

  const upstreamIds =
    mode !== "downstream" ? [...traceConnectivity(doc.connectivity, originId, "upstream")] : [];
  const downstreamIds =
    mode !== "upstream" ? [...traceConnectivity(doc.connectivity, originId, "downstream")] : [];
  traceState.set({ mode, originId, upstreamIds, downstreamIds });
}

export function clearTrace(): void {
  traceState.set({ mode: "off", originId: null, upstreamIds: [], downstreamIds: [] });
}

/**
 * Traces flow from the currently selected object and stores the reachable
 * object ids for the canvas overlay. Invoking the active mode again (same
 * origin) clears the trace.
 */
export function toggleTrace(mode: Exclude<TraceMode, "off">): void {
  const { selectedId } = selectionState.get();
  if (!selectedId) {
    return;
  }

  const current = traceState.get();
  if (current.mode === mode && current.originId === selectedId) {
    clearTrace();
    return;
  }

  runTrace(mode, selectedId);
}
