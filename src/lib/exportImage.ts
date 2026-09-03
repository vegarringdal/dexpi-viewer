/**
 * A raster image placed on an exported sheet, in drawing mm. The neutral
 * hand-off between whoever prepares the pixels (the underlay baker, which
 * needs the DOM) and the file writers in lib/dexpi and components, which must
 * stay free of canvas and view state.
 */
export type ExportImage = Readonly<{
  /** PNG bytes, ready to embed. */
  png: Uint8Array;
  /** Where it lands, in drawing mm. */
  rect: Readonly<{ left: number; top: number; right: number; bottom: number }>;
  /** 0–1, applied by the writer (both formats support it natively). */
  opacity: number;
  /** Under the drawing, or over it. */
  placement: "under" | "over";
}>;
