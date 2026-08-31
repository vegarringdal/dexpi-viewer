import { describe, expect, it } from "vitest";
import type { ValidationIssue } from "../lib/dexpi/validation.ts";
import { buildIssuesCsv } from "./exportService.ts";

// -----------------------------------------------------------------------------
// buildIssuesCsv — pure CSV body builder, split out from exportIssuesCsv's
// download side effect so the line-number/XPath logic can be tested directly
// against a raw XML string with known line breaks.
// -----------------------------------------------------------------------------

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<Model name="Main">
  <Object id="Seg1" type="Plant/Piping.PipingNetworkSegment">
    <Components property="Items">
      <Object id="Pipe1" type="Plant/Piping.Pipe"/>
    </Components>
  </Object>
</Model>`;

function parseRoot(xml: string): Element {
  return new DOMParser().parseFromString(xml, "text/xml").documentElement;
}

describe("buildIssuesCsv", () => {
  const root = parseRoot(XML);

  it("adds the source line number and an XPath locator for a resolvable objectId", () => {
    const issues: ValidationIssue[] = [
      { ruleId: "SCH-001", severity: "error", message: "Duplicate id", objectId: "Seg1" },
      { ruleId: "GFX-001", severity: "warning", message: "Unknown shape", objectId: "Pipe1" },
    ];
    const rows = buildIssuesCsv(issues, root, XML).split("\n");

    expect(rows[0]).toBe("rule,category,severity,objectId,line,xpath,message");
    // Seg1 is the sole top-level Object — line 3, xpath has no [n] index.
    expect(rows[1]).toBe('SCH-001,schema,error,Seg1,3,"/Model/Object","Duplicate id"');
    // Pipe1 sits inside Seg1's Components/Items — line 5.
    expect(rows[2]).toBe(
      'GFX-001,graphics,warning,Pipe1,5,"/Model/Object/Components/Object","Unknown shape"',
    );
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

    expect(rows[1]).toBe('SCH-001,schema,error,Seg1,3,"/Model/Object","Duplicate ""id"""');
  });
});
