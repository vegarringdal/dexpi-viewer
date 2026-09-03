import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDexpiDocument } from "../lib/dexpi/parseDocument.ts";
import type { ValidationIssue } from "../lib/dexpi/validation.ts";
import { buildIssuesCsv } from "./exportService.ts";

// -----------------------------------------------------------------------------
// buildIssuesCsv — pure CSV body builder, split out from exportIssuesCsv's
// download side effect so the line-number/XPath logic can be tested directly
// against a raw XML string with known line breaks.
// -----------------------------------------------------------------------------

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<Model name="Main">
  <!-- a comment
       spanning two lines -->
  <Object id="Seg1" type="Plant/Piping.PipingNetworkSegment">
    <Data property="Note"><String value="a > b"/></Data>
    <Components property="Items">
      <Object id="Pipe1" type="Plant/Piping.Pipe">
        <References objects="#Ghost" property="TargetItem"/>
      </Object>
    </Components>
  </Object>
</Model>`;

function parseRoot(xml: string): Element {
  return new DOMParser().parseFromString(xml, "text/xml").documentElement;
}

describe("buildIssuesCsv", () => {
  const root = parseRoot(XML);

  it("locates the element the rule reported, not the object that owns it", () => {
    const issues: ValidationIssue[] = [
      {
        ruleId: "SCH-002",
        severity: "error",
        message: 'Reference "TargetItem" points to missing object "Ghost".',
        objectId: "Pipe1",
        xpath: "/Model/Object/Components/Object/References",
      },
    ];
    const rows = buildIssuesCsv(issues, root, XML).split("\n");

    expect(rows[0]).toBe("rule,category,severity,objectId,line,xpath,message");
    // The <References> element sits on line 9 — Pipe1 itself is on line 8.
    expect(rows[1]).toBe(
      'SCH-002,schema,error,Pipe1,9,"/Model/Object/Components/Object/References","Reference ""TargetItem"" points to missing object ""Ghost""."',
    );
  });

  it('counts lines past comments and past a ">" inside an attribute value', () => {
    const issues: ValidationIssue[] = [
      {
        ruleId: "MDL-002",
        severity: "warning",
        message: "Unknown property",
        objectId: "Seg1",
        xpath: "/Model/Object/Data",
      },
      {
        ruleId: "CON-001",
        severity: "warning",
        message: "No target",
        objectId: "Pipe1",
        xpath: "/Model/Object/Components/Object",
      },
    ];
    const rows = buildIssuesCsv(issues, root, XML).split("\n");

    expect(rows[1]).toBe('MDL-002,model,warning,Seg1,6,"/Model/Object/Data","Unknown property"');
    expect(rows[2]).toBe(
      'CON-001,connectivity,warning,Pipe1,8,"/Model/Object/Components/Object","No target"',
    );
  });

  it("falls back to the owning object when the rule reports no element", () => {
    const issues: ValidationIssue[] = [
      { ruleId: "SCH-001", severity: "error", message: "Duplicate id", objectId: "Seg1" },
    ];
    const rows = buildIssuesCsv(issues, root, XML).split("\n");

    // Seg1 is the sole top-level Object — line 5, xpath has no [n] index.
    expect(rows[1]).toBe('SCH-001,schema,error,Seg1,5,"/Model/Object","Duplicate id"');
  });

  it("leaves line and xpath blank for an issue with no addressable objectId", () => {
    const issues: ValidationIssue[] = [
      { ruleId: "MDL-000", severity: "info", message: "No model version", objectId: null },
    ];
    const rows = buildIssuesCsv(issues, root, XML).split("\n");

    expect(rows[1]).toBe('MDL-000,model,info,,,"","No model version"');
  });

  it("leaves line and xpath blank when the objectId doesn't resolve to any element", () => {
    const issues: ValidationIssue[] = [
      { ruleId: "SCH-002", severity: "error", message: "Dangling reference", objectId: "NoSuchId" },
    ];
    const rows = buildIssuesCsv(issues, root, XML).split("\n");

    expect(rows[1]).toBe('SCH-002,schema,error,NoSuchId,,"","Dangling reference"');
  });

  it("still escapes double quotes in the message", () => {
    const issues: ValidationIssue[] = [
      { ruleId: "SCH-001", severity: "error", message: 'Duplicate "id"', objectId: "Seg1" },
    ];
    const rows = buildIssuesCsv(issues, root, XML).split("\n");

    expect(rows[1]).toBe('SCH-001,schema,error,Seg1,5,"/Model/Object","Duplicate ""id"""');
  });
});

// -----------------------------------------------------------------------------
// End-to-end locator check on the reference P&ID: every non-blank row must
// name a line that really carries the element its XPath ends in — the one
// invariant that catches a drift between the raw-text scan and the DOM walk.
// -----------------------------------------------------------------------------

describe("buildIssuesCsv on the reference P&ID", () => {
  it("reports lines that actually carry the located element", () => {
    const xml = readFileSync(join(__dirname, "../../refrences/reference_pid.xml"), "utf-8");
    const doc = parseDexpiDocument(xml).data;
    if (!doc) {
      throw new Error("reference P&ID failed to parse");
    }

    const sourceLines = xml.split("\n");
    const rows = buildIssuesCsv(doc.issues, doc.root, xml).split("\n").slice(1);
    expect(rows.length).toBeGreaterThan(10);

    let located = 0;
    for (const row of rows) {
      const match = /^[^,]+,[^,]+,[^,]+,[^,]*,(\d*),"([^"]*)"/.exec(row);
      expect(match).not.toBeNull();
      const [, line = "", xpath = ""] = match ?? [];
      if (!line || !xpath) {
        continue;
      }

      const tagName =
        xpath
          .split("/")
          .pop()
          ?.replace(/\[\d+\]$/, "") ?? "";
      expect(sourceLines[Number(line) - 1]).toContain(`<${tagName}`);
      located += 1;
    }
    expect(located).toBe(rows.length);
  });
});
