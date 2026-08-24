import { validateBindings } from "@tredespace/ui/hotkeys";
import { describe, expect, it } from "vitest";
import { appHotkeyDefs } from "./hotkeys.ts";

describe("app hotkey table", () => {
  it("has unique ids and parseable, conflict-free default bindings", () => {
    expect(validateBindings([...appHotkeyDefs()])).toEqual([]);
  });

  it("covers every ribbon action group", () => {
    const categories = new Set(appHotkeyDefs().map((d) => d.category));
    expect(categories).toEqual(new Set(["File", "View", "Export", "Panels", "Help"]));
  });
});
