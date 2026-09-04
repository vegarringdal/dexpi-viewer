import { hexToRgb, type NodeMarkerStyle } from "../../lib/dexpi/inspectOverlays.ts";
import type { NodePositionMarker, NodePositionSource } from "../../lib/dexpi/types.ts";
import { type NodePositionKindSettings, nodePositionsState } from "./nodePositions.state.ts";

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Roughly a hairline at the zoom where a symbol fills a fair part of the view. */
const DEFAULT_WIDTH_MM = 0.15;

/** File markers read blue, profile markers orange, so the two never blur together. */
const DEFAULTS: Readonly<Record<NodePositionSource, NodePositionKindSettings>> = {
  file: { enabled: false, colorHex: "#1f8fe0", scale: 1, widthMm: DEFAULT_WIDTH_MM },
  profile: { enabled: false, colorHex: "#e07a1f", scale: 1, widthMm: DEFAULT_WIDTH_MM },
};

const STORAGE_KEY = "dexpi.nodePositions";

/** Shared by the panel's steppers and the stored-value validator. */
export const NODE_MARKER_SCALE_MIN = 0.2;
export const NODE_MARKER_SCALE_MAX = 10;
export const NODE_MARKER_SCALE_STEP = 0.1;
export const NODE_MARKER_WIDTH_MIN = 0.05;
export const NODE_MARKER_WIDTH_MAX = 2;
export const NODE_MARKER_WIDTH_STEP = 0.05;

// -----------------------------------------------------------------------------
// Persistence
// -----------------------------------------------------------------------------

type StoredAppearance = Readonly<{ colorHex: string; scale: number; widthMm: number }>;

/**
 * Appearance persists, `enabled` does not: a tuned scale is worth keeping
 * (director), but an overlay that switched itself back on at startup would
 * look like the drawing had changed.
 */
function persist(): void {
  const appearance: Record<string, StoredAppearance> = {};
  for (const [key, settings] of Object.entries(nodePositionsState.get().kinds)) {
    appearance[key] = { colorHex: settings.colorHex, scale: settings.scale, widthMm: settings.widthMm };
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appearance));
}

function sourceOfKey(key: string): NodePositionSource {
  return key.startsWith("profile:") ? "profile" : "file";
}

/** Call once at startup; ignores missing/corrupt stored settings. */
export function applyStoredNodePositionSettings(): void {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return;
    }

    const kinds: Record<string, NodePositionKindSettings> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value !== "object" || value === null) {
        continue;
      }

      const candidate: Partial<Record<keyof StoredAppearance, unknown>> = value;
      const fallback = DEFAULTS[sourceOfKey(key)];
      kinds[key] = {
        enabled: false,
        colorHex: typeof candidate.colorHex === "string" ? candidate.colorHex : fallback.colorHex,
        scale: inRange(candidate.scale, NODE_MARKER_SCALE_MIN, NODE_MARKER_SCALE_MAX)
          ? candidate.scale
          : fallback.scale,
        widthMm: inRange(candidate.widthMm, NODE_MARKER_WIDTH_MIN, NODE_MARKER_WIDTH_MAX)
          ? candidate.widthMm
          : fallback.widthMm,
      };
    }
    nodePositionsState.set({ kinds });
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function inRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

export function nodePositionKindKey(source: NodePositionSource, kind: string): string {
  return `${source}:${kind}`;
}

export function getNodePositionSettings(source: NodePositionSource, kind: string): NodePositionKindSettings {
  return nodePositionsState.get().kinds[nodePositionKindKey(source, kind)] ?? DEFAULTS[source];
}

/**
 * One marker's drawing style, or null when its kind is switched off. Canvas
 * and the "as viewed" exporters both feed this to `buildNodeMarkerPrims`, so
 * the two cannot draw different markers.
 */
export function nodeMarkerStyleFor(marker: NodePositionMarker): NodeMarkerStyle | null {
  const settings = getNodePositionSettings(marker.source, marker.kind);
  if (!settings.enabled) {
    return null;
  }

  return { color: hexToRgb(settings.colorHex), scale: settings.scale, widthMm: settings.widthMm };
}

// -----------------------------------------------------------------------------
// Actions
// -----------------------------------------------------------------------------

export function updateNodePositionKind(
  source: NodePositionSource,
  kind: string,
  patch: Partial<NodePositionKindSettings>,
): void {
  const key = nodePositionKindKey(source, kind);
  const current = nodePositionsState.get().kinds[key] ?? DEFAULTS[source];
  nodePositionsState.set((prev) => ({ kinds: { ...prev.kinds, [key]: { ...current, ...patch } } }));
  persist();
}

/** Turns every listed kind on or off in one step (the panel's header toggle). */
export function setAllNodePositionKinds(
  kinds: readonly Readonly<{ source: NodePositionSource; kind: string }>[],
  enabled: boolean,
): void {
  nodePositionsState.set((prev) => {
    const next = { ...prev.kinds };
    for (const { source, kind } of kinds) {
      const key = nodePositionKindKey(source, kind);
      next[key] = { ...(next[key] ?? DEFAULTS[source]), enabled };
    }
    return { kinds: next };
  });
  persist();
}

/** Back to 1× everywhere — including kinds this document does not contain. */
export function resetAllNodePositionScales(): void {
  nodePositionsState.set((prev) => {
    const next: Record<string, NodePositionKindSettings> = {};
    for (const [key, settings] of Object.entries(prev.kinds)) {
      next[key] = { ...settings, scale: 1 };
    }
    return { kinds: next };
  });
  persist();
}
