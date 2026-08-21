// -----------------------------------------------------------------------------
// Drawing-text display policy (director's rule)
//
// The viewer must never render unresolved markers, placeholder tokens, or
// clearly invalid sentinel values as normal drawing text. Some exporters
// write such placeholders into the model (e.g. a PropertyBreak's generic
// BreakValue fields) as though they were real engineering values; the
// affected label position is suppressed instead of drawn. This is a
// display-quality safeguard only — panels still show the raw stored data,
// and the source model is never repaired.
// -----------------------------------------------------------------------------

/** Lowercased sentinels that mark a value as unset rather than real. */
const INVALID_SENTINELS: ReadonlySet<string> = new Set([
  "?",
  "??",
  "???",
  "n/a",
  "n.a.",
  "tbd",
  "xxx",
  "null",
  "undefined",
  "unresolved",
  "unknown",
  "#n/a",
  "#value!",
  "#ref!",
]);

/** An unresolved template token that leaked into the data, e.g. "<BreakValue1>". */
const PLACEHOLDER_TOKEN = /<[A-Za-z][A-Za-z0-9_.]*>|\{[A-Za-z][A-Za-z0-9_.]*\}/;

/**
 * The exporter's repeated unknown-value filler: a value of length ≥ 2 that
 * carries no letter or digit at all ("????", "-----", "?!?!", "····"), or
 * a pure run of the conventional unknown marker x/X ("xxxx"). Real
 * engineering values always contain at least one alphanumeric character
 * that is not such a filler run; single symbols stay renderable (lone "?"
 * is already in the sentinel list). Deliberately shape-based — no object,
 * position, or break identifier is consulted.
 */
function isExporterPlaceholder(normalized: string): boolean {
  const compact = normalized.replace(/\s+/g, "");
  if (compact.length < 2) {
    return false;
  }

  if (!/[\p{L}\p{N}]/u.test(compact)) {
    return true;
  }

  return /^[xX]+$/.test(compact);
}

/**
 * Whether a resolved attribute value is real display information for the
 * drawing. Empty/whitespace values, known invalid sentinels, leaked
 * template-token shapes, and the exporter's repeated placeholder filler
 * are not renderable — the label position they would fill is suppressed
 * rather than drawn.
 */
export function isRenderableLabelValue(value: string): boolean {
  const normalized = value.trim();
  if (normalized.length === 0) {
    return false;
  }

  if (INVALID_SENTINELS.has(normalized.toLowerCase())) {
    return false;
  }

  return !PLACEHOLDER_TOKEN.test(normalized) && !isExporterPlaceholder(normalized);
}
