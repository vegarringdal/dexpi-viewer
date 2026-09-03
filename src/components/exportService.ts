import { sceneToSvg } from "../lib/dexpi/exportSvg.ts";
import type { DexpiDocument } from "../lib/dexpi/types.ts";
import { categoryOfRule, type ValidationIssue } from "../lib/dexpi/validation.ts";
import { elementXPath } from "../lib/dexpi/xml.ts";
import { downloadBlob } from "../lib/download.ts";
import { fail, ok, type Result } from "../lib/result.ts";
import { getEffectiveIssues } from "../state/validation/validation.actions.ts";
import { getLoadedDocument } from "../state/viewer/viewer.actions.ts";
import { viewerState } from "../state/viewer/viewer.state.ts";
import { sceneToPdf } from "./exportPdf.ts";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function requireDocument(): Result<DexpiDocument> {
  const doc = getLoadedDocument();
  return doc ? ok(doc) : fail("No document loaded.");
}

function baseName(): string {
  const name = viewerState.get().file?.name ?? "dexpi-drawing";
  return name.replace(/\.xml$/i, "");
}

type ScanState = { index: number; line: number };

/** Advances the scan past `marker` (or to the end), counting newlines. */
function skipPast(text: string, state: ScanState, marker: string): void {
  const found = text.indexOf(marker, state.index);
  const stop = found === -1 ? text.length : found + marker.length;
  for (let i = state.index; i < stop; i += 1) {
    if (text[i] === "\n") {
      state.line += 1;
    }
  }

  state.index = stop;
}

/** Advances past the current tag's closing ">", ignoring ">" inside quoted
 *  attribute values. */
function skipTag(text: string, state: ScanState): void {
  let quote: string | null = null;
  let i = state.index;
  while (i < text.length) {
    const char = text[i];
    if (char === "\n") {
      state.line += 1;
    }
    if (quote !== null) {
      if (char === quote) {
        quote = null;
      }
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === ">") {
      i += 1;
      break;
    }

    i += 1;
  }

  state.index = i;
}

/**
 * Start line of every element's opening tag, in document order, from a scan
 * of the ORIGINAL file text (not a re-serialization of the parsed DOM, which
 * could reformat and silently break the correspondence). Comments, CDATA,
 * processing instructions and the DOCTYPE are skipped so they cannot be
 * mistaken for elements; self-closing tags count once, closing tags never.
 */
function openingTagLines(xmlText: string): readonly number[] {
  const lines: number[] = [];
  const state: ScanState = { index: 0, line: 1 };
  while (state.index < xmlText.length) {
    const char = xmlText[state.index];
    if (char !== "<") {
      if (char === "\n") {
        state.line += 1;
      }

      state.index += 1;
      continue;
    }

    if (xmlText.startsWith("<!--", state.index)) {
      skipPast(xmlText, state, "-->");
      continue;
    }

    if (xmlText.startsWith("<![CDATA[", state.index)) {
      skipPast(xmlText, state, "]]>");
      continue;
    }

    if (xmlText.startsWith("<?", state.index) || xmlText.startsWith("<!", state.index)) {
      skipTag(xmlText, state);
      continue;
    }

    const isClosingTag = xmlText.startsWith("</", state.index);
    const startLine = state.line;
    skipTag(xmlText, state);
    if (!isClosingTag) {
      lines.push(startLine);
    }
  }
  return lines;
}

/**
 * Positional XPath of every element in the document, in document order —
 * the same pre-order `openingTagLines` produces. Built top-down (one tag
 * count per parent) so the whole index costs O(elements), rather than
 * re-walking ancestors and siblings per element as `elementXPath` does.
 */
function xpathsInDocumentOrder(root: Element): readonly string[] {
  const xpaths: string[] = [];
  const visit = (el: Element, xpath: string): void => {
    xpaths.push(xpath);
    const totals = new Map<string, number>();
    for (const child of el.children) {
      totals.set(child.tagName, (totals.get(child.tagName) ?? 0) + 1);
    }

    const seen = new Map<string, number>();
    for (const child of el.children) {
      const position = (seen.get(child.tagName) ?? 0) + 1;
      seen.set(child.tagName, position);
      const isIndexed = (totals.get(child.tagName) ?? 0) > 1;
      visit(child, `${xpath}/${child.tagName}${isIndexed ? `[${String(position)}]` : ""}`);
    }
  };
  visit(root, `/${root.tagName}`);
  return xpaths;
}

