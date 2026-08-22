import { Button, Select, type SelectOption } from "@tredespace/ui/widgets";
import type { JSX } from "react";
import {
  CATEGORY_LABELS,
  categoryOfRule,
  RULE_TITLES,
  type SeverityOverride,
  type ValidationCategory,
} from "../../lib/dexpi/validation.ts";
import {
  clearRuleSeverityOverrides,
  setRuleSeverityOverride,
} from "../../state/validation/validation.actions.ts";
import { validationConfigState } from "../../state/validation/validation.state.ts";

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const DEFAULT_VALUE = "default";

const OVERRIDE_OPTIONS: readonly SelectOption[] = [
  { value: DEFAULT_VALUE, label: "Default" },
  { value: "error", label: "Error" },
  { value: "warning", label: "Warning" },
  { value: "info", label: "Info" },
  { value: "ignore", label: "Ignore" },
];

const CATEGORY_ORDER: readonly ValidationCategory[] = [
  "schema",
  "graphics",
  "connectivity",
  "model",
  "metadata",
];

// -----------------------------------------------------------------------------
// Helper functions
// -----------------------------------------------------------------------------

function isSeverityOverride(value: string | null): value is SeverityOverride {
  return value === "error" || value === "warning" || value === "info" || value === "ignore";
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * Per-rule severity overrides ("Default" = the rule's built-in severity,
 * "Ignore" = drop its findings), grouped by category and persisted across
 * sessions.
 */
export function RuleSeverityConfig(): JSX.Element {
  const { overrides } = validationConfigState.use();
  const hasOverrides = Object.keys(overrides).length > 0;

  const handleChange = (ruleId: string, value: string | null): void => {
    setRuleSeverityOverride(ruleId, isSeverityOverride(value) ? value : null);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-500 uppercase tracking-wide">Rule severities</span>
        <Button onClick={clearRuleSeverityOverrides} disabled={!hasOverrides}>
          Reset all
        </Button>
      </div>
      {CATEGORY_ORDER.map((category) => (
        <div key={category} className="flex flex-col gap-1">
          <span className="text-[10px] text-slate-500 uppercase tracking-wide">
            {CATEGORY_LABELS[category]}
          </span>
          {Object.keys(RULE_TITLES)
            .filter((ruleId) => categoryOfRule(ruleId) === category)
            .map((ruleId) => (
              <div key={ruleId} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-slate-300 text-xs" title={RULE_TITLES[ruleId]}>
                  <span className="font-mono text-[10px] text-slate-500">{ruleId}</span> {RULE_TITLES[ruleId]}
                </span>
                <div className="w-24 shrink-0">
                  <Select
                    value={overrides[ruleId] ?? DEFAULT_VALUE}
                    options={[...OVERRIDE_OPTIONS]}
                    onChange={(value) => handleChange(ruleId, value)}
                  />
                </div>
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}
