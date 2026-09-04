import { PanelBody } from "@tredespace/ui/dockable";
import { Collapsible } from "@tredespace/ui/widgets";
import type { JSX } from "react";
import { viewerState } from "../../state/viewer/viewer.state.ts";
import { GeneralHighlightSection } from "./GeneralHighlightSection.tsx";
import { LabelInspectSection } from "./LabelInspectSection.tsx";
import { NodePositionSection } from "./NodePositionSection.tsx";

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * Three independent ways to mark up the drawing for inspection: tint objects
 * by classification, show where the profile's label templates put their text,
 * and mark the file's and the profile's connection points. They compose —
 * each section adds its own overlay on top of whatever the others draw.
 */
export function HighlightPanel(): JSX.Element {
  const { file } = viewerState.use();

  if (!file) {
    return (
      <PanelBody className="flex h-full items-center justify-center p-4 text-center text-slate-500 text-xs">
        Open a DEXPI file to get started.
      </PanelBody>
    );
  }

  return (
    <PanelBody className="flex h-full flex-col gap-2 overflow-auto p-2">
      <Collapsible title="General Highlight" defaultOpen>
        <GeneralHighlightSection />
      </Collapsible>
      <Collapsible
        title="Label Inspect"
        info="Renders each profile LabelTemplate at its declared position, rotation, size and alignment — including the ones the drawing's own labels normally suppress — so you can check where a generated file actually placed its text."
      >
        <LabelInspectSection />
      </Collapsible>
      <Collapsible
        title="Node Positions"
        info="Marks connection points: a circle for each node position in the DEXPI file, an X for each attachment point the profile symbol declares."
      >
        <NodePositionSection />
      </Collapsible>
    </PanelBody>
  );
}
