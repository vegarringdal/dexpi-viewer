import {
  type PointerEvent as ReactPointerEvent,
  type RefCallback,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type ViewTransform = Readonly<{ x: number; y: number; scale: number }>;

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const MIN_SCALE = 0.1;
const MAX_SCALE = 8;
const FIT_MARGIN_PX = 24;
const WHEEL_ZOOM_RATE = 0.0015;

const IDENTITY: ViewTransform = { x: 0, y: 0, scale: 1 };

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

/**
 * Pan (pointer drag with capture) and zoom-to-cursor (wheel) for an SVG whose
 * content is `contentWidth`×`contentHeight` units. The wheel listener is
 * attached natively with `passive: false` — React's delegated onWheel cannot
 * reliably preventDefault the page scroll. The container is tracked through a
 * callback ref because the element mounts and unmounts with the panel's view
 * state — a plain ref captured once would leave later mounts without a wheel
 * listener. Content changes re-fit the view.
 */
export function useSvgPanZoom(
  contentWidth: number,
  contentHeight: number,
): Readonly<{
  containerRef: RefCallback<HTMLDivElement>;
  transform: ViewTransform;
  handlePointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  handlePointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  handlePointerUp: (e: ReactPointerEvent<HTMLDivElement>) => void;
  fitToContent: () => void;
  zoomBy: (factor: number) => void;
  /** Sets the view outright — for callers that must control the exact frame. */
  setViewTransform: (next: ViewTransform) => void;
  /** Current viewport size in px; null while the container is unmounted. */
  getViewportSize: () => Readonly<{ width: number; height: number }> | null;
}> {
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const [transform, setTransform] = useState<ViewTransform>(IDENTITY);
  const dragRef = useRef<Readonly<{ lastX: number; lastY: number }> | null>(null);

  const containerRef: RefCallback<HTMLDivElement> = useCallback((el) => {
    setContainerEl(el);
  }, []);

  const fitToContent = useCallback((): void => {
    const el = containerEl;
    if (!el || contentWidth <= 0 || contentHeight <= 0) {
      setTransform(IDENTITY);
      return;
    }

    const rect = el.getBoundingClientRect();
    const scale = Math.max(
      MIN_SCALE,
      Math.min(
        (rect.width - 2 * FIT_MARGIN_PX) / contentWidth,
        (rect.height - 2 * FIT_MARGIN_PX) / contentHeight,
        1,
      ),
    );
    setTransform({
      x: (rect.width - contentWidth * scale) / 2,
      y: (rect.height - contentHeight * scale) / 2,
      scale,
    });
  }, [containerEl, contentWidth, contentHeight]);

  const setViewTransform = useCallback((next: ViewTransform): void => {
    setTransform(next);
  }, []);

  const getViewportSize = useCallback((): Readonly<{ width: number; height: number }> | null => {
    if (!containerEl) {
      return null;
    }

    const rect = containerEl.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }, [containerEl]);

  /** Zooms around the viewport center (toolbar buttons; wheel zooms to cursor). */
  const zoomBy = useCallback(
    (factor: number): void => {
      const el = containerEl;
      if (!el) {
        return;
      }

      const rect = el.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      setTransform((prev) => {
        const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale * factor));
        const applied = scale / prev.scale;
        return { scale, x: cx - (cx - prev.x) * applied, y: cy - (cy - prev.y) * applied };
      });
    },
    [containerEl],
  );

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0) {
      return;
    }

    dragRef.current = { lastX: e.clientX, lastY: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }

    const dx = e.clientX - drag.lastX;
    const dy = e.clientY - drag.lastY;
    dragRef.current = { lastX: e.clientX, lastY: e.clientY };
    setTransform((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
  };

  const handlePointerUp = (): void => {
    dragRef.current = null;
  };

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  useEffect(() => {
    fitToContent();
  }, [fitToContent]);

  useEffect(() => {
    const el = containerEl;
    if (!el) {
      return;
    }

    const handleWheel = (e: WheelEvent): void => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      setTransform((prev) => {
        const scale = Math.min(
          MAX_SCALE,
          Math.max(MIN_SCALE, prev.scale * Math.exp(-e.deltaY * WHEEL_ZOOM_RATE)),
        );
        const factor = scale / prev.scale;
        return { scale, x: px - (px - prev.x) * factor, y: py - (py - prev.y) * factor };
      });
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [containerEl]);

  return {
    containerRef,
    transform,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    fitToContent,
    zoomBy,
    setViewTransform,
    getViewportSize,
  };
}
