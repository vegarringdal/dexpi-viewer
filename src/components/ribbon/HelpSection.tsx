import { IconBrandWikipedia } from "@tabler/icons-react";
import { RibbonButton, RibbonSection } from "@tredespace/ui/widgets";
import type { JSX } from "react";

/** Opens the bundled user manual (built from documentation/ at build time). */
export function openDocs(): void {
  window.open("manual/index.html", "_blank", "noreferrer");
}

export function HelpSection(): JSX.Element {
  return (
    <RibbonSection title="Help">
      <RibbonButton
        icon={<IconBrandWikipedia />}
        label="Docs"
        tooltip="Open the user manual: guide, validation rules, information model, symbol catalogue (F1)"
        shortcut="help.docs"
        onClick={openDocs}
      />
    </RibbonSection>
  );
}
