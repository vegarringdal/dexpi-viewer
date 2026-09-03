import { createZip, type ZipEntry } from "./zip.ts";

// -----------------------------------------------------------------------------
// Minimal .xlsx (SpreadsheetML) writer
//
// One sheet, a bold frozen header row, an auto-filter and per-column widths —
// what a report needs to be usable in Excel on Windows, and no more. Strings
// are written inline (no sharedStrings part) and numbers as numbers, so Excel
// sorts and filters the numeric columns properly.
//
// Deliberately hand-rolled rather than pulled from a spreadsheet library: the
// grammar below is the whole of what a report uses, and the app stays free of
// a dependency to license-vet against the AGPL. `zip.ts` does the packaging.
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type SheetCell = string | number;

export type SheetColumn = Readonly<{
  header: string;
  /** Width in Excel's character units. */
  width: number;
}>;

export type SheetData = Readonly<{
  /** Sheet tab name; sanitized to Excel's 31-char, no-`[]:*?/\` rule. */
  name: string;
  columns: readonly SheetColumn[];
  rows: readonly (readonly SheetCell[])[];
}>;

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const RELATIONSHIP_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PACKAGE_RELATIONSHIP_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const CONTENT_TYPES_NS = "http://schemas.openxmlformats.org/package/2006/content-types";
const SHEET_NAME_MAX_LENGTH = 31;
/** `cellXfs` index of the bold header format defined in `STYLES_XML`. */
const HEADER_STYLE_INDEX = 1;
const ALPHABET_SIZE = 26;
const CODE_POINT_A = 65;

// -----------------------------------------------------------------------------
// Helper functions
// -----------------------------------------------------------------------------

const MIN_PRINTABLE_CODE_POINT = 0x20;
const TAB = 0x09;
const LINE_FEED = 0x0a;
const CARRIAGE_RETURN = 0x0d;

/** XML 1.0 allows only tab, newline and carriage return below U+0020; Excel
 *  refuses a workbook that carries any of the rest. */
function isForbiddenControlCharacter(codePoint: number): boolean {
  return (
    codePoint < MIN_PRINTABLE_CODE_POINT &&
    codePoint !== TAB &&
    codePoint !== LINE_FEED &&
    codePoint !== CARRIAGE_RETURN
  );
}

/** XML-escapes text and drops the control characters XML 1.0 forbids. */
function escapeXml(value: string): string {
  let out = "";
  for (const char of value) {
    if (isForbiddenControlCharacter(char.codePointAt(0) ?? 0)) {
      continue;
    }

    if (char === "&") {
      out += "&amp;";
    } else if (char === "<") {
      out += "&lt;";
    } else if (char === ">") {
      out += "&gt;";
    } else if (char === '"') {
      out += "&quot;";
    } else {
      out += char;
    }
  }
  return out;
}

/** 1-based column number → spreadsheet column letters (1 → A, 27 → AA). */
export function columnLetters(column: number): string {
  let remaining = column;
  let letters = "";
  while (remaining > 0) {
    const rest = (remaining - 1) % ALPHABET_SIZE;
    letters = String.fromCharCode(CODE_POINT_A + rest) + letters;
    remaining = Math.floor((remaining - 1) / ALPHABET_SIZE);
  }
  return letters;
}

