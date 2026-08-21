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
 * The exporter's repeated/mixed unknown-value filler: a value of length ≥ 2
 * in which EVERY character is filler — a symbol/punctuation character or
 * the conventional unknown marker x/X. Covers pure runs ("????", "-----",
 * "xxxx") and mixed patterns ("??XX??", "x-x-x", "?!?!"). Real engineering
 * values always contain at least one letter (other than a bare x) or
 * digit; single symbols stay renderable (lone "?" is already in the
 * sentinel list). Deliberately shape-based — no object, position, or
 * break identifier is consulted.
 */
function isMixedExporterPlaceholder(normalized: string): boolean {
  const compact = normalized.replace(/\s+/g, "");
  if (compact.length < 2) {
    return false;
  }

  return [...compact].every((c) => c === "x" || c === "X" || !/[\p{L}\p{N}]/u.test(c));
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

  return !PLACEHOLDER_TOKEN.test(normalized) && !isMixedExporterPlaceholder(normalized);
}
