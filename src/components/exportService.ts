import { sceneToSvg } from "../lib/dexpi/exportSvg.ts";
import {
  categoryOfRule,
  type IssueSeverity,
  type ValidationCategory,
  type ValidationIssue,
} from "../lib/dexpi/validation.ts";
import { elementXPath } from "../lib/dexpi/xml.ts";
import { downloadBlob } from "../lib/download.ts";
import { fail, ok, type Result } from "../lib/result.ts";
import { buildXlsx, type SheetColumn, type SheetData } from "../lib/xlsx.ts";
import { getEffectiveIssues } from "../state/validation/validation.actions.ts";
import { viewerState } from "../state/viewer/viewer.state.ts";
import { sceneToPdf } from "./exportPdf.ts";
import { baseName, requireDocument } from "./exportShared.ts";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// The report
// -----------------------------------------------------------------------------

/** One row of the validation report, shared by the CSV and Excel writers. */
export type IssueReportRow = Readonly<{
  rule: string;
  category: ValidationCategory;
  severity: IssueSeverity;
  objectId: string;
  /** Source line of the located element; null when nothing resolved. */
  line: number | null;
  xpath: string;
  message: string;
}>;

const REPORT_COLUMNS: readonly SheetColumn[] = [
  { header: "rule", width: 10 },
  { header: "category", width: 13 },
  { header: "severity", width: 10 },
  { header: "objectId", width: 30 },
  { header: "line", width: 8 },
  { header: "xpath", width: 58 },
  { header: "message", width: 90 },
];

const SHEET_NAME = "Validation findings";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * The report as data — one row per finding, severity overrides already
 * applied by the caller. `line`/`xpath` locate the element the finding is
 * REALLY about (the offending `<References>`/`<Data>` element, as reported by
 * the rule in `issue.xpath`), falling back to the owning object named by
 * `objectId` for rules that have no finer locator.
 */
export function buildIssueReportRows(
  issues: readonly ValidationIssue[],
  root: Element,
  xmlText: string,
): readonly IssueReportRow[] {
  const lineByXPath = buildLineIndex(xmlText, root);
  const elementsById = new Map<string, Element>();
  for (const el of root.querySelectorAll("Object[id]")) {
    const id = el.getAttribute("id");
    if (id) {
      elementsById.set(id, el);
    }
  }

  return issues.map((issue) => {
    const owner = issue.objectId ? elementsById.get(issue.objectId) : undefined;
    const xpath = issue.xpath ?? (owner ? elementXPath(owner) : "");
    return {
      rule: issue.ruleId,
      category: categoryOfRule(issue.ruleId),
      severity: issue.severity,
      objectId: issue.objectId ?? "",
      line: lineByXPath.get(xpath) ?? null,
      xpath,
      message: issue.message,
    };
  });
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

/**
 * The full CSV report body (header + one row per issue) — pure and exported
 * for direct testing, separate from the DOM-download side effect in
 * `exportIssuesCsv`.
 */
export function buildIssuesCsv(issues: readonly ValidationIssue[], root: Element, xmlText: string): string {
  const rows = buildIssueReportRows(issues, root, xmlText).map((row) =>
    [
      row.rule,
      row.category,
      row.severity,
      row.objectId,
      row.line === null ? "" : String(row.line),
      csvCell(row.xpath),
      csvCell(row.message),
    ].join(","),
  );
  return [REPORT_COLUMNS.map((column) => column.header).join(","), ...rows].join("\n");
}

/**
 * The same report as a single-sheet workbook. `line` stays a NUMBER so Excel
 * sorts and filters it as one; everything else is text.
 */
export function buildIssuesSheet(rows: readonly IssueReportRow[]): SheetData {
  return {
    name: SHEET_NAME,
    columns: REPORT_COLUMNS,
    rows: rows.map((row) => [
      row.rule,
      row.category,
      row.severity,
      row.objectId,
      row.line ?? "",
      row.xpath,
      row.message,
    ]),
  };
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

/**
 * Writes the same findings as an .xlsx workbook — the format Windows opens
 * with a double-click, with no CSV delimiter/locale guessing, a frozen bold
 * header and an auto-filter already on the columns.
 */
export function exportIssuesXlsx(): Result<void> {
  const docResult = requireDocument();
  if (!docResult.data) {
    return fail(docResult.error?.msg ?? "No document loaded.");
  }

  const xmlText = viewerState.get().file?.text ?? "";
  const rows = buildIssueReportRows(getEffectiveIssues(), docResult.data.root, xmlText);
  downloadBlob(buildXlsx(buildIssuesSheet(rows)), `${baseName()}-validation.xlsx`, XLSX_MIME);
  return ok(undefined);
}
