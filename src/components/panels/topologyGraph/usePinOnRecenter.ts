import { useEffect, useRef } from "react";
import type { GraphLayout } from "../../../lib/graph/layeredLayout.ts";
import type { ViewTransform } from "../../hooks/useSvgPanZoom.ts";
import type { TopologyGraphView } from "./useTopologyGraph.ts";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type PendingPin = Readonly<{
  id: string;
  screenX: number;
  screenY: number;
  scale: number;
}>;

type PreviousLayout = Readonly<{
  layout: GraphLayout;
  rootId: string | null;
}>;

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

/**
 * Keeps the view steady when the ego graph re-roots, instead of the auto-fit
 * zooming the whole picture out (the user loses their place). Two sources:
 *
 * - A plain click on a graph node: its exact screen position and zoom are
 *   captured before the click and re-applied once the new layout is in.
 * - An external selection (drawing, Explorer, chips): zoom is preserved; the
 *   new root stays where it already is when fully inside the viewport, and
 *   is centered at the same zoom when it is off-screen or new to the graph.
 *
 * Structural changes (first layout, mode switch, depth/edge/hardware
 * toggles) keep the auto-fit. Both this effect and the auto-fit run in one
 * effects flush, this one last — call it AFTER useSvgPanZoom so it wins.
 */
export function usePinOnRecenter(
  view: TopologyGraphView,
  transform: ViewTransform,
  setViewTransform: (next: ViewTransform) => void,
  getViewportSize: () => Readonly<{ width: number; height: number }> | null,
  onNodeClick: (id: string, isToggle: boolean) => void,
): (id: string, isToggle: boolean) => void {
  const pendingRef = useRef<PendingPin | null>(null);
  const previousRef = useRef<PreviousLayout | null>(null);
  const layout = view.status === "ready" ? view.layout : null;
  const rootId = view.status === "ready" ? view.rootId : null;

  // The effect must run per layout change only; transform/rootId are read
  // as-of that same render, which is exactly the pre-relayout view state.
  // biome-ignore lint/correctness/useExhaustiveDependencies: anchor once per layout, with that render's transform.
  useEffect(() => {
    const pin = pendingRef.current;
    const previous = previousRef.current;
    pendingRef.current = null;
    previousRef.current = layout ? { layout, rootId } : null;
    if (!layout) {
      return;
    }

    if (pin) {
      const node = layout.nodes.get(pin.id);
      if (node) {
        setViewTransform({
          scale: pin.scale,
          x: pin.screenX - node.x * pin.scale,
          y: pin.screenY - node.y * pin.scale,
        });
      }
      return;
    }

    // External recenter = the root moved while staying in neighborhood mode.
    if (rootId === null || !previous || previous.rootId === null || previous.rootId === rootId) {
      return;
    }

    const size = getViewportSize();
    const node = layout.nodes.get(rootId);
    if (!size || !node) {
      return;
    }

    const { scale } = transform;
    const previousNode = previous.layout.nodes.get(rootId);
    if (previousNode) {
      const screenX = transform.x + previousNode.x * scale;
      const screenY = transform.y + previousNode.y * scale;
      const isFullyVisible =
        screenX >= 0 &&
        screenY >= 0 &&
        screenX + previousNode.width * scale <= size.width &&
        screenY + previousNode.height * scale <= size.height;
      if (isFullyVisible) {
        setViewTransform({ scale, x: screenX - node.x * scale, y: screenY - node.y * scale });
        return;
      }
    }

    setViewTransform({
      scale,
      x: size.width / 2 - (node.x + node.width / 2) * scale,
      y: size.height / 2 - (node.y + node.height / 2) * scale,
    });
  }, [layout]);

  return (id: string, isToggle: boolean): void => {
    // Only a plain click on a non-root ego node triggers a relayout worth
    // pinning; toggles and document mode leave the layout untouched.
    if (!isToggle && view.status === "ready" && view.rootId !== null && id !== view.rootId) {
      const node = view.layout.nodes.get(id);
      if (node) {
        pendingRef.current = {
          id,
          scale: transform.scale,
          screenX: transform.x + node.x * transform.scale,
          screenY: transform.y + node.y * transform.scale,
        };
      }
    }
    onNodeClick(id, isToggle);
  };
}
