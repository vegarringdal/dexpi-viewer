// -----------------------------------------------------------------------------
// Types & constants
// -----------------------------------------------------------------------------

export type BoundsMm = Readonly<{
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}>;

export type PointMm = Readonly<{ xMm: number; yMm: number }>;
export type PointPx = Readonly<{ xPx: number; yPx: number }>;

/** CSS px per mm at 100% zoom (96 dpi). */
export const BASE_PX_PER_MM = 96 / 25.4;

const MIN_SCALE = BASE_PX_PER_MM / 100;
const MAX_SCALE = BASE_PX_PER_MM * 100;

// -----------------------------------------------------------------------------
// Viewport
// -----------------------------------------------------------------------------

/**
 * Maps DEXPI drawing coordinates (mm) to screen CSS px. DEXPI 2.0 diagram
 * coordinates are y-DOWN like SVG (the spec's arc direction is "positive =
 * clockwise" and title blocks carry large Y), so no axis flip is involved.
 * `scale` is px per mm; `offsetX/offsetY` is the screen position of the
 * drawing origin.
 */
export class Viewport {
  scale: number = BASE_PX_PER_MM;
  offsetX: number = 0;
  offsetY: number = 0;

  get zoomPercent(): number {
    return (this.scale / BASE_PX_PER_MM) * 100;
  }

  toScreen(point: PointMm): PointPx {
    return {
      xPx: this.offsetX + point.xMm * this.scale,
      yPx: this.offsetY + point.yMm * this.scale,
    };
  }

  toDrawing(point: PointPx): PointMm {
    return {
      xMm: (point.xPx - this.offsetX) / this.scale,
      yMm: (point.yPx - this.offsetY) / this.scale,
    };
  }

  panBy(dxPx: number, dyPx: number): void {
    this.offsetX += dxPx;
    this.offsetY += dyPx;
  }

  /** Zooms by `factor`, keeping the drawing point under (xPx, yPx) fixed. */
  zoomAt(point: PointPx, factor: number): void {
    const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, this.scale * factor));
    const applied = next / this.scale;
    this.scale = next;
    this.offsetX = point.xPx + (this.offsetX - point.xPx) * applied;
    this.offsetY = point.yPx + (this.offsetY - point.yPx) * applied;
  }

  /** Centers `bounds` in a viewport of the given CSS-px size. */
  fitTo(bounds: BoundsMm, widthPx: number, heightPx: number, marginPx: number): void {
    const widthMm = Math.max(bounds.maxX - bounds.minX, 1e-6);
    const heightMm = Math.max(bounds.maxY - bounds.minY, 1e-6);
    const usableW = Math.max(widthPx - marginPx * 2, 10);
    const usableH = Math.max(heightPx - marginPx * 2, 10);
    this.scale = Math.min(usableW / widthMm, usableH / heightMm);
    this.offsetX = (widthPx - widthMm * this.scale) / 2 - bounds.minX * this.scale;
    this.offsetY = (heightPx - heightMm * this.scale) / 2 - bounds.minY * this.scale;
  }
}
