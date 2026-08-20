import { Ribbon } from "@tredespace/ui/widgets";
import type { JSX } from "react";
import { ExportSection } from "./ribbon/ExportSection.tsx";
import { FileSection } from "./ribbon/FileSection.tsx";
import { PanelsSection } from "./ribbon/PanelsSection.tsx";
import { ViewSection } from "./ribbon/ViewSection.tsx";

/** The workbench toolbar; lives in the locked, tab-less top dock node. */
export function RibbonBar(): JSX.Element {
  return (
    <Ribbon>
      <FileSection />
      <ViewSection />
      <ExportSection />
      <PanelsSection />
    </Ribbon>
  );
}
