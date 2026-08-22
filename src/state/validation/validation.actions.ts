import {
  applySeverityOverrides,
  RULE_TITLES,
  type SeverityOverride,
  type ValidationIssue,
} from "../../lib/dexpi/validation.ts";
import { getLoadedDocument } from "../viewer/viewer.actions.ts";
import { validationConfigState } from "./validation.state.ts";

const OVERRIDES_STORAGE_KEY = "dexpi.validation.severityOverrides";
const OVERRIDE_VALUES: readonly SeverityOverride[] = ["error", "warning", "info", "ignore"];

function isSeverityOverride(value: unknown): value is SeverityOverride {
  return typeof value === "string" && OVERRIDE_VALUES.some((v) => v === value);
}

/** Call once at startup: restores persisted per-rule severity overrides. */
export function applyStoredValidationOverrides(): void {
  const raw = localStorage.getItem(OVERRIDES_STORAGE_KEY);
  if (!raw) {
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }
  if (typeof parsed !== "object" || parsed === null) {
    return;
  }

  const overrides: Record<string, SeverityOverride> = {};
  for (const [ruleId, value] of Object.entries(parsed)) {
    if (ruleId in RULE_TITLES && isSeverityOverride(value)) {
      overrides[ruleId] = value;
    }
  }
  validationConfigState.set({ overrides });
}

function persist(overrides: Readonly<Record<string, SeverityOverride>>): void {
  localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));
}

/** Sets one rule's severity override; `null` restores the built-in severity. */
export function setRuleSeverityOverride(ruleId: string, override: SeverityOverride | null): void {
  const current = validationConfigState.get().overrides;
  const overrides: Record<string, SeverityOverride> = {};
  for (const [key, value] of Object.entries(current)) {
    if (key !== ruleId) {
      overrides[key] = value;
    }
  }
  if (override !== null) {
    overrides[ruleId] = override;
  }
  validationConfigState.set({ overrides });
  persist(overrides);
}

/** Restores every rule to its built-in severity. */
export function clearRuleSeverityOverrides(): void {
  validationConfigState.set({ overrides: {} });
  persist({});
}

/** The loaded document's findings with the user's severity overrides applied. */
export function getEffectiveIssues(): ValidationIssue[] {
  const doc = getLoadedDocument();
  if (!doc) {
    return [];
  }

  return applySeverityOverrides(doc.issues, validationConfigState.get().overrides);
}
