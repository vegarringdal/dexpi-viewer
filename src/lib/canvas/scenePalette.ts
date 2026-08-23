import type { Theme } from "../../state/theme/theme.state.ts";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** RGBA components in 0–1, ready for CanvasKit.Color4f. */
export type PaletteColor = readonly [number, number, number, number];

export type ScenePalette = Readonly<{
  isDark: boolean;
  background: PaletteColor;
  paper: PaletteColor;
  paperBorder: PaletteColor;
  grid: PaletteColor;
  ink: PaletteColor;
  accent: PaletteColor;
  /** Marker-pen yellow: the selection halo stroke and text backdrop. */
  selectionFill: PaletteColor;
  /** Upstream trace overlay (amber). */
  traceUp: PaletteColor;
  /** Downstream trace overlay (green). */
  traceDown: PaletteColor;
  /** Categorical ramp for classification highlights (cycled by group index). */
  classify: readonly PaletteColor[];
}>;

// -----------------------------------------------------------------------------
// Palettes
// -----------------------------------------------------------------------------

const DARK_PALETTE: ScenePalette = {
  isDark: true,
  background: [0.086, 0.106, 0.133, 1],
  paper: [0.122, 0.161, 0.216, 1],
  paperBorder: [0.28, 0.33, 0.41, 1],
  grid: [1, 1, 1, 0.045],
  ink: [0.886, 0.91, 0.941, 1],
  accent: [0.376, 0.647, 0.98, 1],
  selectionFill: [1, 0.85, 0.3, 0.55],
  traceUp: [0.98, 0.75, 0.14, 1],
  traceDown: [0.29, 0.87, 0.5, 1],
  // No blue in the ramp — selection is blue and must stay unmistakable.
  classify: [
    [1, 0.42, 0.45, 1], // crimson
    [1, 0.62, 0.26, 1], // orange
    [0.2, 0.8, 0.75, 1], // teal
    [0.93, 0.45, 0.85, 1], // magenta
    [0.72, 0.82, 0.28, 1], // lime
    [0.72, 0.55, 1, 1], // purple
  ],
};

const LIGHT_PALETTE: ScenePalette = {
  isDark: false,
  background: [0.925, 0.937, 0.953, 1],
  paper: [1, 1, 1, 1],
  paperBorder: [0.58, 0.64, 0.72, 1],
  grid: [0, 0, 0, 0.05],
  ink: [0.118, 0.161, 0.231, 1],
  accent: [0.145, 0.388, 0.922, 1],
  selectionFill: [1, 0.84, 0.2, 0.7],
  traceUp: [0.85, 0.55, 0.0, 1],
  traceDown: [0.09, 0.64, 0.29, 1],
  // No blue in the ramp — selection is blue and must stay unmistakable.
  classify: [
    [0.8, 0.16, 0.25, 1], // crimson
    [0.85, 0.42, 0.06, 1], // orange
    [0.05, 0.58, 0.53, 1], // teal
    [0.78, 0.18, 0.63, 1], // magenta
    [0.45, 0.55, 0.05, 1], // olive
    [0.48, 0.3, 0.85, 1], // purple
  ],
};

export function getScenePalette(theme: Theme): ScenePalette {
  return theme === "dark" ? DARK_PALETTE : LIGHT_PALETTE;
}

/** The categorical color for a classification group index (ramp cycles). */
export function classifyColor(palette: ScenePalette, index: number): PaletteColor {
  const color = palette.classify[index % palette.classify.length];
  return color ?? palette.accent;
}
