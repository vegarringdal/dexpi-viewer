import { createStore } from "../../lib/createStore.ts";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** Whether the overlay draws over the drawing or behind it (over the paper). */
export type LabelInspectPlacement = "front" | "back";

export type LabelInspectState = Readonly<{
  enabled: boolean;
  colorHex: string;
  /** 0–100. */
  opacityPercent: number;
  placement: LabelInspectPlacement;
}>;

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const DEFAULT_LABEL_INSPECT_COLOR = "#e0189c";

export const labelInspectState = createStore<LabelInspectState>({
  enabled: false,
  colorHex: DEFAULT_LABEL_INSPECT_COLOR,
  opacityPercent: 100,
  placement: "front",
});
