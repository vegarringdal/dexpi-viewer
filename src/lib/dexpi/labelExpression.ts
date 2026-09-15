// -----------------------------------------------------------------------------
// Profile/LabelTemplate text expressions
//
// Most template texts are plain: literal characters with <Placeholder> tokens
// inline. Some are VB-style concatenations instead — single-quoted string
// literals joined to placeholders with `&`:
//
//   'SP = ' & <SetPoint>
//   'H=' & SignalConveyingFunction:<AlarmValue>
//
// Both forms collapse to the same plain template text here, so placeholder
// resolution downstream sees one shape (profileLabels.ts).
// -----------------------------------------------------------------------------

const QUOTE = "'";

/**
 * DiscProfile 0.6.3 wrote the alarm templates without their OPENING quote
 * ("H=' & …"), which 0.6.4 corrected to "'H=' & …". Both catalogues ship, so
 * the malformed spelling is repaired rather than rejected: an odd number of
 * quotes means the first one closes a literal that was never opened, so the
 * text gets the missing opening quote back.
 */
function repairUnopenedLiteral(text: string): string {
  const quoteCount = text.split(QUOTE).length - 1;
  return quoteCount % 2 === 1 ? QUOTE + text : text;
}

/**
 * Drops the `&` operators of an unquoted run and the whitespace that merely
 * separates them from their operands. A run holding no operator is left
 * untouched — a plain template's own leading/trailing spaces are content.
 */
function collapseConcatenation(run: string): string {
  const parts = run.split("&");
  if (parts.length === 1) {
    return run;
  }

  return parts
    .map((part, index) => {
      const withoutLeading = index > 0 ? part.replace(/^\s+/, "") : part;
      return index < parts.length - 1 ? withoutLeading.replace(/\s+$/, "") : withoutLeading;
    })
    .join("");
}

/**
 * Normalizes one LabelTemplate Text to plain template text: quoted literals
 * contribute their content ('' being an escaped quote), `&` operators and the
 * whitespace around them disappear, and everything else — placeholders
 * included — passes through verbatim.
 */
export function normalizeLabelTemplateText(rawText: string): string {
  if (!rawText.includes(QUOTE) && !rawText.includes("&")) {
    return rawText;
  }

  const text = repairUnopenedLiteral(rawText);
  let out = "";
  let run = "";
  let index = 0;
  while (index < text.length) {
    if (text[index] !== QUOTE) {
      run += text[index];
      index += 1;
      continue;
    }

    out += collapseConcatenation(run);
    run = "";
    index += 1;
    while (index < text.length) {
      if (text[index] !== QUOTE) {
        out += text[index];
        index += 1;
        continue;
      }

      if (text[index + 1] === QUOTE) {
        out += QUOTE;
        index += 2;
        continue;
      }

      index += 1;
      break;
    }
  }
  return out + collapseConcatenation(run);
}
