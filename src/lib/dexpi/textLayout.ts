import type { TextAlignV } from "./types.ts";

// -----------------------------------------------------------------------------
// Multiline text layout, shared by the canvas, SVG and PDF text paths
//
// Ordinary Core/Diagram.Text values can contain line breaks. Every renderer
// splits them here so the block anchors identically everywhere: each line is
// measured and horizontally aligned on its own, while the vertical alignment
// applies to the complete block (y-down drawing space). Rotation is applied
// by the renderers around the shared anchor, so the block rotates as one
// unit and single-line values keep their exact previous placement.
// -----------------------------------------------------------------------------

/** Line advance as a multiple of the font size (y-down). */
export const TEXT_LINE_SPACING = 1.4;

export type TextLayoutLine = Readonly<{
  value: string;
  /** Baseline shift in mm below the single-line baseline (y-down). */
  offsetY: number;
}>;

/**
 * Baseline offset in mm below the anchor for a single line of `size` mm —
 * the empirical factors every renderer used for its vertical alignment.
 */
export function baselineOffsetMm(size: number, vAlign: TextAlignV): number {
  if (vAlign === "Center") {
    return 0.3 * size;
  }

  if (vAlign === "Top") {
    return 0.8 * size;
  }

  return 0;
}

/**
 * Splits `value` on \r?\n into lines with block-aligned baseline offsets:
 * Top keeps the first line at the single-line position and grows downward,
 * Bottom keeps the last line there and grows upward, Center spreads the
 * block symmetrically. A single-line value yields one line with offset 0,
 * so existing single-line anchoring is untouched.
 *
 * Each line is trimmed: browsers collapse leading/trailing whitespace when
 * rendering SVG text, so the official reference renderings never show it —
 * but real data carries it (a DISC sheet pads a BreakValue line with 48
 * spaces), and drawing the literal space glyphs shoves the line ~44mm
 * sideways on the canvas. Trimming keeps every renderer (canvas, SVG, PDF,
 * hit-test) on the browser-collapsed geometry.
 */
export function layoutTextLines(value: string, size: number, vAlign: TextAlignV): TextLayoutLine[] {
  const lines = value.split(/\r?\n/).map((line) => line.trim());
  const advance = size * TEXT_LINE_SPACING;
  const blockShift =
    vAlign === "Bottom" ? -(lines.length - 1) : vAlign === "Center" ? -(lines.length - 1) / 2 : 0;
  return lines.map((line, index) => ({ value: line, offsetY: (index + blockShift) * advance }));
}