/**
 * Source line for every element, keyed by its positional XPath. A parsed DOM
 * `Element` carries no source position, so the raw-text tag order is paired
 * with the DOM's own document order — identical by construction. A count
 * mismatch means the two disagree (unparsed construct, malformed text): the
 * index is dropped whole rather than reporting lines that are off by some
 * elements.
 */
function buildLineIndex(xmlText: string, root: Element): ReadonlyMap<string, number> {
  const documentRoot = root.ownerDocument?.documentElement ?? root;
  const lines = openingTagLines(xmlText);
  const xpaths = xpathsInDocumentOrder(documentRoot);
  if (lines.length !== xpaths.length) {
    return new Map();
  }

  const index = new Map<string, number>();
  for (const [position, xpath] of xpaths.entries()) {
    const line = lines[position];
    if (line !== undefined && !index.has(xpath)) {
      index.set(xpath, line);
    }
  }
  return index;
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

/**
 * The full CSV report body (header + one row per issue) — pure and exported
 * for direct testing, separate from the DOM-download side effect in
 * `exportIssuesCsv`.
 *
 * `line`/`xpath` locate the element the finding is REALLY about (the
 * offending `<References>`/`<Data>` element, as reported by the rule in
 * `issue.xpath`), falling back to the owning object named by `objectId`
 * for rules that have no finer locator.
 */
export function buildIssuesCsv(issues: readonly ValidationIssue[], root: Element, xmlText: string): string {
  const lineByXPath = buildLineIndex(xmlText, root);
  const elementsById = new Map<string, Element>();
  for (const el of root.querySelectorAll("Object[id]")) {
    const id = el.getAttribute("id");
    if (id) {
      elementsById.set(id, el);
    }
  }

  const rows = [
    "rule,category,severity,objectId,line,xpath,message",
    ...issues.map((issue) => {
      const owner = issue.objectId ? elementsById.get(issue.objectId) : undefined;
      const xpath = issue.xpath ?? (owner ? elementXPath(owner) : "");
      const line = lineByXPath.get(xpath) ?? "";
      return [
        issue.ruleId,
        categoryOfRule(issue.ruleId),
        issue.severity,
        issue.objectId ?? "",
        line,
        csvCell(xpath),
        csvCell(issue.message),
      ].join(",");
    }),
  ];
  return rows.join("\n");
}

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

/** Renders the drawing as a vector PDF (embedded metric-compatible fonts). */
export async function exportPdf(): Promise<Result<void>> {
  const docResult = requireDocument();
  if (!docResult.data) {
    return fail(docResult.error?.msg ?? "No document loaded.");
  }

  try {
    const bytes = await sceneToPdf(docResult.data.scene);
    downloadBlob(bytes.slice(), `${baseName()}.pdf`, "application/pdf");
    return ok(undefined);
  } catch (err) {
    return fail("PDF export failed.", err);
  }
}

/** Writes the scene graph as a standalone SVG file. */
export function exportSvg(): Result<void> {
  const docResult = requireDocument();
  if (!docResult.data) {
    return fail(docResult.error?.msg ?? "No document loaded.");
  }

  downloadBlob(sceneToSvg(docResult.data.scene), `${baseName()}.svg`, "image/svg+xml");
  return ok(undefined);
}

/** Writes the validation findings (severity overrides applied) as a CSV report. */
export function exportIssuesCsv(): Result<void> {
  const docResult = requireDocument();
  if (!docResult.data) {
    return fail(docResult.error?.msg ?? "No document loaded.");
  }

  const xmlText = viewerState.get().file?.text ?? "";
  const csv = buildIssuesCsv(getEffectiveIssues(), docResult.data.root, xmlText);
  downloadBlob(csv, `${baseName()}-validation.csv`, "text/csv");
  return ok(undefined);
}
