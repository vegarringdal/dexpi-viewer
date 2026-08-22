import { createStore } from "../../lib/createStore.ts";
import type { SeverityOverride } from "../../lib/dexpi/validation.ts";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type ValidationConfigState = Readonly<{
  /** Per-rule severity overrides; rules absent here use their built-in severity. */
  overrides: Readonly<Record<string, SeverityOverride>>;
}>;

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const validationConfigState = createStore<ValidationConfigState>({
  overrides: {},
});
