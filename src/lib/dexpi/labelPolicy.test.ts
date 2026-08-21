import { describe, expect, it } from "vitest";
import { isRenderableLabelValue } from "./labelPolicy.ts";

describe("isRenderableLabelValue", () => {
  it("accepts real engineering values, including multiline ones", () => {
    expect(isRenderableLabelValue("AP110")).toBe(true);
    expect(isRenderableLabelValue("D-20L00004A")).toBe(true);
    expect(isRenderableLabelValue("AP110\nD-20L00004A")).toBe(true);
    expect(isRenderableLabelValue("1:100")).toBe(true);
  });

  it("rejects empty and sentinel values", () => {
    expect(isRenderableLabelValue("")).toBe(false);
    expect(isRenderableLabelValue("   ")).toBe(false);
    expect(isRenderableLabelValue("?")).toBe(false);
    expect(isRenderableLabelValue("N/A")).toBe(false);
    expect(isRenderableLabelValue("TBD")).toBe(false);
  });

  it("rejects leaked template tokens", () => {
    expect(isRenderableLabelValue("<BreakValue1>")).toBe(false);
    expect(isRenderableLabelValue("{Tag}")).toBe(false);
  });

  it("rejects the exporter's repeated placeholder filler", () => {
    expect(isRenderableLabelValue("????????")).toBe(false);
    expect(isRenderableLabelValue("-----")).toBe(false);
    expect(isRenderableLabelValue("?!?!")).toBe(false);
    expect(isRenderableLabelValue("····")).toBe(false);
    expect(isRenderableLabelValue("xxxx")).toBe(false);
    expect(isRenderableLabelValue("XXXX")).toBe(false);
    expect(isRenderableLabelValue("????\n????")).toBe(false);
  });

  it("rejects mixed exporter placeholders of symbols and x/X", () => {
    expect(isRenderableLabelValue("??XX??")).toBe(false);
    expect(isRenderableLabelValue("x-x-x")).toBe(false);
    expect(isRenderableLabelValue("?x?")).toBe(false);
    expect(isRenderableLabelValue("X?X?")).toBe(false);
  });

  it("keeps single symbols and values with real alphanumeric content", () => {
    // A lone "-" or "*" may be authored separator text; only runs are filler.
    expect(isRenderableLabelValue("-")).toBe(true);
    expect(isRenderableLabelValue("*")).toBe(true);
    expect(isRenderableLabelValue("X-100")).toBe(true);
  });
});
