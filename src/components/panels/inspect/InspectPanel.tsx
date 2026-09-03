import { PanelBody } from "@tredespace/ui/dockable";
import { Button, Checkbox, Select, type SelectOption } from "@tredespace/ui/widgets";
import { type JSX, useEffect, useRef, useState } from "react";
import { MAX_DIAGRAM_DEPTH, MIN_DIAGRAM_DEPTH } from "../../../lib/graph/objectDiagram.ts";
import type { PlacedCard } from "../../../lib/graph/objectDiagramLayout.ts";
import { useSvgPanZoom } from "../../hooks/useSvgPanZoom.ts";
import { InspectCardView } from "./InspectCardView.tsx";
import { InspectContextMenu } from "./InspectContextMenu.tsx";
import { InspectEdgeView } from "./InspectEdgeView.tsx";
import { useInspectDiagram } from "./useInspectDiagram.ts";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type PendingPin = Readonly<{ id: string; screenX: number; screenY: number; scale: number }>;

type MenuState = Readonly<{ id: string; x: number; y: number }>;

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Expected failure (denied clipboard permission) — reported, never thrown. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

const DEPTH_OPTIONS: readonly SelectOption[] = Array.from(
  { length: MAX_DIAGRAM_DEPTH - MIN_DIAGRAM_DEPTH + 1 },
  (_, i) => ({
    value: String(MIN_DIAGRAM_DEPTH + i),
    label: `${MIN_DIAGRAM_DEPTH + i} level${MIN_DIAGRAM_DEPTH + i > 1 ? "s" : ""}`,
  }),
);

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * Debug panel: a UML-style instance diagram of the selected object — its full
 * raw Data as rows plus its relations up to the chosen depth (references,
 * referenced-by, containment, profile-instance stubs), edges labeled with
 * the actual property names. Clicking a neighbor re-centers on it, pinning
 * the clicked card's screen position so the view does not jump. The Drawing
 * toggle adds the Core/Diagram objects (labels, representation groups, …).
 */
export function InspectPanel(): JSX.Element {
  const { hasFile, layout, depth, setDepth, showDrawing, setShowDrawing, navigate, exportCard } =
    useInspectDiagram();
  const [menu, setMenu] = useState<MenuState | null>(null);

  const panZoom = useSvgPanZoom(layout?.width ?? 0, layout?.height ?? 0);
  const { fitToContent, setViewTransform, transform } = panZoom;
  const { x, y, scale } = transform;
  const pendingPinRef = useRef<PendingPin | null>(null);

  // A pinned re-center (neighbor card click) restores the clicked card's
  // screen position for the new center; anything else re-fits.
  // biome-ignore lint/correctness/useExhaustiveDependencies: anchor once per layout, with that render's transform.
  useEffect(() => {
    const pin = pendingPinRef.current;
    pendingPinRef.current = null;
    if (pin && layout && layout.center.card.id === pin.id) {
      setViewTransform({
        scale: pin.scale,
        x: pin.screenX - layout.center.x * pin.scale,
        y: pin.screenY - layout.center.y * pin.scale,
      });
      return;
    }

    fitToContent();
  }, [layout]);

  if (!hasFile) {
    return (
      <PanelBody className="flex h-full items-center justify-center p-4 text-center text-slate-500 text-xs">
        Open a DEXPI file to get started.
      </PanelBody>
    );
  }

  // `id` is what InspectCardView actually asked to navigate to — a stub
  // card's `navigateId` (the real object that referenced it) when it has
  // no plant data of its own, `placed.card.id` otherwise. The pin still
  // keys off `placed.card.id`: when they differ, the new center won't be
  // at the clicked card's old screen position anyway, so the effect below
  // falls back to fitToContent instead of forcing a wrong pin.
  const handleNavigate = (placed: PlacedCard, id: string): void => {
    pendingPinRef.current = {
      id: placed.card.id,
      scale,
      screenX: x + placed.x * scale,
      screenY: y + placed.y * scale,
    };
    navigate(id);
  };

  const handleMenu = (id: string, x: number, y: number): void => {
    if (exportCard(id)) {
      setMenu({ id, x, y });
    }
  };

  // The header always renders: the Drawing toggle must stay reachable even
  // when the current selection only resolves in the OTHER mode (a drawing
  // object selected while in plant mode yields no diagram).
  if (!layout) {
    return (
      <PanelBody className="flex h-full flex-col gap-2 p-2">
        <div className="flex shrink-0 items-center justify-end gap-2">
          <Checkbox label="Drawing" checked={showDrawing} onChange={(checked) => setShowDrawing(checked)} />
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-center text-slate-500 text-xs">
          {showDrawing
            ? "Select an object (drawing, Explorer, or a neighbor card) to inspect it."
            : "Select an object to inspect it — drawing-side objects need the Drawing toggle."}
        </div>
      </PanelBody>
    );
  }

  return (
    <PanelBody className="flex h-full flex-col gap-2 p-2">
      <div className="flex shrink-0 items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-400">
          {showDrawing ? "Drawing · " : ""}
          {layout.center.card.title} — {layout.center.card.subtitle}
        </span>
        <Checkbox label="Drawing" checked={showDrawing} onChange={(checked) => setShowDrawing(checked)} />
        <div className="w-24 shrink-0">
          <Select
            value={String(depth)}
            options={[...DEPTH_OPTIONS]}
            onChange={(value) => setDepth(Number.parseInt(value ?? "1", 10) || MIN_DIAGRAM_DEPTH)}
          />
        </div>
        <Button onClick={fitToContent}>Fit</Button>
      </div>
      {layout.center.card.xpath && (
        <div className="shrink-0 select-text break-all font-mono text-[10px] text-slate-500">
          {layout.center.card.xpath}
        </div>
      )}
      <div className="shrink-0 text-[10px] text-slate-500 italic">
        {layout.center.card.drawing
          ? "Drawing-side object — shown only here; right-click a card to copy its raw data."
          : "See the Properties panel for this object's full data."}
      </div>
      <div
        ref={panZoom.containerRef}
        className="relative min-h-0 flex-1 cursor-grab touch-none select-none overflow-hidden rounded border border-slate-800 bg-slate-950/40"
        onPointerDown={panZoom.handlePointerDown}
        onPointerMove={panZoom.handlePointerMove}
        onPointerUp={panZoom.handlePointerUp}
      >
        <svg role="img" aria-label="Object diagram" className="h-full w-full">
          <defs>
            <marker
              id="inspect-arrow"
              viewBox="0 0 8 8"
              refX="7"
              refY="4"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 8 4 L 0 8 z" className="fill-slate-500" />
            </marker>
          </defs>
          <g transform={`translate(${x} ${y}) scale(${scale})`}>
            {layout.edges.map((edge, i) => (
              <InspectEdgeView key={`${edge.label}-${String(i)}`} edge={edge} />
            ))}
            {layout.neighbors.map((placed) => (
              <InspectCardView
                key={placed.key}
                placed={placed}
                isCenter={false}
                onNavigate={(id) => handleNavigate(placed, id)}
                onMenu={handleMenu}
              />
            ))}
            <InspectCardView
              placed={layout.center}
              isCenter
              onNavigate={() => undefined}
              onMenu={handleMenu}
            />
          </g>
        </svg>
      </div>
      {menu && (
        <InspectContextMenu
          x={menu.x}
          y={menu.y}
          onCopyJson={() => copyText(exportCard(menu.id)?.json ?? "")}
          onCopyXpath={() => copyText(exportCard(menu.id)?.xpath ?? "")}
          onClose={() => setMenu(null)}
        />
      )}
    </PanelBody>
  );
}
