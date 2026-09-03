import type { PlantNode } from "./plantModel.ts";
import type { DexpiDocument } from "./types.ts";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type HighlightMode = "off" | "heatTrace" | "signal" | "fluidCode" | "pipingClass" | "custom";

export type ClassificationGroup = Readonly<{
  key: string;
  label: string;
  objectIds: readonly string[];
}>;

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const MODE_ATTRIBUTE: Readonly<Partial<Record<HighlightMode, string>>> = {
  fluidCode: "FluidCode",
  pipingClass: "PipingClassCode",
};

/** Instrument-line families beyond types that literally contain "Signal". */
const SIGNAL_TYPE_SUFFIXES = ["MeasuringLineFunction", "ActuatingFunction"] as const;

// -----------------------------------------------------------------------------
// Classification
// -----------------------------------------------------------------------------

function isSignalType(typeName: string): boolean {
  return typeName.includes("Signal") || SIGNAL_TYPE_SUFFIXES.some((s) => typeName.endsWith(s));
}

/**
 * Groups plant objects by the EFFECTIVE value of `attributeName`: a node's own
 * value wins, otherwise the nearest ancestor's value is inherited — so a code
 * stated once on a PipingNetworkSystem covers the segments, pipes and inline
 * components below it, mirroring how heat-trace classification inherits.
 */
function groupByEffectiveAttribute(
  roots: readonly PlantNode[],
  attributeName: string,
): Map<string, string[]> {
  const groups = new Map<string, string[]>();

  const walk = (node: PlantNode, inherited: string | null): void => {
    const own = node.attributes.find((a) => a.name === attributeName)?.value;
    const effective = own !== undefined && own.length > 0 ? own : inherited;
    if (effective !== null) {
      groups.set(effective, [...(groups.get(effective) ?? []), node.id]);
    }
    for (const child of node.children) {
      walk(child, effective);
    }
  };
  for (const root of roots) {
    walk(root, null);
  }
  return groups;
}

/**
 * The highlightable object groups for a classification mode. Deterministic:
 * groups sort by descending member count, then key. Modes without data in the
 * document return an empty list — the UI reports that honestly instead of
 * pretending to highlight.
 */
export function buildClassificationGroups(
  doc: DexpiDocument,
  mode: HighlightMode,
): readonly ClassificationGroup[] {
  if (mode === "off" || mode === "custom") {
    // Custom mode's groups come from the user's own filters (see
    // customHighlightFilter.ts), not this fixed classification scheme.
    return [];
  }

  if (mode === "heatTrace") {
    const ids = [...doc.scene.heatTracedIds];
    return ids.length > 0 ? [{ key: "heatTrace", label: "Heat traced", objectIds: ids }] : [];
  }

  if (mode === "signal") {
    // One group per signal SEMANTICS, so each type highlights in its own
    // color: the SignalConveyingFunctionTypeRepresentation value where the
    // file carries one, else the bare class name (MeasuringLineFunction…).
    const groups = new Map<string, string[]>();
    for (const node of doc.plant.byId.values()) {
      if (!isSignalType(node.typeName)) {
        continue;
      }

      const representation = node.attributes.find((a) =>
        a.name.endsWith("SignalConveyingFunctionTypeRepresentation"),
      )?.value;
      const key = representation ?? node.typeName;
      groups.set(key, [...(groups.get(key) ?? []), node.id]);
    }
    return [...groups.entries()]
      .map(([key, objectIds]) => ({ key, label: key, objectIds }))
      .sort((a, b) => b.objectIds.length - a.objectIds.length || a.key.localeCompare(b.key));
  }

  const attribute = MODE_ATTRIBUTE[mode];
  if (attribute === undefined) {
    return [];
  }

  return [...groupByEffectiveAttribute(doc.plant.roots, attribute).entries()]
    .map(([key, objectIds]) => ({ key, label: key, objectIds }))
    .sort((a, b) => b.objectIds.length - a.objectIds.length || a.key.localeCompare(b.key));
}
