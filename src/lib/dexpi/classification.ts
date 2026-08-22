import type { PlantNode } from "./plantModel.ts";
import type { DexpiDocument } from "./types.ts";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type HighlightMode = "off" | "heatTrace" | "signal" | "fluidCode" | "pipingClass";

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
  if (mode === "off") {
    return [];
  }

  if (mode === "heatTrace") {
    const ids = [...doc.scene.heatTracedIds];
    return ids.length > 0 ? [{ key: "heatTrace", label: "Heat traced", objectIds: ids }] : [];
  }

  if (mode === "signal") {
    const ids = [...doc.plant.byId.values()].filter((n) => isSignalType(n.typeName)).map((n) => n.id);
    return ids.length > 0 ? [{ key: "signal", label: "Signal & instrument lines", objectIds: ids }] : [];
  }

  const attribute = MODE_ATTRIBUTE[mode];
  if (attribute === undefined) {
    return [];
  }

  return [...groupByEffectiveAttribute(doc.plant.roots, attribute).entries()]
    .map(([key, objectIds]) => ({ key, label: key, objectIds }))
    .sort((a, b) => b.objectIds.length - a.objectIds.length || a.key.localeCompare(b.key));
}