function cellXml(column: number, row: number, value: SheetCell, styleIndex: number | null): string {
  const reference = `${columnLetters(column)}${String(row)}`;
  const style = styleIndex === null ? "" : ` s="${String(styleIndex)}"`;
  if (typeof value === "number") {
    return `<c r="${reference}"${style}><v>${String(value)}</v></c>`;
  }

  if (value === "") {
    return `<c r="${reference}"${style}/>`;
  }

  return `<c r="${reference}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function rowXml(cells: readonly SheetCell[], row: number, styleIndex: number | null): string {
  const body = cells.map((cell, index) => cellXml(index + 1, row, cell, styleIndex)).join("");
  return `<row r="${String(row)}">${body}</row>`;
}

function sheetName(name: string): string {
  const cleaned = name.replaceAll(/[[\]:*?/\\]/g, " ").trim();
  return (cleaned || "Sheet1").slice(0, SHEET_NAME_MAX_LENGTH);
}

// -----------------------------------------------------------------------------
// Parts
// -----------------------------------------------------------------------------

const CONTENT_TYPES_XML = `${XML_DECLARATION}
<Types xmlns="${CONTENT_TYPES_NS}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;

const ROOT_RELS_XML = `${XML_DECLARATION}
<Relationships xmlns="${PACKAGE_RELATIONSHIP_NS}"><Relationship Id="rId1" Type="${RELATIONSHIP_NS}/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

const WORKBOOK_RELS_XML = `${XML_DECLARATION}
<Relationships xmlns="${PACKAGE_RELATIONSHIP_NS}"><Relationship Id="rId1" Type="${RELATIONSHIP_NS}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${RELATIONSHIP_NS}/styles" Target="styles.xml"/></Relationships>`;

/** Two formats: 0 = default, 1 = bold (the header row). */
const STYLES_XML = `${XML_DECLARATION}
<styleSheet xmlns="${MAIN_NS}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="0"/></styleSheet>`;

function workbookXml(name: string): string {
  return `${XML_DECLARATION}
<workbook xmlns="${MAIN_NS}" xmlns:r="${RELATIONSHIP_NS}"><sheets><sheet name="${escapeXml(name)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
}

/**
 * The worksheet part. Element order is fixed by the schema: sheetViews (the
 * frozen header), cols, sheetData, then autoFilter — Excel rejects the file
 * outright if they come in any other order.
 */
function worksheetXml(sheet: SheetData): string {
  const lastColumn = columnLetters(Math.max(sheet.columns.length, 1));
  const lastRow = sheet.rows.length + 1;
  const dimension = `<dimension ref="A1:${lastColumn}${String(lastRow)}"/>`;
  const views =
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>';
  const cols = sheet.columns
    .map((column, index) => {
      const at = String(index + 1);
      return `<col min="${at}" max="${at}" width="${String(column.width)}" customWidth="1"/>`;
    })
    .join("");
  const header = rowXml(
    sheet.columns.map((column) => column.header),
    1,
    HEADER_STYLE_INDEX,
  );
  const body = sheet.rows.map((cells, index) => rowXml(cells, index + 2, null)).join("");
  const filter = `<autoFilter ref="A1:${lastColumn}${String(lastRow)}"/>`;
  return `${XML_DECLARATION}
<worksheet xmlns="${MAIN_NS}">${dimension}${views}<cols>${cols}</cols><sheetData>${header}${body}</sheetData>${filter}</worksheet>`;
}

// -----------------------------------------------------------------------------
// Entry point
// -----------------------------------------------------------------------------

/**
 * The OOXML parts of the workbook, in package order (`[Content_Types].xml`
 * first, as readers expect). Exported so the generated XML can be asserted
 * directly, without unzipping.
 */
export function buildXlsxParts(sheet: SheetData): readonly ZipEntry[] {
  return [
    { path: "[Content_Types].xml", text: CONTENT_TYPES_XML },
    { path: "_rels/.rels", text: ROOT_RELS_XML },
    { path: "xl/workbook.xml", text: workbookXml(sheetName(sheet.name)) },
    { path: "xl/_rels/workbook.xml.rels", text: WORKBOOK_RELS_XML },
    { path: "xl/styles.xml", text: STYLES_XML },
    { path: "xl/worksheets/sheet1.xml", text: worksheetXml(sheet) },
  ];
}

/** Builds a single-sheet .xlsx workbook (bytes ready to download). */
export function buildXlsx(sheet: SheetData): Uint8Array<ArrayBuffer> {
  return createZip(buildXlsxParts(sheet));
}
