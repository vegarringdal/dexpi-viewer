import { type JSX, useEffect, useRef } from "react";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type MenuItem = Readonly<{
  label: string;
  onClick: () => void;
}>;

type TreeContextMenuProps = Readonly<{
  x: number;
  y: number;
  items: readonly MenuItem[];
  onClose: () => void;
}>;

const MENU_EDGE_MARGIN_PX = 8;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * A minimal fixed-position context menu (the widget library has none).
 * Closes on outside pointer-down, Escape, or after any item runs.
 */
export function TreeContextMenu({ x, y, items, onClose }: TreeContextMenuProps): JSX.Element {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent): void => {
      if (menuRef.current && e.target instanceof Node && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // Keep the menu on-screen near the pointer.
  useEffect(() => {
    const el = menuRef.current;
    if (!el) {
      return;
    }

    const rect = el.getBoundingClientRect();
    const overX = rect.right - (window.innerWidth - MENU_EDGE_MARGIN_PX);
    const overY = rect.bottom - (window.innerHeight - MENU_EDGE_MARGIN_PX);
    if (overX > 0) {
      el.style.left = `${x - overX}px`;
    }
    if (overY > 0) {
      el.style.top = `${y - overY}px`;
    }
  }, [x, y]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-40 rounded border border-slate-700 bg-slate-900 py-1 shadow-lg"
      style={{ left: x, top: y }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={() => {
            item.onClick();
            onClose();
          }}
          className="block w-full cursor-pointer px-3 py-1 text-left text-slate-200 text-xs hover:bg-slate-700"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
