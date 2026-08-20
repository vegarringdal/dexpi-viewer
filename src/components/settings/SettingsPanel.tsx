import { PanelBody } from "@tredespace/ui/dockable";
import { VerticalTabs } from "@tredespace/ui/widgets";
import type { JSX } from "react";
import { AboutSettingsTab } from "./AboutSettingsTab.tsx";
import { RenderingSettingsTab } from "./RenderingSettingsTab.tsx";
import { ShortcutsSettingsTab } from "./ShortcutsSettingsTab.tsx";

/** Settings as a regular dock panel — dockable/floatable next to everything else. */
export function SettingsPanel(): JSX.Element {
  return (
    <PanelBody className="h-full">
      <VerticalTabs
        className="h-full"
        defaultValue="about"
        tabs={[
          { id: "rendering", label: "Rendering", content: <RenderingSettingsTab /> },
          { id: "shortcuts", label: "Shortcuts", content: <ShortcutsSettingsTab /> },
          { id: "about", label: "About", content: <AboutSettingsTab /> },
        ]}
      />
    </PanelBody>
  );
}
