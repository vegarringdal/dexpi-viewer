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
  const doc = getLoadedDocument();
  if (!selectedId || !doc) {
    return;
  }

  const current = traceState.get();
  if (current.mode === mode && current.originId === selectedId) {
    clearTrace();
    return;
  }

  const upstreamIds =
    mode !== "downstream" ? [...traceConnectivity(doc.connectivity, selectedId, "upstream")] : [];
  const downstreamIds =
    mode !== "upstream" ? [...traceConnectivity(doc.connectivity, selectedId, "downstream")] : [];
  traceState.set({ mode, originId: selectedId, upstreamIds, downstreamIds });
}
