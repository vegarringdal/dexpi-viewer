import { type PointerEvent as ReactPointerEvent, useCallback, useRef, useState } from "react";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type DragResizeOptions = Readonly<{
  axis: "x" | "y";
  min: number;
  max: number;
  /** Set when dragging toward the origin should GROW the size instead of
   *  shrinking it — e.g. a handle at a panel's top edge, or at a column's
   *  left edge when the column's width is measured from the right. */
  invert?: boolean;
}>;

type DragResize = Readonly<{
  size: number;
  onPointerDown: (e: ReactPointerEvent) => void;
}>;

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

/**
 * A draggable size (width or height) with no persistence — resets to
 * `initial` on remount. Pointer-driven: `onPointerDown` on the handle
 * starts tracking window-level pointermove/up so the drag keeps working
 * even if the pointer leaves the handle.
 */
export function useDragResize(initial: number, options: DragResizeOptions): DragResize {
  const [size, setSize] = useState(initial);
  const dragRef = useRef<{ start: number; startSize: number } | null>(null);
  const { axis, min, max, invert } = options;

  const onPointerDown = useCallback(
    (e: ReactPointerEvent): void => {
      e.preventDefault();
      dragRef.current = { start: axis === "x" ? e.clientX : e.clientY, startSize: size };

      const handleMove = (ev: PointerEvent): void => {
        const drag = dragRef.current;
        if (!drag) {
          return;
        }

        const pos = axis === "x" ? ev.clientX : ev.clientY;
        const delta = pos - drag.start;
        const next = drag.startSize + (invert ? -delta : delta);
        setSize(Math.min(max, Math.max(min, next)));
      };

      const handleUp = (): void => {
        dragRef.current = null;
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
    },
    [axis, min, max, invert, size],
  );

  return { size, onPointerDown };
}
