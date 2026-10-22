import { describe, expect, it } from "vitest";
import {
  BUNDLED_PROFILE_VERSIONS,
  bundledProfileName,
  bundledProfileUrl,
  detectDeclaredProfile,
  detectDeclaredProfileFromText,
  detectProfileFileVersion,
  isBundledProfileVersion,
  LATEST_BUNDLED_PROFILE,
  PRE_STAMP_VERSION,
} from "./profileVersion.ts";

// -----------------------------------------------------------------------------
// Fixtures
// -----------------------------------------------------------------------------

/** A document prologue with the given DiscProfile import source (omitted when null). */
function documentText(discProfileSource: string | null): string {
  const discImport =
    discProfileSource === null ? "" : `  <Import prefix="DiscProfile" source="${discProfileSource}"/>\n`;
  return [
    '<Model name="example" uri="http://www.example.org">',
    '  <Import prefix="Core" source="https://data.dexpi.org/models/2.0.0/Core.xml"/>',
    discImport.trimEnd(),
    '  <Import prefix="Plant" source="https://data.dexpi.org/models/2.0.0/Plant.xml"/>',
    '  <Object type="Core/EngineeringModel"/>',
    "</Model>",
  ]
    .filter((line) => line.length > 0)
    .join("\n");
}

function parse(xml: string): Element {
  const root = new DOMParser().parseFromString(xml, "text/xml").documentElement;
  if (!root) {
    throw new Error("fixture parse failed");
  }

  return root;
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe("bundled catalogue registry", () => {
  it("knows the versions it ships and how to reach them", () => {
    expect(isBundledProfileVersion("0.6.6")).toBe(true);
    expect(isBundledProfileVersion("0.6.4")).toBe(true);
    expect(isBundledProfileVersion("0.6.3")).toBe(true);
    expect(isBundledProfileVersion("0.6.5")).toBe(false);
    expect(isBundledProfileVersion("0.7.0")).toBe(false);
    expect(bundledProfileUrl("0.6.6")).toBe("profiles/DiscProfile-0.6.6.xml");
    expect(bundledProfileName("0.6.3")).toBe("DiscProfile 0.6.3");
  });

  it("orders the picker newest first and makes 0.6.6 the latest", () => {
    expect(BUNDLED_PROFILE_VERSIONS).toEqual(["0.6.6", "0.6.4", "0.6.3"]);
    expect(LATEST_BUNDLED_PROFILE).toBe("0.6.6");
  });
});

describe("detectProfileFileVersion", () => {
  it("prefers the MetaData/version stamp", () => {
    const root = parse('<Model name="DiscProfile" uri="http://www.to.define/DiscProfile/0.6.4"/>');
    expect(detectProfileFileVersion(root, "0.6.4")).toBe("0.6.4");
  });

  it("falls back to the versioned model URI when the stamp is absent", () => {
    const root = parse('<Model name="DiscProfile" uri="http://www.to.define/DiscProfile/0.6.4"/>');
    expect(detectProfileFileVersion(root, "")).toBe("0.6.4");
  });

  it("reports null for a pre-0.6.4 catalogue, which carries neither", () => {
    const root = parse('<Model name="DiscProfile" uri="http://www.to.define"/>');
    expect(detectProfileFileVersion(root, "")).toBeNull();
  });

  it("reads the feature-level files' own URI shape", () => {
    const root = parse('<Model name="DiscProfile_FL0" uri="http://www.to.define/DiscProfile_FL0/0.6.4"/>');
    expect(detectProfileFileVersion(root, "")).toBe("0.6.4");
  });
});

describe("detectDeclaredProfile", () => {
  it("reads a versioned import", () => {
    expect(detectDeclaredProfile(parse(documentText("http://www.to.define/DiscProfile/0.6.4")))).toEqual({
      isImported: true,
      version: "0.6.4",
    });
  });

  it("treats the unversioned import as the pre-stamp release", () => {
    expect(detectDeclaredProfile(parse(documentText("http://www.to.define")))).toEqual({
      isImported: true,
      version: PRE_STAMP_VERSION,
    });
  });

  it("reports no profile when the document imports none", () => {
    expect(detectDeclaredProfile(parse(documentText(null)))).toEqual({
      isImported: false,
      version: null,
    });
  });
});

describe("detectDeclaredProfileFromText", () => {
  it("matches the parsed reading on every prologue shape", () => {
    const sources = [
      "http://www.to.define/DiscProfile/0.6.6",
      "http://www.to.define/DiscProfile/0.6.4",
      "http://www.to.define",
      null,
    ];
    for (const source of sources) {
      const xml = documentText(source);
      expect(detectDeclaredProfileFromText(xml)).toEqual(detectDeclaredProfile(parse(xml)));
    }
  });

  it("does not scan past the first Object", () => {
    const xml = `<Model>\n  <Object type="Core/EngineeringModel"/>\n  <Import prefix="DiscProfile" source="http://www.to.define/DiscProfile/0.6.4"/>\n</Model>`;
    expect(detectDeclaredProfileFromText(xml).isImported).toBe(false);
  });

  it("finds the import by source even when the prefix is spelled differently", () => {
    const xml = '<Model>\n  <Import prefix="Disc" source="http://www.to.define/DiscProfile/0.6.4"/>\n';
    expect(detectDeclaredProfileFromText(xml).version).toBe("0.6.4");
  });
});
