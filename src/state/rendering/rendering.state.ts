import { createStore } from "../../lib/createStore.ts";
import type { UnitDisplayMode } from "../../lib/dexpi/values.ts";

export type RenderingState = Readonly<{
  /** Lines never render thinner than this many device px, regardless of zoom. */
  minStrokePx: number;
  /** Multiplier on every stroke width from the drawing (1 = as authored). */
  strokeWidthScale: number;
  showGrid: boolean;
  /** Units as symbols ("kW") or the spec's enumeration names ("Kilowatt"). */
  unitDisplay: UnitDisplayMode;
  /** Selected text gets a yellow backdrop rect (the halo can't embolden glyphs legibly). */
  selectionTextRect: boolean;
}>;

export const DEFAULT_RENDERING_STATE: RenderingState = {
  minStrokePx: 1,
  strokeWidthScale: 1,
  showGrid: true,
  unitDisplay: "symbol",
  selectionTextRect: true,
};

export const renderingState = createStore<RenderingState>(DEFAULT_RENDERING_STATE);
