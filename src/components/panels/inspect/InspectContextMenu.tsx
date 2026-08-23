import { type JSX, useEffect, useRef, useState } from "react";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type InspectContextMenuProps = Readonly<{
  x: number;
  y: number;
  onCopyJson: () => Promise<boolean>;
  onCopyXpath: () => Promise<boolean>;
  onClose: () => void;
}>;

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const CLOSE_AFTER_COPY_MS = 600;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/** Right-click menu for an Inspect card: copy the object's raw data. */
export function InspectContextMenu({
  x,
  y,
  onCopyJson,
  onCopyXpath,
  onClose,
}: InspectContextMenuProps): JSX.Element {
  const [copied, setCopied] = useState<"json" | "xpath" | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Capture-phase, so it runs before the SVG's own pointer handlers —
    // but a press inside the menu itself must not dismiss it.
    const handleDismiss = (e: Event): void => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") {
        return;
      }
      if (e.target instanceof Node && menuRef.current?.contains(e.target)) {
        return;
      }

      onClose();
    };
    window.addEventListener("pointerdown", handleDismiss, true);
    window.addEventListener("keydown", handleDismiss, true);
    return () => {
      window.removeEventListener("pointerdown", handleDismiss, true);
      window.removeEventListener("keydown", handleDismiss, true);
    };
  }, [onClose]);

  const handleCopy = async (kind: "json" | "xpath", copy: () => Promise<boolean>): Promise<void> => {
    const ok = await copy();
    if (!ok) {
      onClose();
      return;
    }

    setCopied(kind);
    window.setTimeout(onClose, CLOSE_AFTER_COPY_MS);
  };

  const itemClass =
    "block w-full whitespace-nowrap px-3 py-1.5 text-left text-slate-200 text-xs hover:bg-slate-700";

  return (
    <div
      ref={menuRef}
      role="menu"
      className="fixed z-50 rounded border border-slate-600 bg-slate-800 py-1 shadow-lg"
      style={{ left: x, top: y }}
    >
      <button
        type="button"
        role="menuitem"
        className={itemClass}
        onClick={() => void handleCopy("json", onCopyJson)}
      >
        {copied === "json" ? "Copied ✓" : "Copy data as JSON"}
      </button>
      <button
        type="button"
        role="menuitem"
        className={itemClass}
        onClick={() => void handleCopy("xpath", onCopyXpath)}
      >
        {copied === "xpath" ? "Copied ✓" : "Copy XPath"}
      </button>
    </div>
  );
}
