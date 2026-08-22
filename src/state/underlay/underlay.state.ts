import { createStore } from "../../lib/createStore.ts";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type UnderlayPlacement = "under" | "over";

export type UnderlayState = Readonly<{
  /** Loaded file name; null = no underlay. */
  name: string | null;
  visible: boolean;
  /** 0–100. */
  opacityPercent: number;
  placement: UnderlayPlacement;
  /** Alignment nudge in drawing mm, relative to the diagram extent. */
  offsetXMm: number;
  offsetYMm: number;
  /** 100 = stretched to the diagram extent exactly. */
  scalePercent: number;
  /** Recolor the underlay's ink toward this hex; null keeps original colors. */
  tintHex: string | null;
  /** Multiply-blend the underlay so its white background disappears. */
  hideWhite: boolean;
  /** Bumps when the decoded bitmap changes (the canvas re-uploads it). */
  bitmapRevision: number;
}>;

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const underlayState = createStore<UnderlayState>({
  name: null,
  visible: true,
  opacityPercent: 50,
  placement: "under",
  offsetXMm: 0,
  offsetYMm: 0,
  scalePercent: 100,
  tintHex: null,
  hideWhite: false,
  bitmapRevision: 0,
});
