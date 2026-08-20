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
  /** Upstream trace overlay (amber). */
  traceUp: PaletteColor;
  /** Downstream trace overlay (green). */
  traceDown: PaletteColor;
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
  traceUp: [0.98, 0.75, 0.14, 1],
  traceDown: [0.29, 0.87, 0.5, 1],
};

const LIGHT_PALETTE: ScenePalette = {
  isDark: false,
  background: [0.925, 0.937, 0.953, 1],
  paper: [1, 1, 1, 1],
  paperBorder: [0.58, 0.64, 0.72, 1],
  grid: [0, 0, 0, 0.05],
  ink: [0.118, 0.161, 0.231, 1],
  accent: [0.145, 0.388, 0.922, 1],
  traceUp: [0.85, 0.55, 0.0, 1],
  traceDown: [0.09, 0.64, 0.29, 1],
};

export function getScenePalette(theme: Theme): ScenePalette {
  return theme === "dark" ? DARK_PALETTE : LIGHT_PALETTE;
}
