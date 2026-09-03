import { buildClassificationGroups, type HighlightMode } from "../../lib/dexpi/classification.ts";
import {
  type CustomFilterCondition,
  type CustomHighlightFilter,
  conditionsToExpression,
} from "../../lib/dexpi/customHighlightFilter.ts";
import { fail, ok, type Result } from "../../lib/result.ts";
import { getLoadedDocument } from "../viewer/viewer.actions.ts";
import { viewerState } from "../viewer/viewer.state.ts";
import { highlightState } from "./highlight.state.ts";

const DEFAULT_FILTER_COLOR = "#e6a817";

// The mode is a user preference, so a new document recomputes the groups for
// it instead of clearing (an empty document simply yields no groups).
let seenDocRevision = viewerState.get().docRevision;
viewerState.subscribe(() => {
  const revision = viewerState.get().docRevision;
  if (revision !== seenDocRevision) {
    seenDocRevision = revision;
    setHighlightMode(highlightState.get().mode);
  }
});

/** Switches the classification and computes its groups for the loaded document. */
export function setHighlightMode(mode: HighlightMode): void {
  const doc = getLoadedDocument();
  highlightState.set({
    mode,
    groups: doc ? buildClassificationGroups(doc, mode) : [],
    hiddenKeys: [],
  });
}

/** Legend visibility toggle for one group's tint. */
export function toggleHighlightGroup(key: string): void {
  const { hiddenKeys } = highlightState.get();
  highlightState.set({
    hiddenKeys: hiddenKeys.includes(key) ? hiddenKeys.filter((k) => k !== key) : [...hiddenKeys, key],
  });
}

export function clearHighlight(): void {
  setHighlightMode("off");
}

/** Monochrome drawing toggle — content renders in ink/paper only. */
export function setHighlightMonochrome(monochrome: boolean): void {
  highlightState.set({ monochrome });
}

/** Fade non-highlighted content while a highlight mode is active. */
export function setHighlightDimOthers(dimOthers: boolean): void {
  highlightState.set({ dimOthers });
}

// -----------------------------------------------------------------------------
// Custom filters ("custom" mode)
// -----------------------------------------------------------------------------

function newCondition(): CustomFilterCondition {
  return { id: crypto.randomUUID(), field: "type", attributeName: "", operator: "contains", value: "" };
}

function updateFilterList(mapper: (filter: CustomHighlightFilter) => CustomHighlightFilter): void {
  const { customFilters } = highlightState.get();
  highlightState.set({ customFilters: customFilters.map(mapper) });
}

/** Appends a new filter at the end of the priority list (wins overlaps until reordered). */
export function addCustomFilter(): void {
  const { customFilters } = highlightState.get();
  const filter: CustomHighlightFilter = {
    id: crypto.randomUUID(),
    label: `Filter ${customFilters.length + 1}`,
    colorHex: DEFAULT_FILTER_COLOR,
    enabled: true,
    advanced: false,
    conditions: [newCondition()],
    expression: "",
  };
  highlightState.set({ customFilters: [...customFilters, filter] });
}

/** Patches one custom filter's label, color, or enabled state. */
export function updateCustomFilter(id: string, patch: Partial<CustomHighlightFilter>): void {
  updateFilterList((f) => (f.id === id ? { ...f, ...patch } : f));
}

export function removeCustomFilter(id: string): void {
  const { customFilters } = highlightState.get();
  highlightState.set({ customFilters: customFilters.filter((f) => f.id !== id) });
}

/** Moves a filter up/down the priority list — later filters win color overlaps. */
export function moveCustomFilter(id: string, direction: "up" | "down"): void {
  const { customFilters } = highlightState.get();
  const index = customFilters.findIndex((f) => f.id === id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= customFilters.length) {
    return;
  }

  const reordered = [...customFilters];
  const [moved] = reordered.splice(index, 1);
  if (moved) {
    reordered.splice(target, 0, moved);
  }
  highlightState.set({ customFilters: reordered });
}

/** Appends a new AND-ed condition to a filter's simple-mode rule. */
export function addCustomFilterCondition(filterId: string): void {
  updateFilterList((f) => (f.id === filterId ? { ...f, conditions: [...f.conditions, newCondition()] } : f));
}

/** Patches one condition (field, attribute name, operator, or value) within a filter. */
export function updateCustomFilterCondition(
  filterId: string,
  conditionId: string,
  patch: Partial<CustomFilterCondition>,
): void {
  updateFilterList((f) =>
    f.id === filterId
      ? { ...f, conditions: f.conditions.map((c) => (c.id === conditionId ? { ...c, ...patch } : c)) }
      : f,
  );
}

export function removeCustomFilterCondition(filterId: string, conditionId: string): void {
  updateFilterList((f) =>
    f.id === filterId ? { ...f, conditions: f.conditions.filter((c) => c.id !== conditionId) } : f,
  );
}

/** Toggles simple/advanced mode; seeds the expression from the current conditions the first time advanced mode is entered. */
export function setCustomFilterAdvanced(filterId: string, advanced: boolean): void {
  updateFilterList((f) => {
    if (f.id !== filterId || f.advanced === advanced) {
      return f;
    }

    const expression =
      advanced && f.expression.trim().length === 0 ? conditionsToExpression(f.conditions) : f.expression;
    return { ...f, advanced, expression };
  });
}

const FILTER_FILE_VERSION = 2;

/** Serializes the current custom filters to a portable JSON string. */
export function exportCustomFilters(): string {
  const { customFilters } = highlightState.get();
  return JSON.stringify({ version: FILTER_FILE_VERSION, filters: customFilters }, null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCustomFilterCondition(value: unknown): value is CustomFilterCondition {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    (value.field === "type" ||
      value.field === "attribute" ||
      value.field === "id" ||
      value.field === "persistentId" ||
      value.field === "xpath") &&
    typeof value.attributeName === "string" &&
    (value.operator === "equals" ||
      value.operator === "contains" ||
      value.operator === "notEquals" ||
      value.operator === "notContains") &&
    typeof value.value === "string"
  );
}

function isCustomHighlightFilter(value: unknown): value is CustomHighlightFilter {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.label === "string" &&
    typeof value.colorHex === "string" &&
    typeof value.enabled === "boolean" &&
    typeof value.advanced === "boolean" &&
    typeof value.expression === "string" &&
    Array.isArray(value.conditions) &&
    value.conditions.every(isCustomFilterCondition)
  );
}

function isFilterFile(value: unknown): value is { version: number; filters: unknown[] } {
  return isRecord(value) && typeof value.version === "number" && Array.isArray(value.filters);
}

/** Replaces the custom filter list from JSON previously written by `exportCustomFilters`. */
export function importCustomFilters(json: string): Result<number> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    return fail("Not valid JSON.", err);
  }

  if (!isFilterFile(parsed)) {
    return fail("Not a recognized highlight-filter file.");
  }
  if (parsed.version !== FILTER_FILE_VERSION) {
    return fail(`Unsupported highlight-filter file version ${parsed.version}.`);
  }

  const { filters } = parsed;
  if (!filters.every(isCustomHighlightFilter)) {
    return fail("Not a recognized highlight-filter file.");
  }

  highlightState.set({ customFilters: filters });
  return ok(filters.length);
}
