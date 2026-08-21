import type { GraphEdgeKind, HardwareKind } from "../../../lib/graph/semanticGraph.ts";
import {
  GRAPH_EDGE_KINDS,
  GRAPH_HARDWARE_KINDS,
  type TopologyGraphMode,
  topologyGraphState,
} from "./topologyGraph.state.ts";

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const STORAGE_KEY = "dexpi.topologyGraph";

export const MIN_GRAPH_DEPTH = 1;
export const MAX_GRAPH_DEPTH = 6;

export const MIN_GAP_SCALE = 1;
export const MAX_GAP_SCALE = 6;

// -----------------------------------------------------------------------------
// Persistence
// -----------------------------------------------------------------------------

function isGraphEdgeKind(value: unknown): value is GraphEdgeKind {
  return value === "flow" || value === "containment" || value === "reference";
}

function isGraphMode(value: unknown): value is TopologyGraphMode {
  return value === "neighborhood" || value === "document";
}

function isHardwareKind(value: unknown): value is HardwareKind {
  return value === "nozzle" || value === "chamber" || value === "pipingNode" || value === "port";
}

function clampDepth(depth: number): number {
  return Math.min(MAX_GRAPH_DEPTH, Math.max(MIN_GRAPH_DEPTH, Math.round(depth)));
}

function clampGapScale(gapScale: number): number {
  return Math.min(MAX_GAP_SCALE, Math.max(MIN_GAP_SCALE, Math.round(gapScale)));
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(topologyGraphState.get()));
  } catch {
    // Storage unavailable (private mode etc.) — settings just won't persist.
  }
}

function hydrate(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return;
    }

    if ("mode" in parsed && isGraphMode(parsed.mode)) {
      topologyGraphState.set({ mode: parsed.mode });
    }
    if ("depth" in parsed && typeof parsed.depth === "number" && Number.isFinite(parsed.depth)) {
      topologyGraphState.set({ depth: clampDepth(parsed.depth) });
    }
    if ("kinds" in parsed && Array.isArray(parsed.kinds)) {
      const kinds = parsed.kinds.filter(isGraphEdgeKind);
      if (kinds.length > 0) {
        topologyGraphState.set({ kinds: GRAPH_EDGE_KINDS.filter((k) => kinds.includes(k)) });
      }
    }
    if ("hardware" in parsed && Array.isArray(parsed.hardware)) {
      const hardware = parsed.hardware.filter(isHardwareKind);
      topologyGraphState.set({ hardware: GRAPH_HARDWARE_KINDS.filter((k) => hardware.includes(k)) });
    }
    if ("gapScale" in parsed && typeof parsed.gapScale === "number" && Number.isFinite(parsed.gapScale)) {
      topologyGraphState.set({ gapScale: clampGapScale(parsed.gapScale) });
    }
    if ("highlightLinked" in parsed && typeof parsed.highlightLinked === "boolean") {
      topologyGraphState.set({ highlightLinked: parsed.highlightLinked });
    }
  } catch {
    // Corrupted storage — keep the defaults.
  }
}

hydrate();

// -----------------------------------------------------------------------------
// Actions
// -----------------------------------------------------------------------------

export function setGraphMode(mode: TopologyGraphMode): void {
  topologyGraphState.set({ mode });
  persist();
}

export function setGraphDepth(depth: number): void {
  topologyGraphState.set({ depth: clampDepth(depth) });
  persist();
}

/** Stores the enabled kinds in canonical order regardless of toggle order. */
export function setGraphEdgeKinds(kinds: ReadonlySet<GraphEdgeKind>): void {
  const next = GRAPH_EDGE_KINDS.filter((k) => kinds.has(k));
  if (next.length > 0) {
    topologyGraphState.set({ kinds: next });
    persist();
  }
}

/** Connection-hardware families to show as mini nodes; empty = all collapsed. */
export function setGraphHardwareKinds(hardware: ReadonlySet<HardwareKind>): void {
  topologyGraphState.set({ hardware: GRAPH_HARDWARE_KINDS.filter((k) => hardware.has(k)) });
  persist();
}

export function setGraphGapScale(gapScale: number): void {
  topologyGraphState.set({ gapScale: clampGapScale(gapScale) });
  persist();
}

export function setGraphHighlightLinked(highlightLinked: boolean): void {
  topologyGraphState.set({ highlightLinked });
  persist();
}
