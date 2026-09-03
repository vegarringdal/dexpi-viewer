import { describe, expect, it } from "vitest";
import { buildXlsx, buildXlsxParts, columnLetters, type SheetData } from "./xlsx.ts";

// -----------------------------------------------------------------------------
// buildXlsx / buildXlsxParts — the parts are asserted as XML (no unzipping;
// `zip.test.ts` covers the packaging). The container these produce was also
// verified against a real spreadsheet reader: python's zipfile reports every
// CRC intact and openpyxl loads the sheet with its frozen header, auto-filter,
// column widths, bold header row and numeric `line` cells.
// -----------------------------------------------------------------------------

const SHEET: SheetData = {
  name: "Validation findings",
  columns: [
    { header: "rule", width: 10 },
    { header: "line", width: 8 },
    { header: "message", width: 90 },
  ],
  rows: [
    ["SCH-002", 12321, 'Reference "TargetItem" points to missing object <Ghost & co>.'],
    ["MDL-003", "", "Required property missing"],
  ],
};

function partText(sheet: SheetData, path: string): string {
  const part = buildXlsxParts(sheet).find((entry) => entry.path === path);
  if (!part) {
    throw new Error(`part ${path} missing`);
  }

  return part.text;
}

describe("columnLetters", () => {
  it("counts in spreadsheet columns", () => {
    expect([1, 2, 26, 27, 28, 52, 53, 703].map(columnLetters)).toEqual([
      "A",
      "B",
      "Z",
      "AA",
      "AB",
      "AZ",
      "BA",
      "AAA",
    ]);
  });
});

describe("buildXlsxParts", () => {
  it("writes the six package parts, content types first", () => {
    expect(buildXlsxParts(SHEET).map((entry) => entry.path)).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/workbook.xml",
      "xl/_rels/workbook.xml.rels",
      "xl/styles.xml",
      "xl/worksheets/sheet1.xml",
    ]);
  });

  it("writes numbers as numbers and text as inline strings", () => {
    const sheet = partText(SHEET, "xl/worksheets/sheet1.xml");
    expect(sheet).toContain('<c r="B2"><v>12321</v></c>');
    expect(sheet).toContain('<c r="A2" t="inlineStr"><is><t xml:space="preserve">SCH-002</t></is></c>');
    // An empty cell carries no value element at all.
    expect(sheet).toContain('<c r="B3"/>');
  });

  it("escapes XML-significant characters in cell text", () => {
    expect(partText(SHEET, "xl/worksheets/sheet1.xml")).toContain(
      "Reference &quot;TargetItem&quot; points to missing object &lt;Ghost &amp; co&gt;.",
    );
  });

  it("drops control characters XML 1.0 forbids but keeps tabs and newlines", () => {
    const sheet = partText(
      { ...SHEET, rows: [["a\u0000b\u001fc", "line\tbreak\nkept", ""]] },
      "xl/worksheets/sheet1.xml",
    );
    expect(sheet).toContain(">abc<");
    expect(sheet).toContain(">line\tbreak\nkept<");
  });

  it("bolds the header row, freezes it, and filters the used range", () => {
    const sheet = partText(SHEET, "xl/worksheets/sheet1.xml");
    expect(sheet).toContain('<c r="A1" s="1" t="inlineStr"><is><t xml:space="preserve">rule</t></is></c>');
    expect(sheet).toContain('<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>');
    expect(sheet).toContain('<autoFilter ref="A1:C3"/>');
    expect(sheet).toContain('<dimension ref="A1:C3"/>');
  });

  it("sets the declared column widths", () => {
    expect(partText(SHEET, "xl/worksheets/sheet1.xml")).toContain(
      '<col min="3" max="3" width="90" customWidth="1"/>',
    );
  });

  it("sanitizes the sheet name to Excel's rules", () => {
    const named = (name: string): string => partText({ ...SHEET, name }, "xl/workbook.xml");
    expect(named("Report: [2026]/final?")).toContain('<sheet name="Report   2026  final" sheetId="1"');
    expect(named("x".repeat(40))).toContain(`<sheet name="${"x".repeat(31)}" sheetId="1"`);
    expect(named("   ")).toContain('<sheet name="Sheet1" sheetId="1"');
  });
});

describe("buildXlsx", () => {
  it("packs the parts into a zip container", () => {
    const bytes = buildXlsx(SHEET);
    expect(bytes.subarray(0, 2)).toEqual(new Uint8Array([0x50, 0x4b]));
    expect(bytes.length).toBeGreaterThan(1000);
  });
});
