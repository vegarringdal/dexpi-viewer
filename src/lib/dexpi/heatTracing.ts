import type { RgbColor, SceneNode } from "./types.ts";
import { componentObjects, dataValue, getData, refLocalName } from "./xml.ts";

// -----------------------------------------------------------------------------
// Heat tracing (main-file data, director's rendering rules)
//
// `HeatTracingType` on a piping object is semantic metadata in the MAIN
// DEXPI model (not DiscProfile.xml). Classified runs get a dashed overlay
// drawn on top of the normal pipe geometry; the dash pattern, color, width
// and offset below are this viewer's display rules, since the file carries
// no explicit heat-trace geometry. HeatTracingBreak objects are logical
// property breaks — associated data, never drawn as components.
// -----------------------------------------------------------------------------

/** Viewer display rules for the overlay (drawn atop the pipe, no offset). */
const HEAT_TRACE_DASH_MM: readonly number[] = [2.4, 1.6];
const HEAT_TRACE_COLOR: RgbColor = { r: 217, g: 108, b: 24 };

/**
 * Ids of every object classified as heat-traced (`HeatTracingType` present
 * and not "None"), plus their nested component objects — a classification
 * on a segment covers the pipes inside it.
 */
export function collectHeatTracedIds(root: Element): Set<string> {
  const traced = new Set<string>();
  const addWithDescendants = (el: Element): void => {
    const id = el.getAttribute("id");
    if (id) {
      traced.add(id);
    }
    for (const child of componentObjects(el)) {
      addWithDescendants(child);
    }
  };

  for (const el of root.querySelectorAll("Object[id]")) {
    const type = refLocalName(dataValue(getData(el, "HeatTracingType")));
    if (type && type !== "None") {
      addWithDescendants(el);
    }
  }
  return traced;
}

/**
 * Dashed overlay polylines for every connector run owned by a heat-traced
 * object. Separate nodes on top of the base geometry — the pipe itself
 * stays untouched, so the overlay can never read as a second pipe.
 */
export function buildHeatTraceOverlays(
  nodes: readonly SceneNode[],
  tracedIds: ReadonlySet<string>,
): SceneNode[] {
  if (tracedIds.size === 0) {
    return [];
  }

  const overlays: SceneNode[] = [];
  for (const node of nodes) {
    if (
      node.kind !== "prim" ||
      node.role !== "connector" ||
      node.prim.kind !== "polyline" ||
      !node.objectId ||
      !tracedIds.has(node.objectId)
    ) {
      continue;
    }

    overlays.push({
      kind: "prim",
      prim: {
        kind: "polyline",
        points: node.prim.points,
        stroke: {
          color: HEAT_TRACE_COLOR,
          width: node.prim.stroke.width,
          dash: HEAT_TRACE_DASH_MM,
        },
      },
      objectId: node.objectId,
      role: "connector",
    });
  }
  return overlays;
}
